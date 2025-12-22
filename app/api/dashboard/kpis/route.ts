import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar métrica mais recente
    const { data: latestMetric } = await supabase
      .from('daily_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // Se não houver métrica, calcular on-the-fly ou retornar mock
    if (!latestMetric) {
      // Por enquanto retornar mock até termos dados
      return NextResponse.json({
        ife: {
          value: 72,
          variation: 3.2,
          status: 'success',
        },
        presenca: {
          value: '45/120',
          variation: 5,
          status: 'success',
        },
        base: {
          value: 1280,
          variation: 12,
          status: 'success',
        },
        engajamento: {
          value: '12.4K',
          variation: -2.1,
          status: 'warning',
        },
        sentimento: {
          value: '68%',
          variation: 4.5,
          status: 'success',
        },
        risco: {
          value: 2,
          variation: -1,
          status: 'success',
        },
      })
    }

    // Calcular variação 7 dias (buscar registros ordenados e pegar o 8º)
    const { data: allMetrics } = await supabase
      .from('daily_metrics')
      .select('ife_score, date')
      .order('date', { ascending: false })
      .limit(8)
    
    const weekAgoMetric = allMetrics && allMetrics.length >= 8 ? allMetrics[7] : null

    const ifeVariation = weekAgoMetric
      ? ((latestMetric.ife_score - weekAgoMetric.ife_score) / weekAgoMetric.ife_score) * 100
      : 0

    // Buscar dados agregados de outros módulos
    const [agendasCount, leadershipsCount] = await Promise.all([
      supabase
        .from('agendas')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('leaderships')
        .select('id', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      ife: {
        value: latestMetric.ife_score || 0,
        variation: ifeVariation,
        status: ifeVariation >= 0 ? 'success' : 'warning',
      },
      presenca: {
        value: latestMetric.presence_territorial || 0,
        variation: 0, // TODO: calcular variação
        status: 'success',
      },
      base: {
        value: leadershipsCount.count || 0,
        variation: 0, // TODO: calcular variação
        status: 'success',
      },
      engajamento: {
        value: latestMetric.useful_engagement || 0,
        variation: 0,
        status: 'success',
      },
      sentimento: {
        value: latestMetric.public_sentiment || 0,
        variation: 0,
        status: 'success',
      },
      risco: {
        value: latestMetric.crisis_risk || 0,
        variation: 0,
        status: latestMetric.crisis_risk > 5 ? 'error' : 'success',
      },
    })
  } catch (error) {
    console.error('Error fetching KPIs:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar KPIs' },
      { status: 500 }
    )
  }
}

