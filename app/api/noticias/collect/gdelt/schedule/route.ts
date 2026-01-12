import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchGDELTRecent } from '@/lib/services/gdelt'

// Endpoint para coleta agendada do GDELT
// Pode ser chamado por cron job (Vercel Cron, GitHub Actions, etc.)
// Recomendado: a cada 30 min ou 1h

export async function POST(request: Request) {
  try {
    // Verificar se é uma chamada autorizada (pode usar um secret token)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = createClient()
    
    // Buscar termos dos feeds configurados (usar os mesmos termos do Google Alerts)
    const { data: feeds } = await supabase
      .from('news_feeds')
      .select('name')
      .eq('active', true)

    // Extrair termos únicos dos feeds (usar o 'name' do feed como termo de busca)
    let gdeltQueries: string[] = []
    if (feeds && feeds.length > 0) {
      gdeltQueries = [...new Set(feeds.map(feed => feed.name.trim()))]
    }

    // Fallback para variável de ambiente se não houver feeds configurados
    if (gdeltQueries.length === 0) {
      gdeltQueries = process.env.GDELT_QUERIES?.split(',').map(q => q.trim()) || []
    }
    
    if (gdeltQueries.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma query GDELT configurada. Configure feeds RSS ou GDELT_QUERIES no .env',
        collected: 0,
      })
    }

    let totalCollected = 0
    const results: Array<{ query: string; collected: number; error?: string }> = []

    // Buscar últimas 24 horas (padrão para GDELT)
    const hours = 24
    const maxRecords = 100 // Máximo por query

    for (const query of gdeltQueries) {
      try {
        console.log(`[GDELT Schedule] Buscando: ${query}`)
        
        const newsItems = await fetchGDELTRecent(query, hours, maxRecords)

        if (newsItems.length === 0) {
          results.push({ query, collected: 0 })
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
          results.push({ query, collected: 0 })
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
          processed: false, // GDELT não classifica automaticamente
          reviewed: false,
        }))

        // Inserir no banco
        const { data, error } = await supabase
          .from('news')
          .insert(processedNews)
          .select()

        if (error) {
          console.error(`[GDELT Schedule] Erro ao inserir notícias para query "${query}":`, error)
          results.push({ query, collected: 0, error: error.message })
          continue
        }

        const collected = data?.length || 0
        totalCollected += collected
        results.push({ query, collected })
      } catch (error) {
        console.error(`[GDELT Schedule] Erro ao processar query "${query}":`, error)
        results.push({ 
          query, 
          collected: 0, 
          error: error instanceof Error ? error.message : 'Erro desconhecido' 
        })
      }
    }

    return NextResponse.json({
      message: `Coleta GDELT concluída: ${totalCollected} notícias coletadas`,
      collected: totalCollected,
      queries_processed: gdeltQueries.length,
      results,
    })
  } catch (error) {
    console.error('[GDELT Schedule] Erro geral:', error)
    return NextResponse.json(
      { 
        error: 'Erro ao coletar notícias do GDELT',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
