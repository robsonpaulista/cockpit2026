import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export type { GoogleTrendsTimeframe } from '@/lib/google-trends-timeframe'

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
  searchContext: GoogleTrendsSearchContext | null
}

export type GoogleTrendsRelatedKind = 'query' | 'topic'
export type GoogleTrendsRelatedBucket = 'top' | 'rising'

export type GoogleTrendsRelatedRow = {
  id: string
  politico_id: string | null
  search_term: string
  kind: GoogleTrendsRelatedKind
  bucket: GoogleTrendsRelatedBucket
  label: string
  value_score: number | null
  formatted_value: string | null
  explore_link: string | null
  rank: number
  geo: string
  timeframe: string
  collected_at: string
}

export type GoogleTrendsRelatedItem = {
  label: string
  formattedValue: string | null
  valueScore: number | null
  exploreLink: string | null
  rank: number
  kind: GoogleTrendsRelatedKind
  bucket: GoogleTrendsRelatedBucket
}

export type GoogleTrendsSearchContext = {
  searchTerm: string
  politicoId: string | null
  slug: string | null
  name: string
  queriesTop: GoogleTrendsRelatedItem[]
  queriesRising: GoogleTrendsRelatedItem[]
  topicsTop: GoogleTrendsRelatedItem[]
  topicsRising: GoogleTrendsRelatedItem[]
  hasData: boolean
}

export type GoogleTrendsCollectResult = {
  ok: boolean
  terms?: number
  termsSucceeded?: number
  rowsUpserted?: number
  relatedRowsUpserted?: number
  geo?: string
  timeframe?: string
  errors?: string[]
  error?: string
  setupRequired?: boolean
  detail?: string
}
