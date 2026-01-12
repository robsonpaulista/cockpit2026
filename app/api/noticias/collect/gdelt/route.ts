import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchGDELT, fetchGDELTRecent, formatGDELTDateTime } from '@/lib/services/gdelt'

const collectSchema = z.object({
  query: z.string().min(1, 'Query é obrigatória'),
  maxRecords: z.number().optional().default(100),
  hours: z.number().optional(), // Buscar últimas N horas
  startDateTime: z.string().optional(), // Formato: YYYYMMDDHHMMSS
  endDateTime: z.string().optional(), // Formato: YYYYMMDDHHMMSS
  auto_classify: z.boolean().optional().default(false), // GDELT geralmente não classifica automaticamente
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
    const { query, maxRecords, hours, startDateTime, endDateTime, auto_classify } = collectSchema.parse(body)

    // Buscar notícias do GDELT
    let newsItems
    if (hours) {
      // Buscar últimas N horas
      newsItems = await fetchGDELTRecent(query, hours, maxRecords)
    } else {
      // Buscar com datas específicas ou período padrão (últimas 24h)
      if (startDateTime && endDateTime) {
        newsItems = await fetchGDELT(query, maxRecords, startDateTime, endDateTime)
      } else {
        // Padrão: últimas 24 horas
        newsItems = await fetchGDELTRecent(query, 24, maxRecords)
      }
    }

    if (newsItems.length === 0) {
      return NextResponse.json({
        message: 'Nenhuma notícia encontrada no GDELT',
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

      // GDELT: armazenar dados brutos, sem classificação automática (conforme especificação)
      // Mas permitir classificação automática se solicitado explicitamente
      const processedNews = newNews.map(item => ({
        title: item.title,
        source: item.source,
        source_type: 'gdelt',
        url: item.url,
        content: item.content,
        published_at: item.published_at,
        publisher: item.publisher,
        processed: auto_classify, // Só marcar como processado se houver classificação automática
        reviewed: false, // GDELT não vem classificado
      }))

      // Inserir no banco
      const { data, error } = await supabase
        .from('news')
        .insert(processedNews)
        .select()

      if (error) {
        console.error('Erro ao inserir notícias do GDELT:', error)
        return NextResponse.json(
          { error: 'Erro ao salvar notícias', details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `${data.length} notícias coletadas do GDELT`,
        collected: data.length,
        news: data,
      })
    }

    return NextResponse.json({
      message: 'Nenhuma notícia nova encontrada',
      collected: 0,
    })
  } catch (error) {
    console.error('Erro ao coletar notícias do GDELT:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Erro ao coletar notícias do GDELT',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
