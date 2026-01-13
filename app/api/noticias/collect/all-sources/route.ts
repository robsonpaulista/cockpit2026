import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchGoogleAlerts, analyzeSentiment, analyzeRisk, extractTheme } from '@/lib/services/google-alerts'
import { fetchGDELTRecent } from '@/lib/services/gdelt'
import { fetchMediaCloudRecent, validateMediaCloudApiKey } from '@/lib/services/media-cloud'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, logError } from '@/lib/logger'

// API para coletar de todas as fontes usando os mesmos termos dos feeds do Google Alerts
// Usa o campo 'name' do feed como termo de busca para GDELT e Media Cloud

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // ✅ Rate limiting - Proteção contra abuso
    const rateLimitResult = checkRateLimit(
      `news-collect:${user.id}`,
      RATE_LIMITS.NEWS_COLLECT
    )

    if (!rateLimitResult.success) {
      logger.warn('Rate limit excedido na coleta de notícias', {
        userId: user.id,
        endpoint: '/api/noticias/collect/all-sources',
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
      })

      return NextResponse.json(
        {
          error: 'Muitas requisições de coleta. Aguarde antes de tentar novamente.',
          resetAt: rateLimitResult.resetAt,
          remaining: rateLimitResult.remaining,
          limit: RATE_LIMITS.NEWS_COLLECT.maxRequests,
          window: '1 hora',
          message: 'Você pode coletar notícias até 10 vezes por hora.',
          collected: 0,
          results: [],
          search_terms_used: [],
        },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.NEWS_COLLECT.maxRequests),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      }
    )

    const body = await request.json().catch(() => ({}))
    const { 
      include_gdelt = true,
      include_media_cloud = false,
      media_cloud_api_key,
      maxRecords = 50,
      hours = 24,
      days = 7,
    } = body

    // Buscar feeds configurados do usuário
    const { data: feeds, error: feedsError } = await supabase
      .from('news_feeds')
      .select('id, name, rss_url, auto_classify')
      .eq('user_id', user.id)
      .eq('active', true)

    if (feedsError) {
      logError('Erro ao buscar feeds', feedsError, {
        userId: user.id,
        endpoint: '/api/noticias/collect/all-sources',
      })
      return NextResponse.json({ error: feedsError.message }, { status: 500 })
    }

    if (!feeds || feeds.length === 0) {
      logger.info('Nenhum feed configurado', { userId: user.id })
      return NextResponse.json({
        message: 'Nenhum feed RSS configurado. Configure feeds primeiro.',
        collected: 0,
      })
    }

    logger.info('Iniciando coleta de notícias', {
      userId: user.id,
      feedsCount: feeds.length,
      includeGdelt: body.include_gdelt,
      includeMediaCloud: body.include_media_cloud,
    })

    let totalCollected = 0
    const results: any[] = []

    // Extrair termos únicos dos feeds (usar o 'name' do feed)
    const searchTerms = [...new Set(feeds.map(feed => feed.name.trim()))]

    logger.debug(`Buscando com ${searchTerms.length} termos`, {
      userId: user.id,
      terms: searchTerms,
    })

    // 1. Coletar do Google Alerts (feeds RSS existentes)
    for (const feed of feeds) {
      try {
        const newsItems = await fetchGoogleAlerts(feed.rss_url)

        if (newsItems.length === 0) {
          results.push({ 
            source: 'google_alerts',
            feed_name: feed.name,
            collected: 0 
          })
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
          results.push({ 
            source: 'google_alerts',
            feed_name: feed.name,
            collected: 0 
          })
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
                source_type: 'google_alerts',
                sentiment,
                risk_level: risk,
                theme,
                processed: true,
                feed_id: feed.id,
              }
            })
          : newNews.map(item => ({
              ...item,
              source_type: 'google_alerts',
              processed: false,
              feed_id: feed.id,
            }))

        // Inserir no banco
        const { data, error } = await supabase
          .from('news')
          .insert(processedNews)
          .select()

        if (error) {
          logError(`Erro ao inserir notícias do Google Alerts`, error, {
            userId: user.id,
            feedName: feed.name,
            feedId: feed.id,
            source: 'google_alerts',
          })
          results.push({ 
            source: 'google_alerts',
            feed_name: feed.name,
            collected: 0,
            error: error.message 
          })
          continue
        }

        const collected = data?.length || 0
        totalCollected += collected
        results.push({ 
          source: 'google_alerts',
          feed_name: feed.name,
          collected 
        })
      } catch (error) {
        logError(`Erro ao processar feed Google Alerts`, error, {
          userId: user.id,
          feedName: feed.name,
          feedId: feed.id,
          source: 'google_alerts',
        })
        results.push({
          source: 'google_alerts',
          feed_name: feed.name,
          collected: 0,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    // 2. Coletar do GDELT usando os mesmos termos
    if (include_gdelt) {
      for (const term of searchTerms) {
        try {
          logger.debug(`Buscando GDELT`, {
            userId: user.id,
            term,
          })
          
          // Filtrar por Brasil (sourcecountry=BR)
          const newsItems = await fetchGDELTRecent(term, hours, maxRecords, 'BR')

          if (newsItems.length === 0) {
            results.push({ 
              source: 'gdelt',
              search_term: term,
              collected: 0 
            })
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
            results.push({ 
              source: 'gdelt',
              search_term: term,
              collected: 0 
            })
            continue
          }

          // GDELT: armazenar dados brutos, sem classificação automática
          const processedNews = newNews.map(item => ({
            title: item.title,
            source: item.source,
            source_type: 'gdelt',
            url: item.url,
            content: item.content,
            published_at: item.published_at,
            publisher: item.publisher,
            processed: false,
            reviewed: false,
          }))

          // Inserir no banco
          const { data, error } = await supabase
            .from('news')
            .insert(processedNews)
            .select()

          if (error) {
            logError(`Erro ao inserir notícias do GDELT`, error, {
              userId: user.id,
              term,
              source: 'gdelt',
            })
            results.push({ 
              source: 'gdelt',
              search_term: term,
              collected: 0,
              error: error.message 
            })
            continue
          }

          const collected = data?.length || 0
          totalCollected += collected
          results.push({ 
            source: 'gdelt',
            search_term: term,
            collected 
          })
        } catch (error) {
          logError(`Erro ao processar GDELT`, error, {
            userId: user.id,
            term,
            source: 'gdelt',
          })
          results.push({
            source: 'gdelt',
            search_term: term,
            collected: 0,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          })
        }
      }
    }

    // 3. Coletar do Media Cloud usando os mesmos termos
    if (include_media_cloud) {
      if (!validateMediaCloudApiKey(media_cloud_api_key)) {
        results.push({
          source: 'media_cloud',
          collected: 0,
          error: 'API key do Media Cloud não fornecida ou inválida',
        })
      } else {
        for (const term of searchTerms) {
          try {
            logger.debug(`Buscando Media Cloud`, {
              userId: user.id,
              term,
            })
            
            const newsItems = await fetchMediaCloudRecent(media_cloud_api_key, term, days, maxRecords)

            if (newsItems.length === 0) {
              results.push({ 
                source: 'media_cloud',
                search_term: term,
                collected: 0 
              })
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
              results.push({ 
                source: 'media_cloud',
                search_term: term,
                collected: 0 
              })
              continue
            }

            // Media Cloud: armazenar dados brutos, sem classificação automática
            const processedNews = newNews.map(item => ({
              title: item.title,
              source: item.source,
              source_type: 'media_cloud',
              url: item.url,
              content: item.content,
              published_at: item.published_at,
              publisher: item.publisher,
              processed: false,
              reviewed: false,
            }))

            // Inserir no banco
            const { data, error } = await supabase
              .from('news')
              .insert(processedNews)
              .select()

            if (error) {
              logError(`Erro ao inserir notícias do Media Cloud`, error, {
                userId: user.id,
                term,
                source: 'media_cloud',
              })
              results.push({ 
                source: 'media_cloud',
                search_term: term,
                collected: 0,
                error: error.message 
              })
              continue
            }

            const collected = data?.length || 0
            totalCollected += collected
            results.push({ 
              source: 'media_cloud',
              search_term: term,
              collected 
            })
          } catch (error) {
            logError(`Erro ao processar Media Cloud`, error, {
              userId: user.id,
              term,
              source: 'media_cloud',
            })
            results.push({
              source: 'media_cloud',
              search_term: term,
              collected: 0,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            })
          }
        }
      }
    }

    logger.info('Coleta de notícias concluída', {
      userId: user.id,
      totalCollected,
      sourcesCount: results.length,
      searchTermsCount: searchTerms.length,
    })

    return NextResponse.json(
      {
        message: `Coleta concluída: ${totalCollected} notícias coletadas de todas as fontes`,
        collected: totalCollected,
        results,
        search_terms_used: searchTerms,
      },
      {
        headers: {
          'X-RateLimit-Limit': String(RATE_LIMITS.NEWS_COLLECT.maxRequests),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
        },
      }
    )
  } catch (error) {
    logError('Erro ao coletar de todas as fontes', error, {
      endpoint: '/api/noticias/collect/all-sources',
    })
    return NextResponse.json(
      { 
        error: 'Erro ao coletar notícias',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
