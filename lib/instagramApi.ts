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
 * Carregar configurações do Instagram do localStorage
 */
export function loadInstagramConfig(): { token: string; businessAccountId: string } | null {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('instagramToken')
    const businessAccountId = localStorage.getItem('instagramBusinessAccountId')
    
    if (token && businessAccountId) {
      return { token, businessAccountId }
    }
  }
  return null
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


