import { createAdminClient } from '@/lib/supabase/admin'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'

const BATCH_SIZE = 5
const BATCH_PAUSE_MS = 4000

type ActorRow = {
  id: string
  name: string
}

type InterestRowInsert = {
  politico_id: string
  search_term: string
  interest_date: string
  interest_score: number
  geo: string
  timeframe: string
  collected_at: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function interestDateFromPoint(time: string, formattedTime?: string): string {
  const asNum = Number(time)
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10)
  if (formattedTime) {
    const parsed = Date.parse(formattedTime)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  }
  throw new Error(`Data Trends inválida: ${time}`)
}

async function loadActiveActors(): Promise<ActorRow[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('political_actors')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      throw new Error(
        'Tabelas do radar ainda não existem. Execute database/create-youtube-radar-tables.sql no Supabase.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []) as ActorRow[]
}

async function upsertInterestRows(rows: InterestRowInsert[]): Promise<number> {
  if (rows.length === 0) return 0

  const supabase = createAdminClient()
  const UPSERT_BATCH = 200
  let total = 0

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const chunk = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase.from('google_trends_interest').upsert(chunk, {
      onConflict: 'search_term,interest_date,geo,timeframe',
    })
    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        throw new Error(
          'Tabela google_trends_interest ausente. Execute database/create-google-trends-tables.sql no Supabase.'
        )
      }
      throw new Error(error.message)
    }
    total += chunk.length
  }

  return total
}

export async function collectGoogleTrends(options: {
  geo?: string
  timeframe?: GoogleTrendsTimeframe
}): Promise<GoogleTrendsCollectResult> {
  const geo = options.geo ?? 'BR-PI'
  const timeframe = options.timeframe ?? 'today 3-m'

  const actors = await loadActiveActors()
  if (actors.length === 0) {
    return { ok: true, terms: 0, rowsUpserted: 0, geo, timeframe, errors: [] }
  }

  const { createClient: createTrendsClient } = await import('trendsearch')
  const trends = createTrendsClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 30_000,
    retries: { maxRetries: 4, baseDelayMs: 2_000, maxDelayMs: 30_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 3_000 },
  })

  const collectedAt = new Date().toISOString()
  const allRows: InterestRowInsert[] = []
  const errors: string[] = []

  for (let i = 0; i < actors.length; i += BATCH_SIZE) {
    const batch = actors.slice(i, i + BATCH_SIZE)
    const keywords = batch.map((a) => a.name)
    const termToPolitico = new Map(batch.map((a) => [a.name, a.id]))

    try {
      const result = await trends.interestOverTime({
        keywords,
        geo,
        time: timeframe,
        hl: 'pt-BR',
        tz: 180,
      })

      for (const point of result.data.timeline) {
        const interestDate = interestDateFromPoint(point.time, point.formattedTime)
        batch.forEach((actor, idx) => {
          const raw = point.value[idx]
          const score = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
          allRows.push({
            politico_id: termToPolitico.get(actor.name) ?? actor.id,
            search_term: actor.name,
            interest_date: interestDate,
            interest_score: Math.max(0, Math.min(100, score)),
            geo,
            timeframe,
            collected_at: collectedAt,
          })
        })
      }
    } catch (e) {
      errors.push(`${keywords.join(', ')}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
    }

    if (i + BATCH_SIZE < actors.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  const rowsUpserted = await upsertInterestRows(allRows)

  if (rowsUpserted === 0 && errors.length > 0) {
    throw new Error(errors[0] ?? 'Google Trends bloqueou a coleta (rate limit). Tente novamente em alguns minutos.')
  }

  return {
    ok: true,
    terms: actors.length,
    rowsUpserted,
    geo,
    timeframe,
    errors,
  }
}
