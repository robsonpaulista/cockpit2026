import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  fetchGoogleAlerts,
  analyzeSentiment,
  analyzeRisk,
  extractTheme,
} from '@/lib/services/google-alerts'
import {
  detectAdversaryInNews,
  calculateShareOfVoice,
} from '@/lib/services/adversary-detector'

const collectSchema = z.object({
  rss_url: z.string().url(),
  auto_classify: z.boolean().optional().default(true),
  feed_id: z.string().uuid().optional(), // ID do feed RSS do usuário (opcional)
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { rss_url, auto_classify, feed_id } = collectSchema.parse(body)

    // Buscar notícias do feed RSS
    const newsItems = await fetchGoogleAlerts(rss_url)

    if (newsItems.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma notícia nova encontrada',
        collected: 0,
      })
    }

    // Verificar quais notícias já existem (por URL)
    const existingUrls = newsItems
      .map(item => item.url)
      .filter((url): url is string => !!url)

    if (existingUrls.length > 0) {
      const { data: existing } = await supabase
        .from('news')
        .select('url')
        .in('url', existingUrls)

      const existingUrlsSet = new Set(existing?.map(n => n.url) || [])
      
      // Filtrar apenas notícias novas
      const newNews = newsItems.filter(item => 
        !item.url || !existingUrlsSet.has(item.url)
      )

      if (newNews.length === 0) {
        return NextResponse.json({
          message: 'Todas as notícias já foram coletadas',
          collected: 0,
        })
      }

      // Processar e classificar automaticamente se solicitado
      const processedNews = auto_classify
        ? newNews.map(item => {
            const fullText = `${item.title} ${item.content || ''}`.toLowerCase()
            const sentiment = analyzeSentiment(fullText)
            const risk = analyzeRisk(fullText, sentiment)
            const theme = extractTheme(fullText)

            return {
              ...item,
              sentiment,
              risk_level: risk,
              theme,
              processed: true,
              feed_id: feed_id, // Marcar de qual feed veio (se fornecido)
            }
          })
        : newNews.map(item => ({
            ...item,
            processed: false,
            feed_id: feed_id, // Marcar de qual feed veio (se fornecido)
          }))

      // Inserir no banco
      const { data, error } = await supabase
        .from('news')
        .insert(processedNews)
        .select()

      if (error) {
        console.error('Erro ao inserir notícias:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Buscar adversários cadastrados para detecção automática
      const { data: adversaries } = await supabase
        .from('adversaries')
        .select('id, name, themes')

      // Detectar adversários e criar registros de ataques
      const adversaryAttacks: any[] = []
      const adversaryMentions: Record<string, number> = {}

      if (adversaries && adversaries.length > 0) {
        for (const newsItem of processedNews) {
          const detection = detectAdversaryInNews(
            newsItem.title,
            newsItem.content || '',
            adversaries
          )

          if (detection) {
            const newsId = data?.find(n => n.url === newsItem.url)?.id
            if (newsId) {
              adversaryAttacks.push({
                adversary_id: detection.adversaryId,
                news_id: newsId,
                attack_type: detection.attackType,
              })

              // Contar menções para Share of Voice
              adversaryMentions[detection.adversaryId] =
                (adversaryMentions[detection.adversaryId] || 0) + 1
            }
          }
        }

        // Inserir registros de ataques
        if (adversaryAttacks.length > 0) {
          await supabase.from('adversary_attacks').insert(adversaryAttacks)
        }

        // Atualizar Share of Voice dos adversários
        if (Object.keys(adversaryMentions).length > 0) {
          for (const [adversaryId, mentions] of Object.entries(adversaryMentions)) {
            const shareOfVoice = await calculateShareOfVoice(
              adversaryId,
              processedNews.length,
              adversaryMentions
            )

            await supabase
              .from('adversaries')
              .update({ presence_score: shareOfVoice })
              .eq('id', adversaryId)
          }
        }
      }

      // Atualizar last_collected_at do feed se feed_id foi fornecido
      if (feed_id) {
        await supabase
          .from('news_feeds')
          .update({ last_collected_at: new Date().toISOString() })
          .eq('id', feed_id)
      }

      return NextResponse.json({
        message: `${data?.length || 0} notícias coletadas com sucesso`,
        collected: data?.length || 0,
        adversaries_detected: adversaryAttacks.length,
        data,
      })
    }

    return NextResponse.json({
      message: 'Erro ao processar notícias',
      collected: 0,
    }, { status: 500 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao coletar notícias do Google Alerts:', error)
    return NextResponse.json(
      { error: 'Erro ao coletar notícias do Google Alerts' },
      { status: 500 }
    )
  }
}

