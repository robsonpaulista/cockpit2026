import { createAdminClient } from '@/lib/supabase/admin'
import type {
  GoogleTrendingHours,
  GoogleTrendingTopicsCollectResult,
} from '@/lib/google-trending-topics-types'
import {
  DEFAULT_GOOGLE_TRENDING_GEO,
  DEFAULT_GOOGLE_TRENDING_HOURS,
} from '@/lib/google-trending-topics-types'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

async function makeTrendsClient() {
  const mod = await import('trendsearch')
  return mod.createClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 90_000,
    userAgent: CHROME_UA,
    cookieStore: new mod.MemoryCookieStore(),
    retries: { maxRetries: 2, baseDelayMs: 4_000, maxDelayMs: 25_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 2_000 },
  })
}

export async function runGoogleTrendingTopicsCollect(options?: {
  geo?: string
  hours?: GoogleTrendingHours
}): Promise<GoogleTrendingTopicsCollectResult> {
  const geo = (options?.geo ?? DEFAULT_GOOGLE_TRENDING_GEO).trim().toUpperCase() || DEFAULT_GOOGLE_TRENDING_GEO
  const hours = options?.hours ?? DEFAULT_GOOGLE_TRENDING_HOURS
  const collectedAt = new Date().toISOString()

  try {
    const client = await makeTrendsClient()
    const response = await client.trendingNow({
      geo,
      language: 'pt',
      hours,
    })

    const items = response.data.items
    if (items.length === 0) {
      return {
        ok: false,
        geo,
        hours,
        collectedAt,
        itemsUpserted: 0,
        keywords: [],
        error: 'Google Trends retornou lista vazia (possível rate limit ou mudança de endpoint).',
      }
    }

    const rows = items
      .map((item, index) => {
        const keyword = item.keyword.trim()
        if (!keyword) return null
        return {
          collected_at: collectedAt,
          geo,
          hours,
          rank: index + 1,
          keyword,
          traffic: Number.isFinite(item.traffic) ? Math.round(item.traffic) : null,
          traffic_growth_rate: Number.isFinite(item.trafficGrowthRate) ? item.trafficGrowthRate : null,
          related_keywords: item.relatedKeywords.map((k) => k.trim()).filter(Boolean).slice(0, 12),
          active_time: item.activeTime || null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    if (rows.length === 0) {
      return {
        ok: false,
        geo,
        hours,
        collectedAt,
        itemsUpserted: 0,
        keywords: [],
        error: 'Nenhum termo válido na resposta do Google Trends.',
      }
    }

    const supabase = createAdminClient()
    const { error } = await supabase.from('google_trending_topics').upsert(rows, {
      onConflict: 'collected_at,geo,hours,rank',
    })

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return {
          ok: false,
          geo,
          hours,
          collectedAt,
          itemsUpserted: 0,
          keywords: [],
          error: 'Tabela google_trending_topics ausente. Execute database/create-google-trending-topics.sql.',
        }
      }
      throw new Error(error.message)
    }

    return {
      ok: true,
      geo,
      hours,
      collectedAt,
      itemsUpserted: rows.length,
      keywords: rows.map((r) => r.keyword),
    }
  } catch (e) {
    return {
      ok: false,
      geo,
      hours,
      collectedAt,
      itemsUpserted: 0,
      keywords: [],
      error: e instanceof Error ? e.message : 'Falha na coleta de temas em alta.',
    }
  }
}
