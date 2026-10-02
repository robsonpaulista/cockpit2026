/** Tipos da Arena de Apoiadores (modelo §4 do spec). */

export type InteractionType = 'comentario' | 'curtida'
export type InteractionSource = 'api_oficial' | 'scraper' | 'interno'

export type ArenaLeader = {
  id: string
  name: string
  city: string | null
}

export type ArenaMember = {
  id: string
  name: string
  instagramHandle: string
  phone: string
  email: string
  city: string | null
  leaderId: string
  lgpdConsent: boolean
  lgpdConsentAt: string | null
  createdAt: string
}

export type ArenaPost = {
  id: string
  instagramMediaId: string
  caption: string | null
  publishedAt: string
  permalink: string | null
}

export type ArenaInteraction = {
  id: string
  memberId: string | null
  postId: string
  type: InteractionType
  rawInstagramUsername: string
  basePoints: number
  isEarlyComment: boolean
  earlyBonusPoints: number
  source: InteractionSource
  interactedAt: string | null
  capturedAt: string
}

export type ArenaLevelId = 1 | 2 | 3 | 4 | 5

export type ArenaLevel = {
  id: ArenaLevelId
  name: string
  minPoints: number
}

export type ArenaBadgeId =
  | 'primeira_curtida'
  | 'voz_ativa'
  | 'sequencia_3'
  | 'comentarista_relampago'
  | 'fiel'
  | 'top_10'

export type ArenaBadge = {
  id: ArenaBadgeId
  label: string
  description: string
}

export type MemberScoreBreakdown = {
  memberId: string
  commentPoints: number
  earlyBonusPoints: number
  likePoints: number
  subtotal: number
  engagementRate: number
  postsEngaged: number
  postsTotal: number
  fidelityBonus: number
  total: number
  level: ArenaLevel
  nextLevel: ArenaLevel | null
  progressToNext: number
  streakDays: number
  badges: ArenaBadgeId[]
}

export type LeaderGroupScore = {
  leader: ArenaLeader
  totalPoints: number
  memberCount: number
}

export type ArenaViewerRole = 'admin' | 'lideranca' | 'apoiador'
