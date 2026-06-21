import type { MetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export type MetaAdsTargetLocation = {
  name: string
  excluded?: boolean
}

export type MetaAdsDeliveryRegion = {
  region: string
  pct: number | null
}

export type MetaAdsMentionRow = {
  id: string
  politico_id: string
  search_term: string
  library_ad_id: string
  page_name: string | null
  page_id: string | null
  ad_body: string | null
  library_url: string
  platforms: string | null
  started_running_at: string | null
  ended_running_at: string | null
  is_active: boolean | null
  payer_name: string | null
  spend_text: string | null
  spend_min_brl: number | null
  spend_max_brl: number | null
  impressions_text: string | null
  audience_size_text: string | null
  ads_in_group: number | null
  target_locations_text: string | null
  target_locations: MetaAdsTargetLocation[] | null
  delivery_by_region_text: string | null
  delivery_by_region: MetaAdsDeliveryRegion[] | null
  collected_at: string
  created_at: string
  updated_at: string
}

export type MetaAdsMentionWithActor = MetaAdsMentionRow & {
  political_actors: {
    id: string
    name: string
    slug: string
    actor_type: PoliticalActorType
  } | null
}

export type MetaAdsCollectActorResult = {
  politicoId: string
  politicoName: string
  adsFound: number
  adsInserted: number
  adsUpdated: number
  errors: string[]
}

export type MetaAdsCollectScriptResult = {
  ok: boolean
  error?: string
  results?: MetaAdsCollectActorResult[]
  totals?: {
    adsFound: number
    adsInserted: number
    adsUpdated: number
    errors: string[]
  }
}

export type MetaAdsCollectStatus = {
  canCollect: boolean
  dailyLimitEnabled: boolean
  cooldownHours: number
  lastCollectStartedAt: string | null
  lastCollectFinishedAt: string | null
  lastCollectSuccess: boolean | null
  nextCollectAt: string | null
  hoursUntilNextCollect: number | null
  collectInProgress: boolean
  progress: MetaAdsCollectProgress | null
  runnerAvailable: boolean
  runnerMessage?: string | null
}

export const META_ADS_DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000

export function isMetaAdsDailyLimitEnabled(): boolean {
  const v = process.env.META_ADS_SKIP_DAILY_LIMIT?.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes') return false
  return true
}
