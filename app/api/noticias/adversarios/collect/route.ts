import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
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

// Coleta notícias dos feeds RSS configurados nos adversários
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
    const adversaryId = body.adversary_id // Opcional: se fornecido, coleta apenas deste adversário

    // Buscar adversários com RSS configurado
    let query = supabase
      .from('adversaries')
      .select('id, name, google_alerts_rss_url, themes')
      .not('google_alerts_rss_url', 'is', null)

    if (adversaryId) {
      query = query.eq('id', adversaryId)
    }

    const { data: adversaries, error: adversariesError } = await query

    if (adversariesError) {
      return NextResponse.json({ error: adversariesError.message }, { status: 500 })
    }

    if (!adversaries || adversaries.length === 0) {
      return NextResponse.json({
        message: 'Nenhum adversário com feed RSS configurado encontrado.',
        collected: 0,
      })
    }

    let totalCollected = 0
    let totalHighRisk = 0
    const results: any[] = []

    for (const adversary of adversaries) {
      if (!adversary.google_alerts_rss_url) continue

      try {
        console.log(`📡 Coletando notícias do adversário: ${adversary.name} (${adversary.id})`)
        console.log(`🔗 URL do feed: ${adversary.google_alerts_rss_url}`)
        
        const newsItems = await fetchGoogleAlerts(adversary.google_alerts_rss_url)

        console.log(`📊 Notícias encontradas: ${newsItems.length}`)

        if (newsItems.length === 0) {
          console.warn(`⚠️ Nenhuma notícia encontrada para ${adversary.name}`)
          results.push({
            adversary_id: adversary.id,
            adversary_name: adversary.name,
            collected: 0,
            message: 'Nenhuma notícia encontrada no feed',
          })
          continue
        }

        // Verificar duplicatas
        const existingUrls = newsItems
          .map(item => item.url)
          .filter((url): url is string => !!url)

        console.log(`🔍 Verificando ${existingUrls.length} URLs para duplicatas`)

        let newNews = newsItems
        if (existingUrls.length > 0) {
          const { data: existing, error: existingError } = await supabase
            .from('news')
            .select('url')
            .in('url', existingUrls)

          if (existingError) {
            console.error('Erro ao verificar duplicatas:', existingError)
          }

          const existingUrlsSet = new Set(existing?.map(n => n.url) || [])
          newNews = newsItems.filter(item => 
            !item.url || !existingUrlsSet.has(item.url)
          )
          
          console.log(`✨ ${newNews.length} notícias novas após filtrar duplicatas`)
        }

        if (newNews.length === 0) {
          console.log(`ℹ️ Todas as notícias já foram coletadas para ${adversary.name}`)
          results.push({
            adversary_id: adversary.id,
            adversary_name: adversary.name,
            collected: 0,
            message: 'Todas as notícias já foram coletadas',
          })
          continue
        }

        // Processar e classificar
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
            // Adicionar nome do adversário como actor
            actor: adversary.name,
            // Marcar que esta notícia veio do feed RSS deste adversário
            adversary_id: adversary.id,
          }
        })

        // Inserir no banco
        console.log(`💾 Inserindo ${processedNews.length} notícias no banco...`)
        console.log(`📝 Primeira notícia exemplo:`, {
          title: processedNews[0]?.title,
          adversary_id: processedNews[0]?.adversary_id,
          actor: processedNews[0]?.actor,
        })
        
        const { data, error } = await supabase
          .from('news')
          .insert(processedNews)
          .select()

        if (error) {
          console.error(`❌ Erro ao inserir notícias do adversário ${adversary.id}:`, {
            error: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            processedNewsCount: processedNews.length,
            firstNews: processedNews[0],
          })
          results.push({
            adversary_id: adversary.id,
            adversary_name: adversary.name,
            error: error.message,
            details: error.details,
          })
          continue
        }

        console.log(`✅ ${data?.length || 0} notícias inseridas com sucesso`)

        const collected = data?.length || 0
        totalCollected += collected

        // Contar alto risco
        const highRiskCount = processedNews.filter(n => n.risk_level === 'high').length
        totalHighRisk += highRiskCount

        // Detectar menções do adversário e criar registros de ataques
        const adversaryAttacks: any[] = []
        const adversaryMentions: Record<string, number> = {}

        if (data && data.length > 0) {
          for (const newsItem of data) {
            // Verificar se a notícia menciona o adversário
            const fullText = `${newsItem.title} ${newsItem.content || ''}`.toLowerCase()
            const adversaryNameLower = adversary.name.toLowerCase()
            
            // Detectar tipo de menção/ataque
            let attackType: 'direct' | 'indirect' | 'false_claim' | 'omission' = 'indirect'
            
            if (fullText.includes(adversaryNameLower)) {
              // Verificar se é menção direta (nome completo) ou indireta
              if (fullText.includes(adversaryNameLower)) {
                attackType = 'direct'
              }
              
              // Verificar palavras-chave de ataque
              const attackKeywords = ['critica', 'acusação', 'denúncia', 'escândalo', 'irregularidade']
              if (attackKeywords.some(keyword => fullText.includes(keyword))) {
                attackType = 'false_claim'
              }

              adversaryAttacks.push({
                adversary_id: adversary.id,
                news_id: newsItem.id,
                attack_type: attackType,
              })

              adversaryMentions[adversary.id] = (adversaryMentions[adversary.id] || 0) + 1
            }
          }

          // Inserir registros de ataques
          if (adversaryAttacks.length > 0) {
            await supabase.from('adversary_attacks').insert(adversaryAttacks)
          }

          // Atualizar Share of Voice
          if (adversaryMentions[adversary.id]) {
            const totalMentions = Object.values(adversaryMentions).reduce((a, b) => a + b, 0)
            const shareOfVoice = totalMentions > 0
              ? Math.round((adversaryMentions[adversary.id] / totalMentions) * 100)
              : 0

            await supabase
              .from('adversaries')
              .update({ 
                presence_score: shareOfVoice,
                last_updated: new Date().toISOString(),
              })
              .eq('id', adversary.id)
          }
        }

        // Criar alertas para alto risco
        if (highRiskCount > 0) {
          const alerts = processedNews
            .filter(n => n.risk_level === 'high')
            .map(news => ({
              news_id: data?.find(n => n.url === news.url)?.id,
              user_id: user.id,
              type: 'risk_high' as const,
            }))
            .filter(a => a.news_id)

          if (alerts.length > 0) {
            await supabase.from('news_alerts').insert(alerts)
          }
        }

        results.push({
          adversary_id: adversary.id,
          adversary_name: adversary.name,
          collected,
          high_risk: highRiskCount,
          attacks_detected: adversaryAttacks.length,
        })
      } catch (error) {
        console.error(`Erro ao processar adversário ${adversary.id}:`, error)
        results.push({
          adversary_id: adversary.id,
          adversary_name: adversary.name,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
        continue
      }
    }

    const totalAttacksDetected = results.reduce(
      (sum, r) => sum + (r.attacks_detected || 0),
      0
    )

    return NextResponse.json({
      message: `Coleta concluída: ${totalCollected} notícias coletadas de ${adversaries.length} adversário(s)`,
      collected: totalCollected,
      high_risk: totalHighRisk,
      attacks_detected: totalAttacksDetected,
      adversaries_processed: adversaries.length,
      results,
    })
  } catch (error) {
    console.error('Erro na coleta de notícias dos adversários:', error)
    return NextResponse.json(
      { error: 'Erro na coleta de notícias' },
      { status: 500 }
    )
  }
}

