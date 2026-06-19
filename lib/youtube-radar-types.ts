export type PoliticalActorType = 'own_candidate' | 'competitor' | 'ally' | 'other'

export type YoutubeSentimento = 'positivo' | 'negativo' | 'neutro'

export type PoliticalActor = {
  id: string
  name: string
  slug: string
  actor_type: PoliticalActorType
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type YoutubeSearchTerm = {
  id: string
  politico_id: string
  term: string
  active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export type YoutubeMention = {
  id: string
  politico_id: string
  search_term: string
  video_id: string
  channel_id: string | null
  channel_title: string | null
  video_title: string
  description: string | null
  published_at: string | null
  views: number
  likes: number
  comments: number
  url: string
  thumbnail_url: string | null
  tema: string | null
  cidade: string | null
  sentimento: YoutubeSentimento | null
  relevancia: number | null
  classified_at: string | null
  collected_at: string
  created_at: string
  updated_at: string
}

export type PoliticalActorWithTerms = PoliticalActor & {
  youtube_search_terms: YoutubeSearchTerm[]
}

export type YoutubeMentionWithActor = YoutubeMention & {
  political_actors?: Pick<PoliticalActor, 'id' | 'name' | 'slug' | 'actor_type'> | null
}

export type YoutubeRadarSummary = {
  totalVideos: number
  totalViews: number
  topChannels: { channel_title: string; count: number }[]
  lookbackDays: number
  collectedAt: string | null
}
