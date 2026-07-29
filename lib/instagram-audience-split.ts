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
    case '90d':
      return `since=${unixDaysAgo(90)}&until=${until}`
    default:
      return `since=${unixDaysAgo(30)}&until=${until}`
  }
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
