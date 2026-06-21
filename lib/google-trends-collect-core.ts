import { createAdminClient } from '@/lib/supabase/admin'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'

const KEYWORDS_PER_BATCH = 5
const MAX_RELATED_PER_BUCKET = 10
const MAX_ATTEMPTS = 5
const INITIAL_BACKOFF_MS = 8_000
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

type PoliticalActorRow = { id: string; name: string }

type RelatedKind = 'query' | 'topic'

type InterestRow = {
  politico_id: string
  search_term: string
  interest_date: string
  interest_score: number
  geo: string
  timeframe: string
  collected_at: string
}

type RelatedInsertRow = {
  politico_id: string
  search_term: string
  kind: RelatedKind
  bucket: 'top' | 'rising'
  label: string
  value_score: number | null
  formatted_value: string | null
  explore_link: string | null
  rank: number
  geo: string
  timeframe: string
  collected_at: string
}

type RelatedItem = {
  query?: string
  topic?: { title?: string }
  topic_title?: string
  title?: string
  value?: number
  formattedValue?: string
  link?: string
}

type TimelinePoint = {
  time: string | number
  formattedTime?: string
  value: number[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  if (/429|rate.?limit|fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|socket/i.test(msg)) {
    return true
  }
  if (error && typeof error === 'object') {
    const e = error as { status?: number; code?: string; _tag?: string }
    if (e.status === 429) return true
    if (e.code === 'RATE_LIMIT_ERROR' || e.code === 'TRANSPORT_ERROR') return true
    if (e._tag === 'RateLimitError' || e._tag === 'TransportError') return true
  }
  return false
}

function interestDateFromPoint(time: string | number, formattedTime?: string): string {
  const asNum = Number(time)
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }
  if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10)
  if (formattedTime) {
    const parsed = Date.parse(formattedTime)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  }
  throw new Error(`Data Trends inválida: ${time}`)
}

async function loadTrendsearch() {
  const mod = await import('trendsearch')
  return {
    createTrendsClient: mod.createClient,
    MemoryCookieStore: mod.MemoryCookieStore,
  }
}

async function makeTrendsClient() {
  const { createTrendsClient, MemoryCookieStore } = await loadTrendsearch()
  return createTrendsClient({
    hl: 'pt-BR',
    tz: 180,
    timeoutMs: 120_000,
    userAgent: CHROME_UA,
    cookieStore: new MemoryCookieStore(),
    retries: { maxRetries: 3, baseDelayMs: 4_000, maxDelayMs: 30_000 },
    rateLimit: { maxConcurrent: 1, minDelayMs: 6_000 },
  })
}

function labelFromRelatedItem(item: RelatedItem, kind: RelatedKind): string | null {
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

function mapRelatedRows(
  items: RelatedItem[],
  kind: RelatedKind,
  bucket: 'top' | 'rising',
  actor: PoliticalActorRow,
  geo: string,
  timeframe: string,
  collectedAt: string
): RelatedInsertRow[] {
  const rows: RelatedInsertRow[] = []
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

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let backoffMs = INITIAL_BACKOFF_MS
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (!isRetryable(error) || attempt >= MAX_ATTEMPTS) {
        throw error instanceof Error ? error : new Error(String(error))
      }
      console.error(
        `[google-trends-collect] retry ${attempt}/${MAX_ATTEMPTS} (${label}): ${error instanceof Error ? error.message : error}`
      )
      await sleep(backoffMs)
      backoffMs = Math.min(Math.round(backoffMs * 1.5), 60_000)
    }
  }
  throw new Error(`Falha após ${MAX_ATTEMPTS} tentativas (${label}).`)
}

async function fetchBatchInterest(
  batch: PoliticalActorRow[],
  geo: string,
  timeframe: string,
  collectedAt: string
) {
  const keywords = batch.map((a) => a.name)
  return withRetry(keywords.join(', '), async () => {
    const trends = await makeTrendsClient()
    const result = await trends.interestOverTime({
      keywords,
      geo,
      time: timeframe,
      hl: 'pt-BR',
      tz: 180,
    })

    const rows: InterestRow[] = []
    for (const point of result.data.timeline as TimelinePoint[]) {
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
  })
}

async function fetchActorRelated(
  actor: PoliticalActorRow,
  geo: string,
  timeframe: string,
  collectedAt: string
) {
  return withRetry(`${actor.name} (related)`, async () => {
    const trends = await makeTrendsClient()
    const input = {
      keywords: [actor.name],
      geo,
      time: timeframe,
      hl: 'pt-BR',
      tz: 180,
    }
    const [queries, topics] = await Promise.all([
      trends.relatedQueries(input),
      trends.relatedTopics(input),
    ])

    return [
      ...mapRelatedRows((queries.data.top ?? []) as unknown as RelatedItem[], 'query', 'top', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows((queries.data.rising ?? []) as unknown as RelatedItem[], 'query', 'rising', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows((topics.data.top ?? []) as unknown as RelatedItem[], 'topic', 'top', actor, geo, timeframe, collectedAt),
      ...mapRelatedRows((topics.data.rising ?? []) as unknown as RelatedItem[], 'topic', 'rising', actor, geo, timeframe, collectedAt),
    ]
  })
}

export async function runGoogleTrendsCollect(options: {
  geo: string
  timeframe: GoogleTrendsTimeframe
}): Promise<GoogleTrendsCollectResult> {
  const { geo, timeframe } = options
  const supabase = createAdminClient()

  const { data: actors, error: actorsError } = await supabase
    .from('political_actors')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true })

  if (actorsError) {
    const msg = actorsError.message
    if (msg.includes('does not exist') || actorsError.code === '42P01') {
      return { ok: false, error: 'Tabelas ausentes.', setupRequired: true }
    }
    return { ok: false, error: msg }
  }

  if (!actors?.length) {
    return {
      ok: true,
      terms: 0,
      termsSucceeded: 0,
      rowsUpserted: 0,
      relatedRowsUpserted: 0,
      geo,
      timeframe,
      errors: [],
    }
  }

  const collectedAt = new Date().toISOString()
  let rowsUpserted = 0
  let relatedRowsUpserted = 0
  let termsSucceeded = 0
  const errors: string[] = []

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
  }

  for (const actor of actors) {
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
  }

  if (rowsUpserted === 0 && errors.length > 0) {
    return { ok: false, error: errors[0], geo, timeframe, errors }
  }

  return {
    ok: true,
    terms: actors.length,
    termsSucceeded,
    rowsUpserted,
    relatedRowsUpserted,
    geo,
    timeframe,
    errors,
  }
}
