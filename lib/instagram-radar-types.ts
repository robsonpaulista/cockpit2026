import type { PoliticalActor } from '@/lib/youtube-radar-types'

export type InstagramRadarPost = {
  id: string
  politico_id: string
  instagram_username: string
  post_id: string
  posted_at: string | null
  post_type: string | null
  caption: string | null
  likes_count: number
  comments_count: number
  post_url: string
  thumbnail_url: string | null
  collected_at: string
  created_at: string
  updated_at: string
}

export type InstagramRadarPostWithActor = InstagramRadarPost & {
  political_actors?: Pick<PoliticalActor, 'id' | 'name' | 'slug' | 'actor_type'> | null
}

export type InstagramRadarCollectProgress = {
  phase: string
  message: string
  percent: number
  startedAt: string
  updatedAt: string
}

export type InstagramRadarCollectStatus = {
  canCollect: boolean
  cooldownEnabled: boolean
  cooldownDays: number
  lastCollectStartedAt: string | null
  lastCollectFinishedAt: string | null
  lastCollectSuccess: boolean | null
  nextCollectAt: string | null
  hoursUntilNextCollect: number | null
  collectInProgress: boolean
  apifyConfigured: boolean
  ownAccountConfigured: boolean
  ownInstagramSource?: 'env' | 'metrics_history' | 'radar_posts' | 'none'
  ownInstagramPostsInHistory?: number
  limits: {
    maxActors: number
    postsPerProfile: number
    maxChargeUsd: number
    estimatedCostPerRunUsd: number
    freeMonthlyUsd: number
  }
}

export type InstagramRadarCollectScriptResult = {
  results: Array<{
    slug: string
    username: string
    postsFound: number
    postsInserted: number
    postsUpdated: number
    source?: 'apify' | 'graph_api' | 'metrics_history'
    error?: string
  }>
  totals: {
    actorsProcessed: number
    postsFound: number
    postsInserted: number
    postsUpdated: number
    estimatedCostUsd: number
    apifyRunId: string | null
    ownCandidateSynced: number
    errors: string[]
  }
}
