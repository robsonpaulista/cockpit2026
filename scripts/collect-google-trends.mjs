#!/usr/bin/env node
/**
 * Coleta Google Trends (trendsearch) → Supabase.
 * Rodado pela API via subprocess para evitar timeout/fetch do webpack Next.js.
 *
 * Uso:
 *   node scripts/collect-google-trends.mjs
 *   node scripts/collect-google-trends.mjs --geo BR-PI --timeframe "today 1-m"
 *   node scripts/collect-google-trends.mjs --with-related   # inclui consultas/tópicos (lento)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient as createTrendsClient, MemoryCookieStore } from 'trendsearch'
import { createSupabaseClient as createSupabase } from './lib/supabase-client.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const KEYWORDS_PER_BATCH = 3
const MAX_RELATED_PER_BUCKET = 10
const MAX_ATTEMPTS = 4
const INITIAL_BACKOFF_MS = 8_000
const RATE_LIMIT_BACKOFF_MS = 25_000
const MAX_BACKOFF_MS = 90_000
const PAUSE_BETWEEN_RELATED_MS = 5_000
const PAUSE_AFTER_BATCH_MS = 3_000
const PAUSE_BETWEEN_ACTORS_MS = 5_000
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const TIMEFRAME_ALIASES = {
  'today 7-d': 'today 1-m',
  'now 7-d': 'today 1-m',
  'today 3-m': 'today 1-m',
}

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

function emit(result) {
  console.log(JSON.stringify(result))
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeTimeframe(raw) {
  const v = (raw ?? 'today 1-m').trim()
  return TIMEFRAME_ALIASES[v] ?? v
}

function parseArgs() {
  const args = process.argv.slice(2)
  let geo = 'BR-PI'
  let timeframe = 'today 1-m'
  let skipRelated = true
  let termsJson = null
  let base = 'atores'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--geo' && args[i + 1]) geo = args[++i]
    if (args[i] === '--timeframe' && args[i + 1]) timeframe = args[++i]
    if (args[i] === '--skip-related') skipRelated = true
    if (args[i] === '--with-related') skipRelated = false
    if (args[i] === '--terms' && args[i + 1]) termsJson = args[++i]
    if (args[i] === '--base' && args[i + 1]) base = args[++i]
  }
  let terms = null
  if (termsJson) {
    terms = JSON.parse(termsJson)
  } else if (base === 'campanha') {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/campaign-trends-keywords.json'), 'utf8'))
    terms = [...(raw.pautas ?? []), ...(raw.deputado ?? [])]
  }
  return { geo, timeframe: normalizeTimeframe(timeframe), skipRelated, terms }
}

function isRetryable(error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (/429|rate.?limit|fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|socket/i.test(msg)) {
    return true
  }
  if (error && typeof error === 'object') {
    const e = error
    if (e.status === 429) return true
    if (e.code === 'RATE_LIMIT_ERROR' || e.code === 'TRANSPORT_ERROR') return true
    if (e._tag === 'RateLimitError' || e._tag === 'TransportError') return true
  }
  return false
}

const PANORAMA_WINDOW_DAYS = 30

const brDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' })

function formatGoogleTrendsInterestDay(ms) {
  return brDateFormatter.format(new Date(ms))
}

function interestQueryCutoffDay() {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - PANORAMA_WINDOW_DAYS)
  return d.toISOString().slice(0, 10)
}

function interestDateFromPoint(time, formattedTime) {
  if (formattedTime) {
    const parsed = Date.parse(formattedTime)
    if (!Number.isNaN(parsed)) return formatGoogleTrendsInterestDay(parsed)
  }
  const asNum = Number(time)
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000
    return formatGoogleTrendsInterestDay(ms)
  }
  if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10)
  throw new Error(`Data Trends inválida: ${time}`)
}

function buildInterestRowsFromTimeline(timeline, batch) {
  const scoreByTermDate = new Map()
  for (const point of timeline) {
    const interestDate = interestDateFromPoint(point.time, point.formattedTime)
    batch.forEach((actor, idx) => {
      const raw = point.value[idx]
      const score = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
      const clamped = Math.max(0, Math.min(100, score))
      const key = `${actor.name}\0${interestDate}`
      scoreByTermDate.set(key, Math.max(scoreByTermDate.get(key) ?? 0, clamped))
    })
  }

  const rows = []
  for (const [key, interest_score] of scoreByTermDate) {
    const [search_term, interest_date] = key.split('\0')
    const actor = batch.find((a) => a.name === search_term)
    if (!actor) continue
    rows.push({
      politico_id: actor.id,
      search_term,
      interest_date,
      interest_score,
    })
  }
  return rows
}

async function pruneStaleGoogleTrendsInterest(supabase, geo, timeframe, cutoffDay) {
  const { error: legacyError } = await supabase
    .from('google_trends_interest')
    .delete()
    .eq('geo', geo)
    .neq('timeframe', timeframe)
  if (legacyError && !legacyError.message.includes('does not exist')) {
    throw new Error(legacyError.message)
  }

  const { error: oldDatesError } = await supabase
    .from('google_trends_interest')
    .delete()
    .eq('geo', geo)
    .eq('timeframe', timeframe)
    .lt('interest_date', cutoffDay)
  if (oldDatesError && !oldDatesError.message.includes('does not exist')) {
    throw new Error(oldDatesError.message)
  }
}

function isRateLimitError(error) {
  const msg = error instanceof Error ? error.message : String(error)
  if (/429|rate.?limit/i.test(msg)) return true
  if (error && typeof error === 'object') {
    const e = error
    if (e.status === 429) return true
    if (e.code === 'RATE_LIMIT_ERROR' || e._tag === 'RateLimitError') return true
  }
  return false
}

function makeTrendsClient() {
  return createTrendsClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 120_000,
    userAgent: CHROME_UA,
    cookieStore: new MemoryCookieStore(),
    retries: { maxRetries: 2, baseDelayMs: 8_000, maxDelayMs: 45_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 4_000 },
  })
}

/** Um cliente por execução — preserva cookies/sessão entre chamadas. */
let sharedTrendsClient = null
function getTrendsClient() {
  if (!sharedTrendsClient) sharedTrendsClient = makeTrendsClient()
  return sharedTrendsClient
}

function labelFromRelatedItem(item, kind) {
  if (kind === 'query') {
    if (typeof item.query === 'string' && item.query.trim()) return item.query.trim()
  }
  if (kind === 'topic') {
    if (item.topic && typeof item.topic.title === 'string' && item.topic.title.trim()) {
      return item.topic.title.trim()
    }
    if (typeof item.topic_title === 'string' && item.topic_title.trim()) return item.topic_title.trim()
  }
  if (typeof item.title === 'string' && item.title.trim()) return item.title.trim()
  return null
}

function mapRelatedRows(items, kind, bucket, actor, geo, timeframe, collectedAt) {
  const rows = []
  for (let i = 0; i < Math.min(items.length, MAX_RELATED_PER_BUCKET); i++) {
    const item = items[i]
    const label = labelFromRelatedItem(item, kind)
    if (!label) continue
    const valueScore = typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : null
    rows.push({
      politico_id: actor.id,
      search_term: actor.name,
      kind,
      bucket,
      label,
      value_score: valueScore,
      formatted_value: typeof item.formattedValue === 'string' ? item.formattedValue : null,
      explore_link: typeof item.link === 'string' ? item.link : null,
      rank: i + 1,
      geo,
      timeframe,
      collected_at: collectedAt,
    })
  }
  return rows
}

async function withRetry(label, fn) {
  let backoffMs = INITIAL_BACKOFF_MS
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRetryable(error) || attempt >= MAX_ATTEMPTS) {
        throw error instanceof Error ? error : new Error(String(error))
      }
      const rateLimited = isRateLimitError(error)
      const waitMs = rateLimited ? Math.max(backoffMs, RATE_LIMIT_BACKOFF_MS) : backoffMs
      console.error(
        `[collect-google-trends] retry ${attempt}/${MAX_ATTEMPTS} (${label}): ${error instanceof Error ? error.message : error}`
      )
      await sleep(waitMs + Math.floor(Math.random() * 3_000))
      backoffMs = Math.min(Math.round(backoffMs * (rateLimited ? 2 : 1.5)), MAX_BACKOFF_MS)
    }
  }
  throw new Error(`Falha após ${MAX_ATTEMPTS} tentativas (${label}).`)
}

async function fetchBatchInterest(batch, geo, timeframe, collectedAt) {
  const keywords = batch.map((a) => a.name)
  return withRetry(keywords.join(', '), async () => {
    const trends = getTrendsClient()
    const result = await trends.interestOverTime({
      keywords,
      geo,
      time: timeframe,
      hl: 'pt-BR',
      tz: 180,
    })

    const drafts = buildInterestRowsFromTimeline(result.data.timeline, batch)
    const rows = drafts.map((draft) => ({
      ...draft,
      geo,
      timeframe,
      collected_at: collectedAt,
    }))
    return rows
  })
}

async function fetchActorRelated(actor, geo, timeframe, collectedAt) {
  return withRetry(`${actor.name} (related)`, async () => {
    const trends = getTrendsClient()
    const input = {
      keywords: [actor.name],
      geo,
      time: timeframe,
      hl: 'pt-BR',
      tz: 180,
    }
    const queries = await trends.relatedQueries(input)
    await sleep(PAUSE_BETWEEN_RELATED_MS)
    const topics = await trends.relatedTopics(input)

    return [
      ...mapRelatedRows(queries.data.top ?? [], 'query', 'top', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows(queries.data.rising ?? [], 'query', 'rising', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows(topics.data.top ?? [], 'topic', 'top', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows(topics.data.rising ?? [], 'topic', 'rising', actor, geo, timeframe, collectedAt),
    ]
  })
}

async function main() {
  loadEnvLocal()
  const { geo, timeframe, skipRelated, terms } = parseArgs()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    emit({ ok: false, error: 'Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local' })
    process.exit(1)
  }

  const supabase = createSupabase(url, key)

  let actors = []
  if (Array.isArray(terms) && terms.length > 0) {
    actors = terms.map((name) => ({ id: null, name: String(name) }))
  } else {
    const { data, error: actorsError } = await supabase
      .from('political_actors')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true })

    if (actorsError) {
      const msg = actorsError.message
      if (msg.includes('does not exist') || actorsError.code === '42P01') {
        emit({ ok: false, error: 'Tabelas ausentes.', setupRequired: true })
        process.exit(1)
      }
      emit({ ok: false, error: msg })
      process.exit(1)
    }
    actors = data ?? []
  }

  if (!actors?.length) {
    emit({
      ok: true,
      terms: 0,
      termsSucceeded: 0,
      rowsUpserted: 0,
      relatedRowsUpserted: 0,
      geo,
      timeframe,
      errors: [],
    })
    return
  }

  const collectedAt = new Date().toISOString()
  let rowsUpserted = 0
  let relatedRowsUpserted = 0
  let termsSucceeded = 0
  const errors = []

  for (let i = 0; i < actors.length; i += KEYWORDS_PER_BATCH) {
    const batch = actors.slice(i, i + KEYWORDS_PER_BATCH)
    try {
      const rows = await fetchBatchInterest(batch, geo, timeframe, collectedAt)
      if (rows.length > 0) {
        const { error } = await supabase.from('google_trends_interest').upsert(rows, {
          onConflict: 'search_term,interest_date,geo,timeframe',
        })
        if (error) throw new Error(error.message)
        rowsUpserted += rows.length
      }
      termsSucceeded += batch.length
    } catch (e) {
      errors.push(`${batch.map((a) => a.name).join(', ')}: ${e instanceof Error ? e.message : 'Erro'}`)
    }
    if (i + KEYWORDS_PER_BATCH < actors.length) {
      await sleep(PAUSE_AFTER_BATCH_MS)
    }
  }

  if (!skipRelated) {
  for (let actorIndex = 0; actorIndex < actors.length; actorIndex++) {
    const actor = actors[actorIndex]
    try {
      const relatedRows = await fetchActorRelated(actor, geo, timeframe, collectedAt)
      const { error: deleteError } = await supabase
        .from('google_trends_related')
        .delete()
        .eq('search_term', actor.name)
        .eq('geo', geo)
        .eq('timeframe', timeframe)
      if (deleteError) {
        if (deleteError.message.includes('does not exist') || deleteError.code === '42P01') {
          errors.push(
            `${actor.name} (related): execute database/create-google-trends-related.sql no Supabase`
          )
          continue
        }
        throw new Error(deleteError.message)
      }
      if (relatedRows.length > 0) {
        const { error: insertError } = await supabase.from('google_trends_related').insert(relatedRows)
        if (insertError) throw new Error(insertError.message)
        relatedRowsUpserted += relatedRows.length
      }
    } catch (e) {
      errors.push(`${actor.name} (related): ${e instanceof Error ? e.message : 'Erro'}`)
    }
    if (actorIndex < actors.length - 1) {
      await sleep(PAUSE_BETWEEN_ACTORS_MS)
    }
  }
  }

  if (rowsUpserted === 0 && errors.length > 0) {
    emit({ ok: false, error: errors[0], geo, timeframe, errors })
    process.exit(1)
  }

  if (rowsUpserted > 0) {
    try {
      await pruneStaleGoogleTrendsInterest(supabase, geo, timeframe, interestQueryCutoffDay())
    } catch (e) {
      errors.push(`limpeza: ${e instanceof Error ? e.message : 'Erro'}`)
    }
  }

  emit({
    ok: true,
    terms: actors.length,
    termsSucceeded,
    rowsUpserted,
    relatedRowsUpserted,
    geo,
    timeframe,
    errors,
  })
}

main().catch((e) => {
  emit({ ok: false, error: e instanceof Error ? e.message : String(e) })
  process.exit(1)
})
