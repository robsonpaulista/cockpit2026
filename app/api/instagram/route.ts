import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, logError } from '@/lib/logger'

// Interface para os dados do Instagram
interface InstagramMetrics {
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

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // ✅ Rate limiting - Proteção contra abuso da API do Instagram
    const rateLimitResult = checkRateLimit(
      `instagram:${user.id}`,
      RATE_LIMITS.INSTAGRAM
    )

    if (!rateLimitResult.success) {
      logger.warn('Rate limit excedido na API do Instagram', {
        userId: user.id,
        endpoint: '/api/instagram',
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
      })

      return NextResponse.json(
        {
          error: 'Muitas requisições. Aguarde antes de tentar novamente.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMITS.INSTAGRAM.maxRequests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    const body = await request.json()
    const { token, businessAccountId, timeRange = '30d', forceRefresh = false } = body

    if (!token || !businessAccountId) {
      return NextResponse.json(
        { error: 'Token e Business Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    logger.info('Requisição Instagram API', {
      userId: user.id,
      businessAccountId,
      timeRange,
      forceRefresh,
    })

    // Validar token primeiro
    const validationResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessAccountId}?fields=id&access_token=${token}`
    )

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json()
      if (errorData.error?.code === 190 || errorData.error?.code === 100) {
        return NextResponse.json(
          { error: 'Token expirado ou inválido' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: errorData.error?.message || 'Erro ao validar token' },
        { status: 400 }
      )
    }

    // Cache buster para forçar dados frescos quando refresh manual
    const cacheBuster = forceRefresh ? `&_cb=${Date.now()}` : ''

    // 1. Obter dados da página e conta Instagram Business
    const pageResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessAccountId}?fields=instagram_business_account{id,username,profile_picture_url,followers_count,media_count}&access_token=${token}${cacheBuster}`
    )

    if (!pageResponse.ok) {
      const errorResponse = await pageResponse.json()
      return NextResponse.json(
        { error: errorResponse.error?.message || 'Erro ao buscar dados da página' },
        { status: 400 }
      )
    }

    const pageData = await pageResponse.json()

    if (!pageData.instagram_business_account?.id) {
      return NextResponse.json(
        { error: 'Esta página não tem uma conta de Instagram Business associada' },
        { status: 400 }
      )
    }

    const instagramBusinessId = pageData.instagram_business_account.id
    const instagramData = pageData.instagram_business_account

    // 2. Buscar publicações recentes (com cache buster para dados frescos)
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=20&access_token=${token}${cacheBuster}`
    )

    if (!mediaResponse.ok) {
      const errorResponse = await mediaResponse.json()
      return NextResponse.json(
        { error: errorResponse.error?.message || 'Erro ao buscar publicações' },
        { status: 400 }
      )
    }

    const mediaData = await mediaResponse.json()

    // 3. Buscar insights básicos (métricas diárias)
    const basicInsightsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=reach,accounts_engaged,total_interactions&period=day&access_token=${token}${cacheBuster}`
    )

    let insightsData: any = { data: [] }
    if (basicInsightsResponse.ok) {
      insightsData = await basicInsightsResponse.json()
    }

    // 3.1 Buscar métricas de perfil (profile_views, website_clicks, impressions)
    let profileInsightsData: any = { data: [] }
    try {
      const profileInsightsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=profile_views,website_clicks,impressions&period=day&access_token=${token}${cacheBuster}`
      )
      if (profileInsightsResponse.ok) {
        profileInsightsData = await profileInsightsResponse.json()
      }
    } catch (error) {
      // Algumas métricas podem não estar disponíveis para todas as contas
      console.log('Métricas de perfil não disponíveis:', error)
    }

    // 4. Processar posts
    const posts = await Promise.all(
      (mediaData.data || []).map(async (post: any) => {
        let type: 'image' | 'video' | 'carousel'
        switch (post.media_type) {
          case 'VIDEO':
            type = 'video'
            break
          case 'CAROUSEL_ALBUM':
            type = 'carousel'
            break
          default:
            type = 'image'
        }

        // Buscar visualizações, salvamentos e compartilhamentos
        let views: number | undefined = undefined
        let saves: number | undefined = undefined
        let shares: number | undefined = undefined

        try {
          const metricsToTry = type === 'video' ? ['video_views', 'impressions', 'reach'] : ['impressions', 'reach']
          
          for (const metric of metricsToTry) {
            try {
              const insightsResponse = await fetch(
                `https://graph.facebook.com/v18.0/${post.id}/insights?metric=${metric}&access_token=${token}${cacheBuster}`
              )
              
              if (insightsResponse.ok) {
                const insightsData = await insightsResponse.json()
                if (insightsData.data && Array.isArray(insightsData.data) && insightsData.data.length > 0) {
                  const metricData = insightsData.data.find((m: any) => m.name === metric)
                  if (metricData) {
                    const value = metricData.values?.[0]?.value || metricData.value
                    if (value !== undefined && value !== null) {
                      const numValue = Number(value)
                      if (!isNaN(numValue) && numValue > 0) {
                        views = numValue
                        break
                      }
                    }
                  }
                }
              }
            } catch (error) {
              // Continuar tentando outras métricas
            }
          }

          // Buscar salvamentos
          try {
            const savesResponse = await fetch(
              `https://graph.facebook.com/v18.0/${post.id}/insights?metric=saved&access_token=${token}${cacheBuster}`
            )
            if (savesResponse.ok) {
              const savesData = await savesResponse.json()
              if (savesData.data && Array.isArray(savesData.data) && savesData.data.length > 0) {
                const savedMetric = savesData.data.find((m: any) => m.name === 'saved')
                if (savedMetric) {
                  const value = savedMetric.values?.[0]?.value || savedMetric.value
                  if (value !== undefined && value !== null) {
                    const numValue = Number(value)
                    if (!isNaN(numValue) && numValue >= 0) {
                      saves = numValue
                    }
                  }
                }
              }
            }
          } catch (error) {
            // Ignorar erros
          }

          // Buscar compartilhamentos
          try {
            const sharesResponse = await fetch(
              `https://graph.facebook.com/v18.0/${post.id}/insights?metric=shares&access_token=${token}${cacheBuster}`
            )
            if (sharesResponse.ok) {
              const sharesData = await sharesResponse.json()
              if (sharesData.data && Array.isArray(sharesData.data) && sharesData.data.length > 0) {
                const sharesMetric = sharesData.data.find((m: any) => m.name === 'shares')
                if (sharesMetric) {
                  const value = sharesMetric.values?.[0]?.value || sharesMetric.value
                  if (value !== undefined && value !== null) {
                    const numValue = Number(value)
                    if (!isNaN(numValue) && numValue >= 0) {
                      shares = numValue
                    }
                  }
                }
              }
            }
          } catch (error) {
            // Ignorar erros
          }
        } catch (error) {
          console.error('Erro ao buscar métricas do post:', error)
        }

        const engagementValue = (post.like_count || 0) + (post.comments_count || 0)

        return {
          id: post.id,
          type,
          url: post.permalink,
          thumbnail: post.thumbnail_url || post.media_url,
          caption: post.caption || '',
          postedAt: post.timestamp,
          metrics: {
            likes: post.like_count || 0,
            comments: post.comments_count || 0,
            shares: shares !== undefined ? shares : 0,
            saves: saves !== undefined ? saves : 0,
            engagement: engagementValue,
            views: views,
          },
        }
      })
    )

    // 5. Processar insights
    const getInsightValue = (metricName: string) => {
      // Buscar primeiro nos insights básicos
      const dataArr = insightsData?.data ?? []
      let insight = dataArr.find((i: any) => i.name === metricName)
      if (insight?.values?.[0]?.value !== undefined) {
        return insight.values[0].value
      }
      
      // Buscar nos insights de perfil
      const profileDataArr = profileInsightsData?.data ?? []
      insight = profileDataArr.find((i: any) => i.name === metricName)
      return insight?.values?.[0]?.value || 0
    }

    // 6. Buscar dados demográficos via follower_demographics (API v18+)
    // Métricas antigas (audience_city, audience_country, audience_gender_age) foram deprecadas
    let demographics: InstagramMetrics['demographics'] = undefined
    try {
      // follower_demographics retorna gênero, idade, cidade e país em uma única chamada
      const demoResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender,city,country&access_token=${token}`
      )

      if (demoResponse.ok) {
        const demoData = await demoResponse.json()

        if (demoData.data && Array.isArray(demoData.data)) {
          let maleCount = 0
          let femaleCount = 0
          const ageGroups: Record<string, number> = {}
          const topLocations: Record<string, number> = {}

          demoData.data.forEach((metric: { name: string; total_value?: { breakdowns?: Array<{ dimension_keys: string[]; results: Array<{ dimension_values: string[]; value: number }> }> } }) => {
            const breakdowns = metric.total_value?.breakdowns
            if (!breakdowns || !Array.isArray(breakdowns)) return

            breakdowns.forEach((breakdown) => {
              const dimensionKeys = breakdown.dimension_keys || []
              const results = breakdown.results || []

              results.forEach((result) => {
                const dimValues = result.dimension_values || []
                const value = Number(result.value) || 0
                if (value <= 0) return

                // Gênero + Idade (dimension_keys: ['age', 'gender'])
                if (dimensionKeys.includes('age') && dimensionKeys.includes('gender')) {
                  const ageIdx = dimensionKeys.indexOf('age')
                  const genderIdx = dimensionKeys.indexOf('gender')
                  const age = dimValues[ageIdx]
                  const gender = dimValues[genderIdx]

                  if (gender === 'M' || gender === 'male') maleCount += value
                  if (gender === 'F' || gender === 'female') femaleCount += value
                  if (age) ageGroups[age] = (ageGroups[age] || 0) + value
                }

                // Cidade (dimension_keys: ['city'])
                if (dimensionKeys.includes('city') && dimensionKeys.length === 1) {
                  const city = dimValues[0]
                  if (city) topLocations[city] = value
                }

                // País (dimension_keys: ['country'])
                if (dimensionKeys.includes('country') && dimensionKeys.length === 1 && Object.keys(topLocations).length === 0) {
                  const country = dimValues[0]
                  if (country) topLocations[country] = value
                }
              })
            })
          })

          if (maleCount > 0 || femaleCount > 0 || Object.keys(ageGroups).length > 0 || Object.keys(topLocations).length > 0) {
            demographics = {
              gender: maleCount > 0 || femaleCount > 0 ? { male: maleCount, female: femaleCount } : undefined,
              age: Object.keys(ageGroups).length > 0 ? ageGroups : undefined,
              topLocations: Object.keys(topLocations).length > 0 ? topLocations : undefined,
            }
          }
        }
      } else {
        // Se follower_demographics falhar, pular demográficos silenciosamente
        console.log('[Instagram API] follower_demographics não disponível, pulando demográficos')
      }
    } catch (error) {
      console.error('Erro ao buscar dados demográficos:', error)
    }

    // Calcular período
    const periodStart = new Date()
    switch (timeRange) {
      case '7d':
        periodStart.setDate(periodStart.getDate() - 7)
        break
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90)
        break
      default:
        periodStart.setDate(periodStart.getDate() - 30)
    }

    // Obter métricas de perfil
    const profileViews = getInsightValue('profile_views')
    const websiteClicks = getInsightValue('website_clicks')
    const impressions = getInsightValue('impressions')

    // Criar objeto de resposta
    const instagramMetrics: InstagramMetrics = {
      username: instagramData.username || '',
      profilePic: instagramData.profile_picture_url,
      displayName: instagramData.username,
      isVerified: false,
      followers: {
        total: instagramData.followers_count || 0,
        growth: 0,
        history: [],
      },
      posts,
      insights: {
        reach: getInsightValue('reach'),
        impressions: impressions,
        profileViews: profileViews,
        websiteClicks: websiteClicks,
        totalViews: impressions,
        totalInteractions: getInsightValue('total_interactions'),
        totalReach: getInsightValue('reach'),
        periodMetrics: {
          startDate: periodStart.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          newFollowers: 0,
          totalReach: getInsightValue('reach'),
          totalInteractions: getInsightValue('total_interactions'),
          totalViews: impressions,
          linkClicks: websiteClicks,
        },
      },
      demographics,
    }

    return NextResponse.json(instagramMetrics)
  } catch (error: any) {
    console.error('Erro ao buscar dados do Instagram:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

