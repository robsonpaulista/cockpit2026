import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    // 1. Obter dados da página e conta Instagram Business
    const pageResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessAccountId}?fields=instagram_business_account{id,username,profile_picture_url,followers_count,media_count}&access_token=${token}${
        forceRefresh ? '&_cache_buster=' + Date.now() : ''
      }`
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

    // 2. Buscar publicações recentes
    const mediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=20&access_token=${token}`
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
      `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=reach,accounts_engaged,total_interactions&period=day&access_token=${token}`
    )

    let insightsData: any = { data: [] }
    if (basicInsightsResponse.ok) {
      insightsData = await basicInsightsResponse.json()
    }

    // 3.1 Buscar métricas de perfil (profile_views, website_clicks, impressions)
    let profileInsightsData: any = { data: [] }
    try {
      const profileInsightsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=profile_views,website_clicks,impressions&period=day&access_token=${token}`
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
                `https://graph.facebook.com/v18.0/${post.id}/insights?metric=${metric}&access_token=${token}`
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
              `https://graph.facebook.com/v18.0/${post.id}/insights?metric=saved&access_token=${token}`
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
              `https://graph.facebook.com/v18.0/${post.id}/insights?metric=shares&access_token=${token}`
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

    // 6. Buscar dados demográficos
    let demographics: InstagramMetrics['demographics'] = undefined
    try {
      // Buscar dados de gênero e idade
      const genderAgeResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=audience_gender_age&period=lifetime&access_token=${token}`
      )

      if (genderAgeResponse.ok) {
        const genderAgeData = await genderAgeResponse.json()
        
        if (genderAgeData.data && Array.isArray(genderAgeData.data) && genderAgeData.data.length > 0) {
          const genderAgeMetric = genderAgeData.data[0]
          let values: any = null

          if (genderAgeMetric.values && Array.isArray(genderAgeMetric.values) && genderAgeMetric.values.length > 0) {
            values = genderAgeMetric.values[0]?.value || genderAgeMetric.values[0]
          } else if (genderAgeMetric.value) {
            values = genderAgeMetric.value
          } else if (genderAgeMetric.values && typeof genderAgeMetric.values === 'object') {
            values = genderAgeMetric.values
          }

          if (values && typeof values === 'object' && values !== null) {
            let maleCount = 0
            let femaleCount = 0
            const ageGroups: Record<string, number> = {}

            Object.keys(values).forEach((key) => {
              const value = Number(values[key]) || 0
              if (value > 0) {
                if (key.startsWith('M.') || key.match(/^M\.\d+/)) {
                  maleCount += value
                  const ageRange = key.replace(/^M\./, '').replace(/\.\d+$/, '')
                  ageGroups[ageRange] = (ageGroups[ageRange] || 0) + value
                } else if (key.startsWith('F.') || key.match(/^F\.\d+/)) {
                  femaleCount += value
                  const ageRange = key.replace(/^F\./, '').replace(/\.\d+$/, '')
                  ageGroups[ageRange] = (ageGroups[ageRange] || 0) + value
                }
              }
            })

            if (maleCount > 0 || femaleCount > 0 || Object.keys(ageGroups).length > 0) {
              demographics = {
                gender: maleCount > 0 || femaleCount > 0 ? { male: maleCount, female: femaleCount } : undefined,
                age: Object.keys(ageGroups).length > 0 ? ageGroups : undefined,
              }
            }
          }
        }
      }

      // Buscar dados de localização por cidade (mais detalhado)
      const cityResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=audience_city&period=lifetime&access_token=${token}`
      )

      let topLocations: Record<string, number> = {}

      if (cityResponse.ok) {
        const cityData = await cityResponse.json()
        
        // Log para debug
        console.log('[Instagram API] Resposta audience_city:', JSON.stringify(cityData, null, 2))
        
        if (cityData.data && Array.isArray(cityData.data) && cityData.data.length > 0) {
          const cityMetric = cityData.data[0]
          let cityValues: any = null

          if (cityMetric.values && Array.isArray(cityMetric.values) && cityMetric.values.length > 0) {
            cityValues = cityMetric.values[0]?.value || cityMetric.values[0]
          } else if (cityMetric.value) {
            cityValues = cityMetric.value
          } else if (cityMetric.values && typeof cityMetric.values === 'object') {
            cityValues = cityMetric.values
          }

          console.log('[Instagram API] cityValues processado:', cityValues)

          if (cityValues && typeof cityValues === 'object' && cityValues !== null) {
            Object.keys(cityValues).forEach((city) => {
              const value = Number(cityValues[city]) || 0
              if (value > 0) {
                topLocations[city] = value
              }
            })
            console.log('[Instagram API] topLocations (cidades):', Object.keys(topLocations).length, 'cidades encontradas')
          }
        } else {
          console.log('[Instagram API] Nenhum dado encontrado em audience_city.data')
        }
      } else {
        const errorData = await cityResponse.json().catch(() => ({}))
        console.log('[Instagram API] Erro ao buscar audience_city:', cityResponse.status, errorData)
      }

      // Se não houver dados de cidade, buscar dados de país como fallback
      if (Object.keys(topLocations).length === 0) {
        console.log('[Instagram API] Nenhuma cidade encontrada, buscando países como fallback')
        const countryResponse = await fetch(
          `https://graph.facebook.com/v18.0/${instagramBusinessId}/insights?metric=audience_country&period=lifetime&access_token=${token}`
        )

        if (countryResponse.ok) {
          const countryData = await countryResponse.json()
          console.log('[Instagram API] Resposta audience_country:', JSON.stringify(countryData, null, 2))
          
          if (countryData.data && Array.isArray(countryData.data) && countryData.data.length > 0) {
            const countryMetric = countryData.data[0]
            let countryValues: any = null

            if (countryMetric.values && Array.isArray(countryMetric.values) && countryMetric.values.length > 0) {
              countryValues = countryMetric.values[0]?.value || countryMetric.values[0]
            } else if (countryMetric.value) {
              countryValues = countryMetric.value
            } else if (countryMetric.values && typeof countryMetric.values === 'object') {
              countryValues = countryMetric.values
            }

            if (countryValues && typeof countryValues === 'object' && countryValues !== null) {
              Object.keys(countryValues).forEach((country) => {
                const value = Number(countryValues[country]) || 0
                if (value > 0) {
                  topLocations[country] = value
                }
              })
              console.log('[Instagram API] topLocations (países):', Object.keys(topLocations).length, 'países encontrados')
            }
          }
        } else {
          const errorData = await countryResponse.json().catch(() => ({}))
          console.log('[Instagram API] Erro ao buscar audience_country:', countryResponse.status, errorData)
        }
      }

      // Adicionar dados de localização aos demográficos se disponíveis
      if (Object.keys(topLocations).length > 0) {
        demographics = {
          ...demographics,
          topLocations,
        }
        console.log('[Instagram API] Demographics com topLocations adicionado:', Object.keys(topLocations).length, 'localizações')
      } else {
        console.log('[Instagram API] Nenhuma localização encontrada para adicionar aos demographics')
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

    // Log final para debug
    console.log('[Instagram API] Dados finais demographics:', demographics ? {
      hasGender: !!demographics.gender,
      hasAge: !!demographics.age,
      hasTopLocations: !!demographics.topLocations,
      topLocationsCount: demographics.topLocations ? Object.keys(demographics.topLocations).length : 0
    } : 'null')

    return NextResponse.json(instagramMetrics)
  } catch (error: any) {
    console.error('Erro ao buscar dados do Instagram:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

