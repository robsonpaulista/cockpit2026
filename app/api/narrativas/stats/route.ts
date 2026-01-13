import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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
    const theme = searchParams.get('theme')

    if (!theme) {
      return NextResponse.json(
        { error: 'Tema é obrigatório' },
        { status: 400 }
      )
    }

    // Contar posts do Instagram com esse tema
    const { count: instagramCount, error: instagramError } = await supabase
      .from('instagram_post_classifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('theme', theme)

    if (instagramError) {
      console.error('Erro ao contar posts do Instagram:', instagramError)
    }

    // Contar notícias com esse tema
    const { count: newsCount, error: newsError } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true })
      .eq('theme', theme)

    if (newsError) {
      console.error('Erro ao contar notícias:', newsError)
    }

    // Calcular performance baseado em:
    // - Posts impulsionados do Instagram (peso maior)
    // - Engajamento médio (se disponível)
    // Por enquanto, vamos usar uma fórmula simples baseada em uso
    const totalUsage = (instagramCount || 0) + (newsCount || 0)
    
    // Buscar posts impulsionados para calcular performance
    const { count: boostedCount, error: boostedError } = await supabase
      .from('instagram_post_classifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('theme', theme)
      .eq('is_boosted', true)

    if (boostedError) {
      console.error('Erro ao buscar posts impulsionados:', boostedError)
    }

    // Performance: baseado em uso total e posts impulsionados
    // Fórmula: (uso total * 10) + (posts impulsionados * 20), limitado a 100
    const boostedCountValue = boostedCount || 0
    const performanceScore = Math.min(
      100,
      Math.round((totalUsage * 10) + (boostedCountValue * 20))
    )

    return NextResponse.json({
      theme,
      usage_count: totalUsage,
      instagram_count: instagramCount || 0,
      news_count: newsCount || 0,
      boosted_count: boostedCountValue,
      performance_score: performanceScore,
    })
  } catch (error: any) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

