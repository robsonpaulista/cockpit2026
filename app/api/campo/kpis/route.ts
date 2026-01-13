import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Agendas Realizadas
    const { data: agendas, error: agendasError } = await supabase
      .from('agendas')
      .select('id, status')

    if (agendasError) {
      console.error('Erro ao buscar agendas:', agendasError)
    }

    const totalAgendas = agendas?.length || 0
    const agendasConcluidas = agendas?.filter(a => a.status === 'concluida').length || 0
    const agendasVariation = totalAgendas > 0 
      ? Math.round(((agendasConcluidas / totalAgendas) * 100) - 50) // Comparação com meta de 50%
      : 0

    // 2. Municípios Visitados
    // Buscar agendas concluídas que têm visitas associadas
    const { data: agendasComVisitas, error: visitsError } = await supabase
      .from('agendas')
      .select('id, city_id, status')
      .eq('status', 'concluida')
      .not('city_id', 'is', null)

    if (visitsError) {
      console.error('Erro ao buscar municípios visitados:', visitsError)
    }

    // Verificar quais agendas têm visitas associadas
    const agendasComVisitasIds = agendasComVisitas?.map((a: any) => a.id) || []
    let agendasComVisitasReais: any[] = []
    
    if (agendasComVisitasIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select('agenda_id')
        .in('agenda_id', agendasComVisitasIds)
      
      const agendasComVisitasSet = new Set(visits?.map((v: any) => v.agenda_id) || [])
      agendasComVisitasReais = agendasComVisitas?.filter((a: any) => agendasComVisitasSet.has(a.id)) || []
    }

    // Contar cidades distintas visitadas
    const citiesVisited = new Set<string>()
    agendasComVisitasReais.forEach((agenda: any) => {
      if (agenda.city_id) {
        citiesVisited.add(agenda.city_id)
      }
    })

    const municipiosVisitados = citiesVisited.size
    // Para variação, comparar com período anterior (simplificado: usar 0 como base)
    const municipiosVariation = municipiosVisitados > 0 ? 3 : 0 // Placeholder - pode melhorar depois

    // 3. Demandas Resolvidas
    const { data: demands, error: demandsError } = await supabase
      .from('demands')
      .select('id, status')

    if (demandsError) {
      console.error('Erro ao buscar demandas:', demandsError)
    }

    const totalDemands = demands?.length || 0
    const demandsResolvidas = demands?.filter(d => d.status === 'resolvido').length || 0
    const demandsVariation = totalDemands > 0
      ? Math.round(((demandsResolvidas / totalDemands) * 100) - 50) // Comparação com meta de 50%
      : 0

    // 4. Promessas x Entregas
    const { data: promises, error: promisesError } = await supabase
      .from('promises')
      .select('id, status')

    if (promisesError) {
      console.error('Erro ao buscar promessas:', promisesError)
    }

    const totalPromises = promises?.length || 0
    const promisesCumpridas = promises?.filter(p => p.status === 'cumprida').length || 0
    const promisesVariation = totalPromises > 0
      ? Math.round(((promisesCumpridas / totalPromises) * 100) - 50) // Comparação com meta de 50%
      : 0

    const kpis = [
      {
        id: 'agendas',
        label: 'Agendas Realizadas',
        value: `${agendasConcluidas}/${totalAgendas}`,
        variation: agendasVariation,
        status: agendasVariation >= 0 ? 'success' : 'warning',
      },
      {
        id: 'municipios',
        label: 'Municípios Visitados',
        value: municipiosVisitados.toString(),
        variation: municipiosVariation,
        status: municipiosVariation >= 0 ? 'success' : 'warning',
      },
      {
        id: 'demandas',
        label: 'Demandas Resolvidas',
        value: `${demandsResolvidas}/${totalDemands}`,
        variation: demandsVariation,
        status: demandsVariation >= 0 ? 'success' : 'warning',
      },
      {
        id: 'promessas',
        label: 'Promessas x Entregas',
        value: `${promisesCumpridas}/${totalPromises}`,
        variation: promisesVariation,
        status: promisesVariation >= 0 ? 'success' : 'warning',
      },
    ]

    return NextResponse.json(kpis)
  } catch (error) {
    console.error('Erro ao buscar KPIs de Campo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

