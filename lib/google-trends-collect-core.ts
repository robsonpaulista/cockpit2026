import { createAdminClient } from '@/lib/supabase/admin'
import { buildInterestRowsFromTimeline } from '@/lib/google-trends-interest-date'
import { googleTrendsInterestQueryCutoffDay } from '@/lib/google-trends-normalize-rows'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'

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

async function pruneStaleGoogleTrendsInterest(
  geo: string,
  timeframe: string,
  cutoffDay: string
): Promise<void> {
  const supabase = createAdminClient()
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

async function loadTrendsearch() {
  const mod = await import('trendsearch')
  return {
    createTrendsClient: mod.createClient,
    MemoryCookieStore: mod.MemoryCookieStore,
  }
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  if (/429|rate.?limit/i.test(msg)) return true
  if (error && typeof error === 'object') {
    const e = error as { status?: number; code?: string; _tag?: string }
    if (e.status === 429) return true
    if (e.code === 'RATE_LIMIT_ERROR' || e._tag === 'RateLimitError') return true
  }
  return false
}

type TrendsClient = Awaited<ReturnType<typeof makeTrendsClient>>
let sharedTrendsClient: TrendsClient | null = null

async function getTrendsClient(): Promise<TrendsClient> {
  if (!sharedTrendsClient) sharedTrendsClient = await makeTrendsClient()
  return sharedTrendsClient
}

async function makeTrendsClient() {
  const { createTrendsClient, MemoryCookieStore } = await loadTrendsearch()
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
      const rateLimited = isRateLimitError(error)
      const waitMs = rateLimited ? Math.max(backoffMs, RATE_LIMIT_BACKOFF_MS) : backoffMs
      console.error(
        `[google-trends-collect] retry ${attempt}/${MAX_ATTEMPTS} (${label}): ${error instanceof Error ? error.message : error}`
      )
      await sleep(waitMs + Math.floor(Math.random() * 3_000))
      backoffMs = Math.min(Math.round(backoffMs * (rateLimited ? 2 : 1.5)), MAX_BACKOFF_MS)
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
    const trends = await getTrendsClient()
    const result = await trends.interestOverTime({
      keywords,
      geo,
      time: timeframe,
      hl: 'pt-BR',
      tz: 180,
    })

    const rows: InterestRow[] = []
    const drafts = buildInterestRowsFromTimeline(result.data.timeline as TimelinePoint[], batch)
    for (const draft of drafts) {
      rows.push({
        ...draft,
        geo,
        timeframe,
        collected_at: collectedAt,
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
    const trends = await getTrendsClient()
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
  skipRelated?: boolean
}): Promise<GoogleTrendsCollectResult> {
  const { geo, timeframe, skipRelated = true } = options
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
    return { ok: false, error: errors[0], geo, timeframe, errors }
  }

  if (rowsUpserted > 0) {
    try {
      await pruneStaleGoogleTrendsInterest(geo, timeframe, googleTrendsInterestQueryCutoffDay())
    } catch (e) {
      errors.push(`limpeza: ${e instanceof Error ? e.message : 'Erro'}`)
    }
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
