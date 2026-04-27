// Interface para os dados do Instagram
export interface InstagramMetrics {
  username: string
  profilePic?: string
  displayName?: string
  isVerified?: boolean
  followers: {
    total: number
    growth: number
    history: Array<{ date: string; count: number }>
  }
  posts: Array<{
    id: string
    type: 'image' | 'video' | 'carousel'
    url: string
    thumbnail: string
    caption: string
    postedAt: string
    metrics: {
      likes: number
      comments: number
      shares: number
      saves: number
      engagement: number
      views?: number
    }
  }>
  insights: {
    reach: number
    impressions: number
    profileViews: number
    websiteClicks: number
    totalViews: number
    totalInteractions: number
    totalReach: number
    periodMetrics?: {
      startDate: string
      endDate: string
      newFollowers: number
      totalReach: number
      totalInteractions: number
      totalViews: number
      linkClicks: number
      storiesViews?: number
      reelsViews?: number
      postViews?: number
    }
  }
  demographics?: {
    gender?: {
      male: number
      female: number
    }
    age?: Record<string, number>
    topLocations?: Record<string, number>
  }
}

/**
 * Buscar dados do Instagram usando a API
 */
export async function fetchInstagramData(
  token: string,
  businessAccountId: string,
  timeRange: string = '30d',
  forceRefresh: boolean = false
): Promise<InstagramMetrics | null> {
  try {
    const response = await fetch('/api/instagram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        businessAccountId,
        timeRange,
        forceRefresh,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao buscar dados do Instagram')
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Erro ao buscar dados do Instagram:', error)
    throw error
  }
}

/**
 * Validar token do Instagram
 */
export async function validateInstagramToken(
  token: string,
  businessAccountId: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/instagram/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        businessAccountId,
      }),
    })

    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.valid === true
  } catch (error) {
    console.error('Erro ao validar token:', error)
    return false
  }
}

/**
 * Salvar configurações do Instagram no localStorage
 */
export function saveInstagramConfig(token: string, businessAccountId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('instagramToken', token)
    localStorage.setItem('instagramBusinessAccountId', businessAccountId)
  }
}

/**
 * Buscar configurações do Instagram da API do servidor
 * Isso é mais seguro pois as credenciais não ficam expostas no código do cliente
 */
export async function fetchInstagramConfigFromServer(): Promise<{ token: string; businessAccountId: string } | null> {
  try {
    const response = await fetch('/api/instagram/config')
    if (response.ok) {
      const data = await response.json()
      if (data.token && data.businessAccountId) {
        return { token: data.token, businessAccountId: data.businessAccountId }
      }
    }
    return null
  } catch (error) {
    console.error('Erro ao buscar config do servidor:', error)
    return null
  }
}

/**
 * Carregar configurações do Instagram
 * Prioridade: 1) localStorage, 2) API do servidor
 */
export function loadInstagramConfig(): { token: string; businessAccountId: string } {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('instagramToken')
    const businessAccountId = localStorage.getItem('instagramBusinessAccountId')
    
    if (token && businessAccountId) {
      return { token, businessAccountId }
    }
  }
  
  // Retorna vazio - o componente deve chamar loadInstagramConfigAsync para buscar do servidor
  return { token: '', businessAccountId: '' }
}

/**
 * Carregar configurações do Instagram de forma assíncrona
 * Verifica localStorage primeiro, depois busca do servidor
 */
export async function loadInstagramConfigAsync(): Promise<{ token: string; businessAccountId: string }> {
  if (typeof window !== 'undefined') {
    // Primeiro, verificar localStorage
    const token = localStorage.getItem('instagramToken')
    const businessAccountId = localStorage.getItem('instagramBusinessAccountId')
    
    if (token && businessAccountId) {
      return { token, businessAccountId }
    }
    
    // Se não houver no localStorage, buscar do servidor (variáveis de ambiente)
    const serverConfig = await fetchInstagramConfigFromServer()
    if (serverConfig && serverConfig.token && serverConfig.businessAccountId) {
      // Salvar no localStorage para próximas vezes
      saveInstagramConfig(serverConfig.token, serverConfig.businessAccountId)
      return serverConfig
    }
  }
  
  return { token: '', businessAccountId: '' }
}

/**
 * Limpar configurações do Instagram do localStorage
 */
export function clearInstagramConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('instagramToken')
    localStorage.removeItem('instagramBusinessAccountId')
  }
}

/**
 * Interface para snapshot de métricas
 */
export interface InstagramSnapshot {
  id: string
  user_id: string
  snapshot_date: string
  followers_count: number
  profile_views: number
  website_clicks: number
  reach: number
  impressions: number
  accounts_engaged: number
  total_interactions: number
  media_count: number
  instagram_username: string
  created_at: string
}

/**
 * Interface para histórico de métricas
 */
export interface InstagramHistoryResponse {
  history: InstagramSnapshot[]
  summary: {
    totalSnapshots: number
    currentFollowers: number
    growth: number
    growthPercentage: number
    totalProfileViews: number
    periodDays: number
  }
}

/**
 * Salvar snapshot de métricas do Instagram
 */
export async function saveInstagramSnapshot(metrics: InstagramMetrics): Promise<boolean> {
  try {
    const response = await fetch('/api/instagram/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        followers_count: metrics.followers.total,
        profile_views: metrics.insights.profileViews,
        website_clicks: metrics.insights.websiteClicks,
        reach: metrics.insights.reach,
        impressions: metrics.insights.impressions,
        accounts_engaged: 0,
        total_interactions: metrics.insights.totalInteractions,
        media_count: metrics.posts.length,
        instagram_username: metrics.username,
      }),
    })

    if (!response.ok) {
      console.error('Erro ao salvar snapshot')
      return false
    }

    return true
  } catch (error) {
    console.error('Erro ao salvar snapshot:', error)
    return false
  }
}

/**
 * Buscar histórico de métricas do Instagram
 */
export async function fetchInstagramHistory(days: number = 30): Promise<InstagramHistoryResponse | null> {
  try {
    const response = await fetch(`/api/instagram/snapshot?days=${days}`)

    if (!response.ok) {
      console.error('Erro ao buscar histórico')
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return null
  }
}

/** Ranking de quem mais comenta (dados persistidos no Supabase). */
export type InstagramCommentLeader = {
  rank: number
  commenter_username: string | null
  commenter_ig_id: string | null
  comment_count: number
  last_commented_at: string
}

export type InstagramCommentLeadersResponse = {
  leaders: InstagramCommentLeader[]
  stats: { uniqueCommenters: number; totalComments: number }
}

export async function fetchInstagramCommentLeaders(
  limit = 50
): Promise<InstagramCommentLeadersResponse | null> {
  try {
    const response = await fetch(`/api/instagram/comments/leaders?limit=${limit}`)
    if (!response.ok) return null
    return (await response.json()) as InstagramCommentLeadersResponse
  } catch {
    return null
  }
}

export type InstagramStoredComment = {
  id: string
  instagram_media_id: string
  media_permalink: string | null
  media_caption: string | null
  media_thumbnail_url: string | null
  media_posted_at: string | null
  instagram_comment_id: string
  parent_instagram_comment_id: string | null
  commenter_ig_id: string | null
  commenter_username: string | null
  comment_text: string
  comment_like_count: number
  hidden: boolean
  commented_at: string
  synced_at: string
  instagram_owner_username: string | null
}

export type InstagramPostWithComments = {
  instagram_media_id: string
  media_permalink: string | null
  media_caption: string | null
  media_thumbnail_url: string | null
  media_posted_at: string | null
  comments_count: number
  comments: InstagramStoredComment[]
}

export type InstagramCommentsGroupedResponse = {
  posts: InstagramPostWithComments[]
  meta: { totalRows: number; postCount: number; truncated: boolean; maxRows: number }
}

/**
 * Comentários agrupados por publicação (para análise postagem → comentários).
 */
export async function fetchInstagramCommentsGrouped(
  maxRows?: number
): Promise<InstagramCommentsGroupedResponse | null> {
  try {
    const sp = new URLSearchParams()
    if (maxRows != null) sp.set('maxRows', String(maxRows))
    const response = await fetch(`/api/instagram/comments/grouped?${sp.toString()}`)
    if (!response.ok) return null
    return (await response.json()) as InstagramCommentsGroupedResponse
  } catch {
    return null
  }
}

export async function fetchInstagramCommentsRecent(options?: {
  limit?: number
  offset?: number
  mediaId?: string | null
}): Promise<{ comments: InstagramStoredComment[] } | null> {
  try {
    const sp = new URLSearchParams()
    if (options?.limit != null) sp.set('limit', String(options.limit))
    if (options?.offset != null) sp.set('offset', String(options.offset))
    if (options?.mediaId) sp.set('mediaId', options.mediaId)
    const response = await fetch(`/api/instagram/comments/recent?${sp.toString()}`)
    if (!response.ok) return null
    return (await response.json()) as { comments: InstagramStoredComment[] }
  } catch {
    return null
  }
}

export type InstagramCommentsSyncResult = {
  success: boolean
  instagramBusinessId?: string
  ownerUsername?: string
  mediaProcessed?: number
  commentsUpserted?: number
  lookbackDays?: number
  timedOutEarly?: boolean
  elapsedMs?: number
  errors?: string[]
  error?: string
  resetAt?: number
}

function compactErrorSnippet(rawBody: string): string {
  const normalized = rawBody.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.slice(0, 180)
}

function parseInstagramCommentsSyncResponse(
  response: Response,
  rawBody: string
): InstagramCommentsSyncResult {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return {
      success: false,
      error: `Resposta vazia do servidor (HTTP ${response.status}).`,
    }
  }

  const looksLikeHtml =
    trimmed.startsWith('<') ||
    /^An error occurred/i.test(trimmed) ||
    /^Application error/i.test(trimmed)

  if (looksLikeHtml) {
    const snippet = compactErrorSnippet(trimmed)
    const details = snippet ? ` Detalhe: ${snippet}` : ''
    return {
      success: false,
      error:
        response.status >= 500
          ? `Sincronização falhou com HTTP ${response.status}: o servidor devolveu HTML em vez de JSON (possível timeout/limite da plataforma).${details}`
          : `A sincronização falhou (HTTP ${response.status}) e o servidor não devolveu JSON.${details}`,
    }
  }

  try {
    return JSON.parse(trimmed) as InstagramCommentsSyncResult
  } catch {
    return {
      success: false,
      error: `Resposta inválida do servidor (HTTP ${response.status}). Tente novamente.`,
    }
  }
}

/**
 * Sincroniza comentários das publicações recentes para o banco (servidor + Supabase).
 */
export async function syncInstagramComments(
  token: string,
  businessAccountId: string,
  maxMedia?: number,
  lookbackDays?: number
): Promise<InstagramCommentsSyncResult> {
  try {
    const response = await fetch('/api/instagram/comments/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        businessAccountId,
        maxMedia: maxMedia ?? undefined,
        lookbackDays: lookbackDays ?? undefined,
      }),
    })
    const raw = await response.text()
    const data = parseInstagramCommentsSyncResponse(response, raw)
    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Falha na sincronização',
        resetAt: data.resetAt,
      }
    }
    return data
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro de rede',
    }
  }
}



