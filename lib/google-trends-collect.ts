import { createAdminClient } from '@/lib/supabase/admin'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'

/** Google Trends permite até 5 termos por comparação (escala relativa comum). */
const KEYWORDS_PER_BATCH = 5
const PAUSE_BETWEEN_BATCHES_MS = 60_000
const COLLECT_COOLDOWN_MS = 3 * 60_000
const MAX_BATCH_ATTEMPTS = 8
const INITIAL_BACKOFF_MS = 30_000
const WARMUP_PAUSE_MS = 4_000

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

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

type TrendsClient = Awaited<ReturnType<typeof createTrendsClient>>

let collectInProgress = false
let lastCollectFinishedAt = 0

async function createTrendsClient() {
  const { createClient, MemoryCookieStore } = await import('trendsearch')
  return createClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 60_000,
    userAgent: CHROME_UA,
    cookieStore: new MemoryCookieStore(),
    retries: { maxRetries: 1, baseDelayMs: 8_000, maxDelayMs: 20_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 12_000 },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimited(error: unknown): boolean {
  if (!error) return false
  const msg = error instanceof Error ? error.message : String(error)
  if (/429|rate.?limit/i.test(msg)) return true
  if (typeof error === 'object') {
    const e = error as { status?: number; code?: string; _tag?: string }
    if (e.status === 429) return true
    if (e.code === 'RATE_LIMIT_ERROR') return true
    if (e._tag === 'RateLimitError') return true
  }
  return false
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

function rowsFromBatchTimeline(
  batch: ActorRow[],
  timeline: ReadonlyArray<{
    time: string
    formattedTime?: string
    value: readonly number[]
  }>,
  geo: string,
  timeframe: string,
  collectedAt: string
): InterestRowInsert[] {
  const rows: InterestRowInsert[] = []

  for (const point of timeline) {
    const interestDate = interestDateFromPoint(point.time, point.formattedTime)
    batch.forEach((actor, idx) => {
      const raw = point.value[idx]
      const score = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
      rows.push({
        politico_id: actor.id,
        search_term: actor.name,
        interest_date: interestDate,
        interest_score: Math.max(0, Math.min(100, score)),
        geo,
        timeframe,
        collected_at: collectedAt,
      })
    })
  }

  return rows
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

async function warmupTrendsSession(trends: TrendsClient, keyword: string): Promise<void> {
  try {
    await trends.autocomplete({ keyword, hl: 'pt-BR', tz: 180 })
  } catch {
    // Autocomplete opcional — só aquece cookies/sessão.
  }
  await sleep(WARMUP_PAUSE_MS)
}

async function fetchBatchInterest(
  trends: TrendsClient,
  batch: ActorRow[],
  geo: string,
  timeframe: GoogleTrendsTimeframe,
  collectedAt: string
): Promise<InterestRowInsert[]> {
  const keywords = batch.map((a) => a.name)
  let backoffMs = INITIAL_BACKOFF_MS

  for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
    try {
      const result = await trends.interestOverTime({
        keywords,
        geo,
        time: timeframe,
        hl: 'pt-BR',
        tz: 180,
      })
      return rowsFromBatchTimeline(batch, result.data.timeline, geo, timeframe, collectedAt)
    } catch (error) {
      const canRetry = isRateLimited(error) && attempt < MAX_BATCH_ATTEMPTS
      if (!canRetry) {
        throw error instanceof Error ? error : new Error(String(error))
      }
      console.warn(
        `[trends/collect] rate limit no lote (${keywords.length} nomes) · tentativa ${attempt}/${MAX_BATCH_ATTEMPTS} · aguardando ${Math.round(backoffMs / 1000)}s`
      )
      await sleep(backoffMs)
      backoffMs = Math.min(Math.round(backoffMs * 1.4), 120_000)
    }
  }

  throw new Error(
    `Google Trends bloqueou o lote (${keywords.join(', ')}). Aguarde 3–5 minutos e tente novamente.`
  )
}

function assertCollectAllowed(): void {
  if (collectInProgress) {
    throw new Error('Coleta já em andamento. Aguarde a conclusão antes de tentar de novo.')
  }

  const elapsed = Date.now() - lastCollectFinishedAt
  if (lastCollectFinishedAt > 0 && elapsed < COLLECT_COOLDOWN_MS) {
    const waitSec = Math.ceil((COLLECT_COOLDOWN_MS - elapsed) / 1000)
    throw new Error(
      `Aguarde ${waitSec}s antes de coletar novamente — o Google Trends limita requisições por IP.`
    )
  }
}

export async function collectGoogleTrends(options: {
  geo?: string
  timeframe?: GoogleTrendsTimeframe
}): Promise<GoogleTrendsCollectResult> {
  assertCollectAllowed()
  collectInProgress = true

  const geo = options.geo ?? 'BR-PI'
  const timeframe = options.timeframe ?? 'today 3-m'

  try {
    const actors = await loadActiveActors()
    if (actors.length === 0) {
      return { ok: true, terms: 0, termsSucceeded: 0, rowsUpserted: 0, geo, timeframe, errors: [] }
    }

    const trends = await createTrendsClient()
    await warmupTrendsSession(trends, actors[0].name)

    const collectedAt = new Date().toISOString()
    let rowsUpserted = 0
    let termsSucceeded = 0
    const errors: string[] = []

    for (let i = 0; i < actors.length; i += KEYWORDS_PER_BATCH) {
      const batch = actors.slice(i, i + KEYWORDS_PER_BATCH)

      try {
        const rows = await fetchBatchInterest(trends, batch, geo, timeframe, collectedAt)
        rowsUpserted += await upsertInterestRows(rows)
        termsSucceeded += batch.length
      } catch (e) {
        errors.push(`${batch.map((a) => a.name).join(', ')}: ${e instanceof Error ? e.message : 'Erro desconhecido'}`)
      }

      if (i + KEYWORDS_PER_BATCH < actors.length) {
        await sleep(PAUSE_BETWEEN_BATCHES_MS)
      }
    }

    if (rowsUpserted === 0 && errors.length > 0) {
      throw new Error(
        errors[0] ??
          'Google Trends bloqueou a coleta (rate limit). Aguarde 3–5 minutos e tente novamente.'
      )
    }

    return {
      ok: true,
      terms: actors.length,
      termsSucceeded,
      rowsUpserted,
      geo,
      timeframe,
      errors,
    }
  } finally {
    collectInProgress = false
    lastCollectFinishedAt = Date.now()
  }
}
