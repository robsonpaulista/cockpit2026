#!/usr/bin/env node
/**
 * Coleta temas em alta no Brasil (Google Trends trendingNow).
 *
 * Uso:
 *   node scripts/collect-google-trending-topics.mjs
 *   node scripts/collect-google-trending-topics.mjs --geo BR --hours 24
 *
 * Imprime um JSON por linha no stdout (última linha = resultado).
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient as createTrendsClient, MemoryCookieStore } from 'trendsearch'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (!m) continue
    const key = m[1].trim()
    const value = m[2].trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv) {
  const out = { geo: 'BR', hours: 24 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--geo' && argv[i + 1]) {
      out.geo = String(argv[++i]).trim().toUpperCase()
    } else if (a === '--hours' && argv[i + 1]) {
      const n = Number(argv[++i])
      if (n === 4 || n === 24 || n === 48 || n === 168) out.hours = n
    }
  }
  return out
}

function emit(payload) {
  console.log(JSON.stringify(payload))
}

async function main() {
  loadEnvLocal()
  const { geo, hours } = parseArgs(process.argv.slice(2))
  const collectedAt = new Date().toISOString()

  const trends = createTrendsClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 90_000,
    userAgent: CHROME_UA,
    cookieStore: new MemoryCookieStore(),
    retries: { maxRetries: 2, baseDelayMs: 4_000, maxDelayMs: 25_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 2_000 },
  })

  const response = await trends.trendingNow({ geo, language: 'pt', hours })
  const items = response.data?.items ?? []

  if (items.length === 0) {
    emit({
      ok: false,
      geo,
      hours,
      collectedAt,
      itemsUpserted: 0,
      keywords: [],
      error: 'Google Trends retornou lista vazia.',
    })
    process.exit(1)
  }

  const rows = items
    .map((item, index) => {
      const keyword = typeof item.keyword === 'string' ? item.keyword.trim() : ''
      if (!keyword) return null
      return {
        collected_at: collectedAt,
        geo,
        hours,
        rank: index + 1,
        keyword,
        traffic: typeof item.traffic === 'number' && Number.isFinite(item.traffic) ? Math.round(item.traffic) : null,
        traffic_growth_rate:
          typeof item.trafficGrowthRate === 'number' && Number.isFinite(item.trafficGrowthRate)
            ? item.trafficGrowthRate
            : null,
        related_keywords: Array.isArray(item.relatedKeywords)
          ? item.relatedKeywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 12)
          : [],
        active_time: typeof item.activeTime === 'string' ? item.activeTime : null,
      }
    })
    .filter(Boolean)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    emit({
      ok: false,
      geo,
      hours,
      collectedAt,
      itemsUpserted: 0,
      keywords: [],
      error: 'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local',
    })
    process.exit(1)
  }

  const supabase = createSupabase(url, key)
  const { error } = await supabase.from('google_trending_topics').upsert(rows, {
    onConflict: 'collected_at,geo,hours,rank',
  })

  if (error) {
    emit({
      ok: false,
      geo,
      hours,
      collectedAt,
      itemsUpserted: 0,
      keywords: [],
      error: error.message,
    })
    process.exit(1)
  }

  emit({
    ok: true,
    geo,
    hours,
    collectedAt,
    itemsUpserted: rows.length,
    keywords: rows.map((r) => r.keyword),
  })
}

main().catch((e) => {
  emit({
    ok: false,
    geo: 'BR',
    hours: 24,
    collectedAt: new Date().toISOString(),
    itemsUpserted: 0,
    keywords: [],
    error: e instanceof Error ? e.message : String(e),
  })
  process.exit(1)
})
