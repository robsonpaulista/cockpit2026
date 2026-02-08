import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface PostMetrics {
  likes: number
  comments: number
  engagement: number
  views?: number
}

interface ThemePerformance {
  theme: string
  usage_count: number
  performance_score: number
  posts: number
  totalLikes: number
  totalComments: number
  totalEngagement: number
  totalViews: number
  avgLikes: number
  avgComments: number
  avgEngagement: number
  avgViews: number
  boostedCount: number
}

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Buscar token do Instagram das variáveis de ambiente
    const token = process.env.INSTAGRAM_TOKEN || ''
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ID || ''

    // 2. Buscar todas as classificações do usuário
    const { data: classifications, error: classError } = await supabase
      .from('instagram_post_classifications')
      .select('identifier, theme, is_boosted')
      .eq('user_id', user.id)

    if (classError) {
      console.error('Erro ao buscar classificações:', classError)
      return NextResponse.json(
        { error: 'Erro ao buscar classificações' },
        { status: 500 }
      )
    }

    // Criar mapa de classificações por identifier
    const classMap: Record<string, { theme: string; isBoosted: boolean }> = {}
    if (classifications) {
      classifications.forEach((item) => {
        classMap[item.identifier] = {
          theme: item.theme,
          isBoosted: item.is_boosted,
        }
      })
    }

    // 3. Se temos token, buscar posts do Instagram com métricas básicas
    let postsWithMetrics: Array<{ id: string; caption: string; postedAt: string; metrics: PostMetrics }> = []

    if (token && businessAccountId) {
      try {
        // Buscar conta Instagram Business
        const pageResponse = await fetch(
          `https://graph.facebook.com/v18.0/${businessAccountId}?fields=instagram_business_account{id}&access_token=${token}`
        )

        if (pageResponse.ok) {
          const pageData = await pageResponse.json()
          const instagramBusinessId = pageData.instagram_business_account?.id

          if (instagramBusinessId) {
            // Buscar posts recentes (likes e comments vêm direto, sem custo extra)
            const mediaResponse = await fetch(
              `https://graph.facebook.com/v18.0/${instagramBusinessId}/media?fields=id,caption,timestamp,like_count,comments_count&limit=50&access_token=${token}`
            )

            if (mediaResponse.ok) {
              const mediaData = await mediaResponse.json()

              // Buscar views para cada post (impressions como proxy)
              postsWithMetrics = await Promise.all(
                (mediaData.data || []).map(async (post: Record<string, unknown>) => {
                  const likes = (post.like_count as number) || 0
                  const comments = (post.comments_count as number) || 0

                  // Tentar buscar impressões (visualizações) do post
                  let views = 0
                  try {
                    const insightsResponse = await fetch(
                      `https://graph.facebook.com/v18.0/${post.id}/insights?metric=impressions&access_token=${token}`
                    )
                    if (insightsResponse.ok) {
                      const insightsData = await insightsResponse.json()
                      if (insightsData.data && insightsData.data.length > 0) {
                        const metric = insightsData.data.find((m: Record<string, unknown>) => m.name === 'impressions')
                        const value = metric?.values?.[0]?.value || metric?.value
                        if (value) views = Number(value) || 0
                      }
                    }
                  } catch {
                    // Ignora erros de insights individuais
                  }

                  return {
                    id: post.id as string,
                    caption: (post.caption as string) || '',
                    postedAt: (post.timestamp as string) || '',
                    metrics: {
                      likes,
                      comments,
                      engagement: likes + comments,
                      views,
                    },
                  }
                })
              )
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar posts do Instagram:', error)
        // Continua sem métricas do Instagram
      }
    }

    // 4. Gerar identifier para cada post (mesmo formato do conteúdo)
    function generateIdFromDateAndCaption(date: string, caption: string): string {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const captionHash = caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      return `${dateStr}_${captionHash}`
    }

    // 5. Agregar métricas por tema
    const themeMetrics: Record<string, ThemePerformance> = {}

    postsWithMetrics.forEach((post) => {
      // Tentar encontrar classificação pelo id ou pelo identifier gerado
      const classById = classMap[post.id]
      const generatedId = generateIdFromDateAndCaption(post.postedAt, post.caption)
      const classByGenId = classMap[generatedId]
      const classification = classById || classByGenId

      if (classification?.theme) {
        const theme = classification.theme
        if (!themeMetrics[theme]) {
          themeMetrics[theme] = {
            theme,
            usage_count: 0,
            performance_score: 0,
            posts: 0,
            totalLikes: 0,
            totalComments: 0,
            totalEngagement: 0,
            totalViews: 0,
            avgLikes: 0,
            avgComments: 0,
            avgEngagement: 0,
            avgViews: 0,
            boostedCount: 0,
          }
        }

        themeMetrics[theme].posts++
        themeMetrics[theme].totalLikes += post.metrics.likes
        themeMetrics[theme].totalComments += post.metrics.comments
        themeMetrics[theme].totalEngagement += post.metrics.engagement
        themeMetrics[theme].totalViews += post.metrics.views || 0
        if (classification.isBoosted) {
          themeMetrics[theme].boostedCount++
        }
      }
    })

    // Também contar classificações que existem no DB mas podem não ter match com posts atuais
    Object.values(classMap).forEach(({ theme, isBoosted }) => {
      if (!themeMetrics[theme]) {
        themeMetrics[theme] = {
          theme,
          usage_count: 0,
          performance_score: 0,
          posts: 0,
          totalLikes: 0,
          totalComments: 0,
          totalEngagement: 0,
          totalViews: 0,
          avgLikes: 0,
          avgComments: 0,
          avgEngagement: 0,
          avgViews: 0,
          boostedCount: 0,
        }
      }
      themeMetrics[theme].usage_count++
      if (isBoosted) {
        // Não incrementar boostedCount novamente se já contamos no loop de posts
      }
    })

    // 6. Calcular médias e performance score
    Object.values(themeMetrics).forEach((tm) => {
      if (tm.posts > 0) {
        tm.avgLikes = Math.round(tm.totalLikes / tm.posts)
        tm.avgComments = Math.round(tm.totalComments / tm.posts)
        tm.avgEngagement = Math.round(tm.totalEngagement / tm.posts)
        tm.avgViews = Math.round(tm.totalViews / tm.posts)
      }
      // Performance score: combinação de uso e engajamento
      tm.performance_score = Math.min(
        100,
        Math.round((tm.usage_count * 10) + (tm.boostedCount * 20) + (tm.avgEngagement * 2))
      )
    })

    // 7. Buscar contagem de notícias por tema
    const { data: newsData } = await supabase
      .from('news')
      .select('theme')

    if (newsData) {
      newsData.forEach((n) => {
        if (n.theme && themeMetrics[n.theme]) {
          themeMetrics[n.theme].usage_count++
        }
      })
    }

    // 8. Ordenar e retornar
    const sortedThemes = Object.values(themeMetrics)
      .sort((a, b) => b.usage_count - a.usage_count)

    return NextResponse.json({
      themes: sortedThemes,
      totalPosts: postsWithMetrics.length,
      hasInstagramData: postsWithMetrics.length > 0,
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar performance das bandeiras:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
