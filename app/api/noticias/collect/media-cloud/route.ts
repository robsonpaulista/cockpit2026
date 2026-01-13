import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchMediaCloud, fetchMediaCloudRecent, validateMediaCloudApiKey } from '@/lib/services/media-cloud'

const collectSchema = z.object({
  api_key: z.string().min(1, 'API key do Media Cloud é obrigatória'),
  query: z.string().min(1, 'Query é obrigatória'),
  collections_ids: z.string().optional(), // IDs das coleções (formato: "1,2,3")
  days: z.number().optional(), // Buscar últimos N dias
  start_date: z.string().optional(), // Formato: YYYY-MM-DD
  end_date: z.string().optional(), // Formato: YYYY-MM-DD
  limit: z.number().optional().default(100),
  auto_classify: z.boolean().optional().default(false), // Media Cloud não classifica automaticamente
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
    const { api_key, query, collections_ids, days, start_date, end_date, limit, auto_classify } = collectSchema.parse(body)

    // Validar API key
    if (!validateMediaCloudApiKey(api_key)) {
      return NextResponse.json(
        { error: 'API key do Media Cloud inválida' },
        { status: 400 }
      )
    }

    // Buscar notícias do Media Cloud
    let newsItems
    if (days) {
      // Buscar últimos N dias
      newsItems = await fetchMediaCloudRecent(api_key, query, days, limit)
    } else {
      // Buscar com datas específicas ou período padrão (últimos 7 dias)
      if (start_date && end_date) {
        newsItems = await fetchMediaCloud(api_key, query, collections_ids, start_date, end_date, limit)
      } else {
        // Padrão: últimos 7 dias
        newsItems = await fetchMediaCloudRecent(api_key, query, 7, limit)
      }
    }

    if (newsItems.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma notícia encontrada no Media Cloud',
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

      // Media Cloud: armazenar dados brutos, sem classificação automática (conforme especificação)
      const processedNews = newNews.map(item => ({
        title: item.title,
        source: item.source,
        source_type: 'media_cloud',
        url: item.url,
        content: item.content,
        published_at: item.published_at,
        publisher: item.publisher,
        processed: auto_classify, // Só marcar como processado se houver classificação automática
        reviewed: false, // Media Cloud não vem classificado
      }))

      // Inserir no banco
      const { data, error } = await supabase
        .from('news')
        .insert(processedNews)
        .select()

      if (error) {
        console.error('Erro ao inserir notícias do Media Cloud:', error)
        return NextResponse.json(
          { error: 'Erro ao salvar notícias', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `${data.length} notícias coletadas do Media Cloud`,
        collected: data.length,
        news: data,
      })
    }

    return NextResponse.json({
      message: 'Nenhuma notícia nova encontrada',
      collected: 0,
    })
  } catch (error) {
    console.error('Erro ao coletar notícias do Media Cloud:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Erro ao coletar notícias do Media Cloud',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
