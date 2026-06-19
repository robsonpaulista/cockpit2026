import type { PoliticalActorType } from '@/lib/youtube-radar-types'

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
  errors: string[]
}

export type GoogleNewsCollectTotals = {
  articlesFound: number
  articlesInserted: number
  articlesUpdated: number
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
