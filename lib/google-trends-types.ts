import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export type GoogleTrendsTimeframe = 'today 3-m' | 'today 1-m' | 'today 7-d'

export type GoogleTrendsInterestRow = {
  id: string
  politico_id: string | null
  search_term: string
  interest_date: string
  interest_score: number
  geo: string
  timeframe: string
  collected_at: string
}

export type GoogleTrendsInterestPoint = {
  date: string
  score: number
}

export type GoogleTrendsSeries = {
  searchTerm: string
  politicoId: string | null
  slug: string | null
  name: string
  actorType: PoliticalActorType | null
  points: GoogleTrendsInterestPoint[]
}

export type GoogleTrendsCompareRow = {
  searchTerm: string
  politicoId: string | null
  slug: string | null
  name: string
  actorType: PoliticalActorType | null
  avgRecent: number
  avgPrevious: number
  growthPct: number | null
  peakScore: number
  peakDate: string | null
  latestScore: number
  trendAlert: boolean
  points: GoogleTrendsInterestPoint[]
}

export type GoogleTrendsCollectResult = {
  ok: boolean
  terms?: number
  rowsUpserted?: number
  geo?: string
  timeframe?: string
  errors?: string[]
  error?: string
  setupRequired?: boolean
  detail?: string
}
