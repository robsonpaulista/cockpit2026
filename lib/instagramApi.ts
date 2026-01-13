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






