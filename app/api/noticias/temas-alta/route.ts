import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7') // Últimos 7 dias por padrão
    const limit = parseInt(searchParams.get('limit') || '10')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Buscar todas as notícias do período com temas
    const { data: news } = await supabase
      .from('news')
      .select('theme, collected_at')
      .gte('collected_at', startDate.toISOString())
      .not('theme', 'is', null)

    if (!news) {
      return NextResponse.json([])
    }

    // Agrupar por tema e contar
    const themeCounts: Record<string, { count: number; recent: number }> = {}

    news.forEach((item) => {
      if (!item.theme) return

      if (!themeCounts[item.theme]) {
        themeCounts[item.theme] = { count: 0, recent: 0 }
      }

      themeCounts[item.theme].count++

      // Contar menções recentes (últimas 24h)
      const itemDate = new Date(item.collected_at)
      const oneDayAgo = new Date()
      oneDayAgo.setHours(oneDayAgo.getHours() - 24)

      if (itemDate >= oneDayAgo) {
        themeCounts[item.theme].recent++
      }
    })

    // Converter para array e ordenar
    const temasAlta = Object.entries(themeCounts)
      .map(([tema, data]) => ({
        tema,
        mencoes: data.count,
        recentes: data.recent,
        tendencia: data.recent > 0 ? `+${data.recent}` : '0',
      }))
      .sort((a, b) => b.mencoes - a.mencoes)
      .slice(0, limit)

    return NextResponse.json(temasAlta)
  } catch (error) {
    console.error('Erro ao buscar temas em alta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}




