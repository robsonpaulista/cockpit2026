import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Retorna todos os feeds unificados (do usuário + adversários)
export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar feeds do usuário
    const { data: userFeeds, error: userFeedsError } = await supabase
      .from('news_feeds')
      .select('id, name, rss_url, active')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (userFeedsError) {
      console.error('Erro ao buscar feeds do usuário:', userFeedsError)
    }

    // Buscar feeds de adversários
    const { data: adversaries, error: adversariesError } = await supabase
      .from('adversaries')
      .select('id, name, google_alerts_rss_url')
      .not('google_alerts_rss_url', 'is', null)

    if (adversariesError) {
      console.error('Erro ao buscar adversários:', adversariesError)
    }

    // Unificar feeds
    const allFeeds = [
      ...(userFeeds || []).map(feed => ({
        id: feed.id,
        name: feed.name,
        type: 'user_feed' as const,
        rss_url: feed.rss_url,
        active: feed.active,
      })),
      ...(adversaries || []).map(adversary => ({
        id: adversary.id,
        name: adversary.name,
        type: 'adversary_feed' as const,
        rss_url: adversary.google_alerts_rss_url,
        active: true, // Adversários sempre ativos
      })),
    ]

    return NextResponse.json(allFeeds)
  } catch (error) {
    console.error('Erro ao buscar feeds:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

