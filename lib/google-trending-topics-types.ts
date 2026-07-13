export const GOOGLE_TRENDING_HOURS = [4, 24, 48, 168] as const

export type GoogleTrendingHours = (typeof GOOGLE_TRENDING_HOURS)[number]

export const DEFAULT_GOOGLE_TRENDING_GEO = 'BR'
export const DEFAULT_GOOGLE_TRENDING_HOURS: GoogleTrendingHours = 24

export type GoogleTrendingTopicRow = {
  id: string
  collected_at: string
  geo: string
  hours: number
  rank: number
  keyword: string
  traffic: number | null
  traffic_growth_rate: number | null
  related_keywords: string[]
  active_time: string | null
  created_at?: string
}

export type GoogleTrendingTopicsCollectResult = {
  ok: boolean
  geo: string
  hours: GoogleTrendingHours
  collectedAt: string
  itemsUpserted: number
  keywords: string[]
  error?: string
}

export function normalizeGoogleTrendingHours(value: unknown): GoogleTrendingHours | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (n === 4 || n === 24 || n === 48 || n === 168) return n
  return null
}

export function googleTrendingHoursLabel(hours: GoogleTrendingHours): string {
  if (hours === 4) return 'Últimas 4h'
  if (hours === 24) return 'Últimas 24h'
  if (hours === 48) return 'Últimas 48h'
  return 'Últimos 7 dias'
}

export function formatTrendingTraffic(traffic: number | null | undefined): string {
  if (traffic == null || !Number.isFinite(traffic)) return '—'
  if (traffic >= 1_000_000) return `${(traffic / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (traffic >= 1_000) return `${Math.round(traffic / 1_000)} mil`
  return String(Math.round(traffic))
}
