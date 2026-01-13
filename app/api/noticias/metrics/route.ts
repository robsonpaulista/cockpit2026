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
    const days = parseInt(searchParams.get('days') || '24') // Últimas 24 horas por padrão

    const startDate = new Date()
    startDate.setHours(startDate.getHours() - days)

    // Contar menções nas últimas 24h
    const { count: mentionsCount } = await supabase
      .from('news')
      .select('*', { count: 'exact', head: true })
      .gte('collected_at', startDate.toISOString())

    // Contar crises de risco alto abertas
    const { count: highRiskCrises } = await supabase
      .from('crises')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .in('severity', ['high', 'critical'])

    // Calcular tempo médio de resposta (apenas crises resolvidas)
    const { data: resolvedCrises } = await supabase
      .from('crises')
      .select('response_time')
      .eq('status', 'resolved')
      .not('response_time', 'is', null)

    const avgResponseTime = resolvedCrises && resolvedCrises.length > 0
      ? resolvedCrises.reduce((acc, c) => acc + (c.response_time || 0), 0) / resolvedCrises.length
      : 0

    const avgResponseTimeHours = avgResponseTime > 0 ? (avgResponseTime / 60).toFixed(1) : '0'

    // Calcular Share of Voice (simplificado: baseado em presença de adversários)
    const { data: adversaries } = await supabase
      .from('adversaries')
      .select('presence_score')

    const totalPresence = adversaries?.reduce((acc, a) => acc + (a.presence_score || 0), 0) || 0
    const shareOfVoice = adversaries && adversaries.length > 0 && totalPresence > 0
      ? Math.round((100 / totalPresence) * 100) // Simplificado - ajustar lógica real
      : 0

    return NextResponse.json({
      mentions_24h: mentionsCount || 0,
      high_risk_crises_open: highRiskCrises || 0,
      avg_response_time_hours: parseFloat(avgResponseTimeHours),
      share_of_voice: shareOfVoice,
    })
  } catch (error) {
    console.error('Erro ao buscar métricas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}




