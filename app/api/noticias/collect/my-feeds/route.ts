import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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

// Coleta notícias dos feeds configurados pelo usuário logado
export async function POST() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar feeds ativos do usuário
    const { data: feeds, error: feedsError } = await supabase
      .from('news_feeds')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true)

    if (feedsError) {
      return NextResponse.json({ error: feedsError.message }, { status: 500 })
    }

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({
        message: 'Nenhum feed RSS configurado. Configure feeds primeiro.',
        collected: 0,
      })
    }

    let totalCollected = 0
    let totalHighRisk = 0
    const results: any[] = []

    for (const feed of feeds) {
      try {
        const newsItems = await fetchGoogleAlerts(feed.rss_url)

        if (newsItems.length === 0) {
          results.push({ feed_id: feed.id, feed_name: feed.name, collected: 0 })
          continue
        }

        // Verificar duplicatas
        const existingUrls = newsItems
          .map(item => item.url)
          .filter((url): url is string => !!url)

        let newNews = newsItems
        if (existingUrls.length > 0) {
          const { data: existing } = await supabase
            .from('news')
            .select('url')
            .in('url', existingUrls)

          const existingUrlsSet = new Set(existing?.map(n => n.url) || [])
          newNews = newsItems.filter(item => 
            !item.url || !existingUrlsSet.has(item.url)
          )
        }

        if (newNews.length === 0) {
          results.push({ feed_id: feed.id, feed_name: feed.name, collected: 0 })
          continue
        }

        // Processar e classificar
        const shouldClassify = feed.auto_classify ?? true
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
                feed_id: feed.id, // Marcar de qual feed veio
              }
            })
          : newNews.map(item => ({
              ...item,
              processed: false,
              feed_id: feed.id, // Marcar de qual feed veio
            }))

        // Inserir no banco
        const { data, error } = await supabase
          .from('news')
          .insert(processedNews)
          .select()

        if (error) {
          console.error(`Erro ao inserir notícias do feed ${feed.id}:`, error)
          results.push({ feed_id: feed.id, feed_name: feed.name, error: error.message })
          continue
        }

        const collected = data?.length || 0
        totalCollected += collected

        // Contar alto risco
        const highRiskCount = processedNews.filter(n => n.risk_level === 'high').length
        totalHighRisk += highRiskCount

        // Atualizar last_collected_at
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
        if (highRiskCount > 0) {
          const alerts = processedNews
            .filter(n => n.risk_level === 'high')
            .map(news => ({
              news_id: data?.find(n => n.url === news.url)?.id,
              user_id: user.id,
              type: 'risk_high',
            }))
            .filter(a => a.news_id)

          if (alerts.length > 0) {
            await supabase.from('news_alerts').insert(alerts)
          }
        }

        results.push({
          feed_id: feed.id,
          feed_name: feed.name,
          collected,
          high_risk: highRiskCount,
          adversaries_detected: adversaryAttacks.length,
        })
      } catch (error) {
        console.error(`Erro ao processar feed ${feed.id}:`, error)
        results.push({
          feed_id: feed.id,
          feed_name: feed.name,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
        continue
      }
    }

    // Calcular total de adversários detectados
    const totalAdversariesDetected = results.reduce(
      (sum, r) => sum + (r.adversaries_detected || 0),
      0
    )

    return NextResponse.json({
      message: `Coleta concluída: ${totalCollected} notícias coletadas de ${feeds.length} feed(s)`,
      collected: totalCollected,
      high_risk: totalHighRisk,
      adversaries_detected: totalAdversariesDetected,
      feeds_processed: feeds.length,
      results,
    })
  } catch (error) {
    console.error('Erro na coleta:', error)
    return NextResponse.json(
      { error: 'Erro na coleta de notícias' },
      { status: 500 }
    )
  }
}

