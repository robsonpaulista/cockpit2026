import type { PoliticalActorType } from '@/lib/youtube-radar-types'
import type { GoogleNewsCollectChannel, GoogleNewsPlatform } from '@/lib/google-news-platform'

export type GoogleNewsCollectItem = {
  articleId: string
  title: string
  sourceName: string | null
  url: string
  summary: string | null
  publishedAt: string | null
  platform: GoogleNewsPlatform
}

export type GoogleNewsMentionRow = {
  id: string
  politico_id: string
  search_term: string
  article_id: string
  title: string
  source_name: string | null
  url: string
  summary: string | null
  published_at: string | null
  collected_at: string
  collect_channel: GoogleNewsCollectChannel
  platform: GoogleNewsPlatform
  created_at: string
  updated_at: string
}

export type GoogleNewsMentionWithActor = GoogleNewsMentionRow & {
  political_actors: {
    id: string
    name: string
    slug: string
    actor_type: PoliticalActorType
  } | null
}

export type GoogleNewsCollectResult = {
  politicoId: string
  politicoName: string
  articlesFound: number
  articlesInserted: number
  articlesUpdated: number
  webArticlesFound: number
  videoArticlesFound: number
  videoCollectSkipped: boolean
  webSearchEnabled: boolean
  videoSearchEnabled: boolean
  errors: string[]
}

export type GoogleNewsCollectTotals = {
  articlesFound: number
  articlesInserted: number
  articlesUpdated: number
  webArticlesFound: number
  videoArticlesFound: number
  videoCollectSkipped: boolean
  videoSkipReason: string | null
  errors: string[]
}

export type GoogleVideosCollectResult = {
  politicoId: string
  politicoName: string
  videosFound: number
  videosInserted: number
  videosUpdated: number
  collectSkipped: boolean
  errors: string[]
}

export type GoogleVideosCollectTotals = {
  videosFound: number
  videosInserted: number
  videosUpdated: number
  collectSkipped: boolean
  skipReason: string | null
  errors: string[]
}

export type GoogleNewsRssItem = {
  articleId: string
  title: string
  sourceName: string | null
  url: string
  summary: string | null
  publishedAt: string | null
}
