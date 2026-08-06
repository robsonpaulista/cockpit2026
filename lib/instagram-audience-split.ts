/**
 * Breakdown seguidor / não-seguidor via Instagram Graph Insights
 * (`metric_type=total_value` + `follow_type` / `follower_type`).
 */

export type InstagramAudienceSplit = {
  total: number
  followers: number
  nonFollowers: number
}

type InsightResultRow = {
  dimension_values?: string[]
  value?: number
}

type InsightBreakdownBlock = {
  dimension_keys?: string[]
  results?: InsightResultRow[]
}

type InsightMetricPayload = {
  data?: Array<{
    name?: string
    total_value?: {
      value?: number
      breakdowns?: InsightBreakdownBlock[]
    }
  }>
  error?: { message?: string; code?: number }
}

function isFollowerLabel(raw: string): boolean {
  const n = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!n) return false
  if (n.includes('non') || n.includes('nao') || n === 'f') return false
  return n.includes('follower') || n === 't' || n === 'follow'
}

function isNonFollowerLabel(raw: string): boolean {
  const n = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!n) return false
  return (
    n.includes('non_follower') ||
    n.includes('non-follower') ||
    n.includes('nao') ||
    n === 'f' ||
    n.includes('nonfollower')
  )
}

/** Interpreta o JSON de insights com breakdown de audiência. */
export function parseAudienceSplitFromInsights(
  payload: InsightMetricPayload,
  metricName: string,
): InstagramAudienceSplit | null {
  const metric = (payload.data ?? []).find((m) => m.name === metricName)
  const totalRaw = metric?.total_value?.value
  const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : 0
  const blocks = metric?.total_value?.breakdowns ?? []
  let followers = 0
  let nonFollowers = 0

  for (const block of blocks) {
    for (const row of block.results ?? []) {
      const label = (row.dimension_values ?? []).join(' ')
      const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : 0
      if (isNonFollowerLabel(label)) nonFollowers += value
      else if (isFollowerLabel(label)) followers += value
    }
  }

  if (total <= 0 && followers <= 0 && nonFollowers <= 0) return null
  const resolvedTotal = total > 0 ? total : followers + nonFollowers
  return {
    total: resolvedTotal,
    followers,
    nonFollowers,
  }
}

function unixDaysAgo(days: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return Math.floor(d.getTime() / 1000)
}

function rangeParamsForTimeRange(timeRange: string): string {
  const until = Math.floor(Date.now() / 1000)
  switch (timeRange) {
    case '1d':
      return `since=${unixDaysAgo(1)}&until=${until}`
    case '7d':
      return `since=${unixDaysAgo(7)}&until=${until}`
    case '14d':
      return `since=${unixDaysAgo(14)}&until=${until}`
    case '28d':
      return `since=${unixDaysAgo(28)}&until=${until}`
    case '60d':
      return `since=${unixDaysAgo(60)}&until=${until}`
    case '90d':
      return `since=${unixDaysAgo(90)}&until=${until}`
    default:
      return `since=${unixDaysAgo(30)}&until=${until}`
  }
}

export type InstagramDailyMetricPoint = {
  date: string
  value: number
}

type DayInsightPayload = {
  data?: Array<{
    name?: string
    values?: Array<{ value?: number; end_time?: string }>
  }>
  error?: { message?: string }
}

/** Converte values[] de insights period=day em pontos YYYY-MM-DD (America/Sao_Paulo). */
export function parseDailyInsightSeries(
  payload: DayInsightPayload,
  metricName: string,
): InstagramDailyMetricPoint[] {
  const metric = (payload.data ?? []).find((m) => m.name === metricName)
  const byDate = new Map<string, number>()

  for (const row of metric?.values ?? []) {
    const endTime = row.end_time
    if (!endTime) continue
    // Meta: end_time é o fim exclusivo do intervalo diário.
    const end = new Date(endTime)
    if (Number.isNaN(end.getTime())) continue
    end.setTime(end.getTime() - 1000)
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(end)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : 0
    byDate.set(date, (byDate.get(date) ?? 0) + value)
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Série diária de `views` e `reach` (substitui impressions depreciada).
 * Tenta time_series explícito e, se falhar, period=day simples.
 */
export async function fetchInstagramDailyViewsReach(opts: {
  igUserId: string
  accessToken: string
  timeRange?: string
  cacheBuster?: string
}): Promise<{
  views: InstagramDailyMetricPoint[]
  reach: InstagramDailyMetricPoint[]
}> {
  const { igUserId, accessToken, timeRange = '30d', cacheBuster = '' } = opts
  const range = rangeParamsForTimeRange(timeRange)
  const base = `https://graph.facebook.com/v21.0/${igUserId}/insights`
  const tokenQ = `&access_token=${encodeURIComponent(accessToken)}${cacheBuster}`

  const tryFetch = async (query: string): Promise<DayInsightPayload | null> => {
    try {
      const res = await fetch(`${base}?${query}${tokenQ}`)
      const payload = (await res.json()) as DayInsightPayload
      if (!res.ok) return null
      return payload
    } catch {
      return null
    }
  }

  const payloads = await Promise.all([
    tryFetch(`metric=views,reach&period=day&metric_type=time_series&${range}`),
    tryFetch(`metric=views,reach&period=day&${range}`),
    tryFetch(`metric=views&period=day&metric_type=time_series&${range}`),
    tryFetch(`metric=views&period=day&${range}`),
  ])

  for (const payload of payloads) {
    if (!payload) continue
    const views = parseDailyInsightSeries(payload, 'views')
    const reach = parseDailyInsightSeries(payload, 'reach')
    if (views.length > 0 || reach.length > 0) {
      return { views, reach }
    }
  }

  return { views: [], reach: [] }
}

/**
 * Busca views/reach com split seguidor × não-seguidor.
 * Usa Graph v21+ (métrica `views` + breakdowns atuais).
 */
export async function fetchInstagramAudienceSplit(opts: {
  igUserId: string
  accessToken: string
  timeRange?: string
  cacheBuster?: string
}): Promise<{
  views: InstagramAudienceSplit | null
  reach: InstagramAudienceSplit | null
}> {
  const { igUserId, accessToken, timeRange = '30d', cacheBuster = '' } = opts
  const range = rangeParamsForTimeRange(timeRange)
  const base = `https://graph.facebook.com/v21.0/${igUserId}/insights`
  const common =
    `period=day&metric_type=total_value&${range}` +
    `&access_token=${encodeURIComponent(accessToken)}${cacheBuster}`

  const fetchMetric = async (
    metric: 'views' | 'reach',
    breakdown: 'follower_type' | 'follow_type',
  ): Promise<InstagramAudienceSplit | null> => {
    try {
      const url = `${base}?metric=${metric}&breakdown=${breakdown}&${common}`
      const res = await fetch(url)
      const payload = (await res.json()) as InsightMetricPayload
      if (!res.ok) return null
      return parseAudienceSplitFromInsights(payload, metric)
    } catch {
      return null
    }
  }

  // Docs: views → follower_type; reach → follow_type (com fallback cruzado).
  const [viewsPrimary, reachPrimary] = await Promise.all([
    fetchMetric('views', 'follower_type'),
    fetchMetric('reach', 'follow_type'),
  ])

  const [viewsFallback, reachFallback] = await Promise.all([
    viewsPrimary ? Promise.resolve(null) : fetchMetric('views', 'follow_type'),
    reachPrimary ? Promise.resolve(null) : fetchMetric('reach', 'follower_type'),
  ])

  return {
    views: viewsPrimary ?? viewsFallback,
    reach: reachPrimary ?? reachFallback,
  }
}

export type InstagramProductTypeViews = {
  story: number
  reel: number
  feed: number
  ad: number
  total: number
}

function classifyProductType(raw: string): keyof Omit<InstagramProductTypeViews, 'total'> | null {
  const n = raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!n) return null
  if (n.includes('STORY')) return 'story'
  if (n.includes('REEL')) return 'reel'
  if (n.includes('AD')) return 'ad'
  if (n.includes('FEED') || n.includes('POST') || n.includes('CAROUSEL')) return 'feed'
  return null
}

/** Extrai totais por superfície (STORY / REEL / FEED / AD) de insights total_value. */
export function parseProductTypeViewsFromInsights(
  payload: InsightMetricPayload,
  metricName: string = 'views',
): InstagramProductTypeViews | null {
  const metric = (payload.data ?? []).find((m) => m.name === metricName)
  const totalRaw = metric?.total_value?.value
  const total = typeof totalRaw === 'number' && Number.isFinite(totalRaw) ? totalRaw : 0
  const blocks = metric?.total_value?.breakdowns ?? []
  const out: InstagramProductTypeViews = {
    story: 0,
    reel: 0,
    feed: 0,
    ad: 0,
    total: 0,
  }

  for (const block of blocks) {
    for (const row of block.results ?? []) {
      const label = (row.dimension_values ?? []).join(' ')
      const value = typeof row.value === 'number' && Number.isFinite(row.value) ? row.value : 0
      const key = classifyProductType(label)
      if (key) out[key] += value
    }
  }

  const sumParts = out.story + out.reel + out.feed + out.ad
  if (total <= 0 && sumParts <= 0) return null
  out.total = total > 0 ? total : sumParts
  return out
}

function dateKeysForTimeRange(timeRange: string): string[] {
  let days = 30
  switch (timeRange) {
    case '1d':
      days = 1
      break
    case '7d':
      days = 7
      break
    case '14d':
      days = 14
      break
    case '28d':
      days = 28
      break
    case '60d':
      days = 60
      break
    case '90d':
      days = 90
      break
    default:
      days = 30
  }

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m, d] = today.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return []
  const base = new Date(Date.UTC(y, m - 1, d))
  const out: string[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const dt = new Date(base)
    dt.setUTCDate(base.getUTCDate() - i)
    out.push(dt.toISOString().slice(0, 10))
  }
  return out
}

/** Meia-noite BRT (sem horário de verão) como unix — janela diária na Graph. */
function unixBoundsForDateKey(dateKey: string): { since: number; until: number } | null {
  const [y, m, d] = dateKey.split('-').map((p) => Number.parseInt(p, 10))
  if (!y || !m || !d) return null
  // America/Sao_Paulo = UTC-3 → 00:00 BRT = 03:00 UTC
  const since = Math.floor(Date.UTC(y, m - 1, d, 3, 0, 0) / 1000)
  return { since, until: since + 86_400 }
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const idx = next
      next += 1
      results[idx] = await worker(items[idx] as T)
    }
  })
  await Promise.all(runners)
  return results
}

/**
 * Views da conta quebradas por superfície (Stories / Reels / Feed / Ads).
 * Usa `metric=views&metric_type=total_value&breakdown=media_product_type`.
 */
export async function fetchInstagramViewsByProductType(opts: {
  igUserId: string
  accessToken: string
  timeRange?: string
  since?: number
  until?: number
  cacheBuster?: string
}): Promise<InstagramProductTypeViews | null> {
  const {
    igUserId,
    accessToken,
    timeRange = '30d',
    since,
    until,
    cacheBuster = '',
  } = opts
  const range =
    since != null && until != null
      ? `since=${since}&until=${until}`
      : rangeParamsForTimeRange(timeRange)
  const url =
    `https://graph.facebook.com/v21.0/${igUserId}/insights` +
    `?metric=views&period=day&metric_type=total_value&breakdown=media_product_type` +
    `&${range}&access_token=${encodeURIComponent(accessToken)}${cacheBuster}`

  try {
    const res = await fetch(url)
    const payload = (await res.json()) as InsightMetricPayload
    if (!res.ok) return null
    return parseProductTypeViewsFromInsights(payload, 'views')
  } catch {
    return null
  }
}

/**
 * Série de visualizações só de Stories (breakdown STORY).
 * - Total do período: 1 chamada agregada
 * - Sparklines: amostragem diária (7/14) ou a cada 2–3 dias (28/60+) para respeitar rate limit
 */
export async function fetchInstagramDailyStoryViews(opts: {
  igUserId: string
  accessToken: string
  timeRange?: string
  cacheBuster?: string
}): Promise<{
  daily: InstagramDailyMetricPoint[]
  total: number
  byProduct: InstagramProductTypeViews | null
}> {
  const { igUserId, accessToken, timeRange = '30d', cacheBuster = '' } = opts
  const byProduct = await fetchInstagramViewsByProductType({
    igUserId,
    accessToken,
    timeRange,
    cacheBuster,
  })

  const dateKeys = dateKeysForTimeRange(timeRange)
  // No máx. ~8 pontos no sparkline (rate limit da Graph).
  const step = Math.max(1, Math.ceil(dateKeys.length / 8))
  const sampleKeys = dateKeys.filter(
    (_, i) => i % step === 0 || i === dateKeys.length - 1,
  )

  const daily = await mapPool(sampleKeys, 6, async (date) => {
    const bounds = unixBoundsForDateKey(date)
    if (!bounds) return { date, value: 0 }
    const part = await fetchInstagramViewsByProductType({
      igUserId,
      accessToken,
      since: bounds.since,
      until: bounds.until,
      cacheBuster,
    })
    return { date, value: part?.story ?? 0 }
  })

  const sumDaily = daily.reduce((s, p) => s + p.value, 0)
  const total = byProduct?.story && byProduct.story > 0 ? byProduct.story : sumDaily

  return { daily, total, byProduct }
}
