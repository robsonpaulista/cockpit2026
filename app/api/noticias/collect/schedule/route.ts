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

// Este endpoint pode ser chamado por um cron job (Vercel Cron, GitHub Actions, etc.)
// ou configurado para rodar periodicamente

const scheduleSchema = z.object({
  auto_classify: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Verificar se é uma chamada autorizada (pode usar um secret token)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { auto_classify } = scheduleSchema.parse(body)

    // Buscar todas as URLs de feeds RSS configuradas no banco
    const { data: feeds } = await supabase
      .from('news_feeds')
      .select('id, rss_url, auto_classify, user_id')
      .eq('active', true)

    if (!feeds || feeds.length === 0) {
      // Fallback para variável de ambiente (compatibilidade)
      const envUrls = process.env.GOOGLE_ALERTS_RSS_URLS?.split(',') || []
      if (envUrls.length === 0) {
        return NextResponse.json({
          message: 'Nenhum feed RSS configurado',
          collected: 0,
        })
      }
      // Usar URLs do env como fallback (processar manualmente)
      let totalCollected = 0
      let totalHighRisk = 0

      for (const url of envUrls) {
        try {
          const newsItems = await fetchGoogleAlerts(url.trim())
          if (newsItems.length === 0) continue

          const existingUrls = newsItems
            .map(item => item.url)
            .filter((url): url is string => !!url)

          if (existingUrls.length > 0) {
            const { data: existing } = await supabase
              .from('news')
              .select('url')
              .in('url', existingUrls)

            const existingUrlsSet = new Set(existing?.map(n => n.url) || [])
            const newNews = newsItems.filter(item => 
              !item.url || !existingUrlsSet.has(item.url)
            )

            if (newNews.length === 0) continue

            const processedNews = newNews.map(item => {
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
              }
            })

            const { data } = await supabase
              .from('news')
              .insert(processedNews)
              .select()

            totalCollected += data?.length || 0
            totalHighRisk += processedNews.filter((n: any) => n.risk_level === 'high').length
          }
        } catch (error) {
          console.error(`Erro ao processar feed ${url}:`, error)
          continue
        }
      }

      return NextResponse.json({
        message: `Coleta concluída: ${totalCollected} notícias coletadas`,
        collected: totalCollected,
        high_risk: totalHighRisk,
        feeds_processed: envUrls.length,
      })
    }

    let totalCollected = 0
    let totalHighRisk = 0

    for (const feed of feeds) {
      try {
        const newsItems = await fetchGoogleAlerts(feed.rss_url)

        if (newsItems.length === 0) continue

        // Verificar duplicatas
        const existingUrls = newsItems
          .map(item => item.url)
          .filter((url): url is string => !!url)

        if (existingUrls.length > 0) {
          const { data: existing } = await supabase
            .from('news')
            .select('url')
            .in('url', existingUrls)

          const existingUrlsSet = new Set(existing?.map(n => n.url) || [])
          const newNews = newsItems.filter(item => 
            !item.url || !existingUrlsSet.has(item.url)
          )

          if (newNews.length === 0) continue

          // Processar e classificar
          const shouldClassify = feed.auto_classify ?? auto_classify
          const processedNews = shouldClassify
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
                }
              })
            : newNews.map(item => ({
                ...item,
                processed: false,
              }))

          // Inserir no banco
          const { data, error } = await supabase
            .from('news')
            .insert(processedNews)
            .select()

          if (error) {
            console.error(`Erro ao inserir notícias do feed ${feed.id}:`, error)
            continue
          }

          totalCollected += data?.length || 0

          // Contar alto risco
          const highRiskCount = processedNews.filter((n: any) => n.risk_level === 'high').length
          totalHighRisk += highRiskCount

          // Atualizar last_collected_at do feed
          await supabase
            .from('news_feeds')
            .update({ last_collected_at: new Date().toISOString() })
            .eq('id', feed.id)

          // Buscar adversários para detecção automática
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

                  adversaryMentions[detection.adversaryId] =
                    (adversaryMentions[detection.adversaryId] || 0) + 1
                }
              }
            }

            // Inserir registros de ataques
            if (adversaryAttacks.length > 0) {
              await supabase.from('adversary_attacks').insert(adversaryAttacks)
            }

            // Atualizar Share of Voice
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

          // Criar alertas para alto risco
          if (highRiskCount > 0 && feed.user_id) {
            const alerts = processedNews
              .filter((n: any) => n.risk_level === 'high')
              .map(news => ({
                news_id: data?.find(n => n.url === news.url)?.id,
                user_id: feed.user_id,
                type: 'risk_high',
              }))
              .filter(a => a.news_id)

            if (alerts.length > 0) {
              await supabase.from('news_alerts').insert(alerts)
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao processar feed ${feed.id}:`, error)
        continue
      }
    }

    return NextResponse.json({
      message: `Coleta concluída: ${totalCollected} notícias coletadas`,
      collected: totalCollected,
      high_risk: totalHighRisk,
      feeds_processed: feeds.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro na coleta agendada:', error)
    return NextResponse.json(
      { error: 'Erro na coleta agendada' },
      { status: 500 }
    )
  }
}

