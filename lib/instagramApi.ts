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

// Credenciais padrão do .env.local (fallback)
// ⚠️ SEGURANÇA: NUNCA hardcodar tokens aqui!
// Use variáveis de ambiente ou localStorage do cliente
const DEFAULT_INSTAGRAM_CONFIG = {
  token: process.env.NEXT_PUBLIC_INSTAGRAM_TOKEN || '', // Sem fallback hardcoded por segurança
  businessAccountId: process.env.NEXT_PUBLIC_INSTAGRAM_BUSINESS_ID || '' // Sem fallback hardcoded por segurança
}

/**
 * Carregar configurações do Instagram do localStorage
 * Sempre retorna credenciais (localStorage ou padrão)
 * Nunca retorna null para evitar mostrar modal automaticamente
 * Igual ao comportamento do projeto mutirao_catarata
 */
export function loadInstagramConfig(): { token: string; businessAccountId: string } {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('instagramToken')
    const businessAccountId = localStorage.getItem('instagramBusinessAccountId')
    
    if (token && businessAccountId) {
      return { token, businessAccountId }
    }
    
    // Se não houver no localStorage, usar credenciais padrão e salvar automaticamente
    // Isso evita mostrar modal automaticamente - igual ao outro projeto
    const defaultConfig = {
      token: DEFAULT_INSTAGRAM_CONFIG.token,
      businessAccountId: DEFAULT_INSTAGRAM_CONFIG.businessAccountId
    }
    
    // Salvar automaticamente no localStorage para próxima vez
    // Só salvar se as credenciais forem válidas (não são placeholders)
    if (defaultConfig.token && defaultConfig.businessAccountId && 
        defaultConfig.token !== 'EAAH...' && 
        defaultConfig.token.length > 20 && // Token real tem mais de 20 caracteres
        defaultConfig.businessAccountId !== '123456789' &&
        defaultConfig.businessAccountId.length > 5) { // Business ID real tem mais de 5 caracteres
      saveInstagramConfig(defaultConfig.token, defaultConfig.businessAccountId)
    }
    
    return defaultConfig
  }
  
  // Fallback para SSR
  return {
    token: DEFAULT_INSTAGRAM_CONFIG.token,
    businessAccountId: DEFAULT_INSTAGRAM_CONFIG.businessAccountId
  }
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






