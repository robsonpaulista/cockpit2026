import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

// Função para normalizar nomes de cidades (para comparação)
function normalizeCityName(name: string): string {
  if (!name) return ''
  
  // Converter para minúsculo, remover acentos e espaços extras
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')
    .trim()
}

// Função para formatar nome da cidade para exibição (capitalize)
function formatCityName(name: string): string {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Palavras que devem ficar em minúsculo (exceto no início)
      const lowercaseWords = ['de', 'da', 'do', 'das', 'dos', 'e']
      if (lowercaseWords.includes(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
    // Garantir que a primeira letra seja maiúscula
    .replace(/^./, str => str.toUpperCase())
}

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    // Body opcional (legado do cliente Sheets); expectativa vem do banco.
    await request.json().catch(() => ({}))

    // 1. Expectativa de votos (padrão Legado) + lideranças via territorio_liderancas
    const expectativaPorCidade: Record<string, number> = {}
    const liderancasPorCidade: Record<string, number> = {}
    const nomeOriginalCidade: Record<string, string> = {}

    try {
      const { summaries } = await buildCitySummariesFromDb()
      for (const [rawKey, summary] of summaries.entries()) {
        const cidadeKey = normalizeCityName(rawKey)
        if (!cidadeKey) continue
        const legado = Number(summary.expectativaLegadoVotos || 0)
        if (legado > 0) {
          expectativaPorCidade[cidadeKey] = (expectativaPorCidade[cidadeKey] || 0) + legado
        }
        const liderancas = Number(summary.liderancas || 0)
        if (liderancas > 0) {
          liderancasPorCidade[cidadeKey] = (liderancasPorCidade[cidadeKey] || 0) + liderancas
        }
        if (!nomeOriginalCidade[cidadeKey]) {
          nomeOriginalCidade[cidadeKey] = formatCityName(rawKey)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar expectativa de votos (territorio_liderancas):', error)
    }

    // 2. Buscar TODAS as agendas (não apenas concluídas)
    const { data: todasAgendas, error: agendasError } = await supabase
      .from('agendas')
      .select(`
        id,
        city_id,
        status,
        date,
        type,
        cities (
          id,
          name
        )
      `)
      .not('city_id', 'is', null)
      .order('date', { ascending: false })

    if (agendasError) {
      console.error('Erro ao buscar agendas:', agendasError)
    }

    // Buscar visitas separadamente
    const agendasIds = todasAgendas?.map((a: any) => a.id) || []
    let visitasPorAgenda: Record<string, boolean> = {}
    
    if (agendasIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select('agenda_id, checkin_time')
        .in('agenda_id', agendasIds)
      
      visits?.forEach((visit: any) => {
        visitasPorAgenda[visit.agenda_id] = true
      })
    }

    // Contar visitas e agendas por cidade (usando chave normalizada)
    const visitasPorCidade: Record<string, number> = {}
    const agendasPorCidade: Record<string, number> = {}
    const ultimaVisitaPorCidade: Record<string, string> = {}

    todasAgendas?.forEach((agenda: any) => {
      if (agenda.cities) {
        const cidadeOriginal = agenda.cities.name
        const cidadeKey = normalizeCityName(cidadeOriginal)
        
        // Guardar nome formatado (priorizar o do banco IBGE que é mais correto)
        nomeOriginalCidade[cidadeKey] = cidadeOriginal
        
        // Contar agendas totais
        agendasPorCidade[cidadeKey] = (agendasPorCidade[cidadeKey] || 0) + 1
        
        // Contar visitas com checkin
        if (visitasPorAgenda[agenda.id]) {
          visitasPorCidade[cidadeKey] = (visitasPorCidade[cidadeKey] || 0) + 1
          
          // Registrar última visita
          if (!ultimaVisitaPorCidade[cidadeKey] || agenda.date > ultimaVisitaPorCidade[cidadeKey]) {
            ultimaVisitaPorCidade[cidadeKey] = agenda.date
          }
        }
      }
    })

    // 3. Buscar demandas pendentes por cidade
    const { data: demands, error: demandsError } = await supabase
      .from('demands')
      .select(`
        id,
        status,
        visit_id
      `)
      .neq('status', 'resolvido')
      .not('visit_id', 'is', null)

    if (demandsError) {
      console.error('Erro ao buscar demandas:', demandsError)
    }

    // Buscar visitas e agendas das demandas
    const visitIds = demands?.map((d: any) => d.visit_id).filter(Boolean) || []
    let demandasPorCidade: Record<string, number> = {}

    if (visitIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select(`
          id,
          agenda_id,
          agendas (
            id,
            city_id,
            cities (
              name
            )
          )
        `)
        .in('id', visitIds)

      visits?.forEach((visit: any) => {
        const cidadeNome = visit.agendas?.cities?.name
        if (cidadeNome) {
          const cidadeKey = normalizeCityName(cidadeNome)
          demandasPorCidade[cidadeKey] = (demandasPorCidade[cidadeKey] || 0) + 1
        }
      })
    }

    // 4. Construir análise completa por cidade
    const todasCidades = new Set([
      ...Object.keys(expectativaPorCidade),
      ...Object.keys(visitasPorCidade),
      ...Object.keys(agendasPorCidade),
    ])

    const analiseCidades: Array<{
      cidade: string
      expectativaVotos: number
      liderancas: number
      visitas: number
      agendas: number
      demandasPendentes: number
      ultimaVisita: string | null
      status: 'quente' | 'morno' | 'frio' | 'sem-dados'
      motivo: string
    }> = []

    const mediaExpectativa = Object.values(expectativaPorCidade).length > 0
      ? Object.values(expectativaPorCidade).reduce((a, b) => a + b, 0) / Object.values(expectativaPorCidade).length
      : 0

    todasCidades.forEach((cidade) => {
      const expectativa = expectativaPorCidade[cidade] || 0
      const liderancas = liderancasPorCidade[cidade] || 0
      const visitas = visitasPorCidade[cidade] || 0
      const agendas = agendasPorCidade[cidade] || 0
      const demandasPendentes = demandasPorCidade[cidade] || 0
      const ultimaVisita = ultimaVisitaPorCidade[cidade] || null

      // Determinar status
      let status: 'quente' | 'morno' | 'frio' | 'sem-dados' = 'sem-dados'
      let motivo = ''

      // Cidades com visitas são classificadas por temperatura
      if (visitas >= 3 || (visitas >= 2 && demandasPendentes === 0)) {
        // QUENTE: 3+ visitas ou 2+ visitas sem demandas pendentes
        status = 'quente'
        motivo = `${visitas} visitas realizadas`
      } else if (visitas >= 1) {
        // MORNO: pelo menos 1 visita
        status = 'morno'
        motivo = `${visitas} visita${visitas > 1 ? 's' : ''} realizada${visitas > 1 ? 's' : ''}`
      } else if (expectativa > 0) {
        // FRIO: tem expectativa de votos mas nenhuma visita
        const temAltaExpectativa = expectativa > mediaExpectativa || expectativa > 500
        
        if (temAltaExpectativa) {
          status = 'frio'
          motivo = 'Baixa presença'
        } else {
          status = 'morno'
          motivo = 'Nenhuma visita ainda'
        }
      } else if (agendas > 0) {
        // Tem agendas mas nenhuma visita concluída
        status = 'morno'
        motivo = `${agendas} agenda${agendas > 1 ? 's' : ''} pendente${agendas > 1 ? 's' : ''}`
      } else {
        // Sem dados
        status = 'sem-dados'
        motivo = 'Sem dados'
      }

      // Ajustar para frio se tiver muitas demandas pendentes
      if (demandasPendentes > 3 && status !== 'quente') {
        status = 'frio'
        motivo = motivo ? `${motivo} + ${demandasPendentes} demandas` : `${demandasPendentes} demandas pendentes`
      }

      // Usar nome formatado para exibição (ou a chave se não tiver)
      const cidadeExibicao = nomeOriginalCidade[cidade] || formatCityName(cidade)
      
      analiseCidades.push({
        cidade: cidadeExibicao,
        expectativaVotos: Math.round(expectativa),
        liderancas,
        visitas,
        agendas,
        demandasPendentes,
        ultimaVisita,
        status,
        motivo,
      })
    })

    // Separar por status
    const territoriosFrios = analiseCidades
      .filter((c) => c.status === 'frio')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 10)

    const territoriosQuentes = analiseCidades
      .filter((c) => c.status === 'quente')
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 5)

    const territoriosMornos = analiseCidades
      .filter((c) => c.status === 'morno')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 5)

    // Cidades não visitadas (0 visitas) ordenadas por expectativa de votos
    const cidadesNaoVisitadasLista = analiseCidades
      .filter((c) => c.visitas === 0 && c.status !== 'sem-dados')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 10)
      .map((c) => ({
        cidade: c.cidade,
        expectativaVotos: c.expectativaVotos,
        motivo: 'Ainda não visitada',
      }))

    // Estatísticas gerais
    const totalCidades = analiseCidades.filter((c) => c.status !== 'sem-dados').length
    const totalVisitas = Object.values(visitasPorCidade).reduce((a, b) => a + b, 0)
    const totalExpectativa = Object.values(expectativaPorCidade).reduce((a, b) => a + b, 0)
    const cidadesVisitadas = Object.keys(visitasPorCidade).length
    const cidadesNaoVisitadas = totalCidades - cidadesVisitadas

    // Lista de cidades que possuem ao menos 1 liderança (nomes formatados)
    const cidadesComLiderancas = Object.entries(liderancasPorCidade)
      .filter(([, count]) => count > 0)
      .map(([cidadeKey]) => nomeOriginalCidade[cidadeKey] || formatCityName(cidadeKey))

    // Lista de cidades visitadas (com check-in) - nomes formatados
    const cidadesVisitadasLista = Object.keys(visitasPorCidade)
      .map((cidadeKey) => nomeOriginalCidade[cidadeKey] || formatCityName(cidadeKey))

    // Mapa completo de previsão por cidade (sem cortes), usado no resumo global do mapa
    const expectativaPorCidadeLista = Object.entries(expectativaPorCidade)
      .map(([cidadeKey, expectativa]) => ({
        cidade: nomeOriginalCidade[cidadeKey] || formatCityName(cidadeKey),
        expectativaVotos: Math.round(expectativa),
      }))

    // Painel tela cheia: cruza TODOS os municípios do PI com expectativa (DB Legado) + visitas/check-ins de campo
    const nomeCanonPorChave = new Map<string, string>()
    for (const m of municipiosPiaui as Array<{ nome: string }>) {
      const k = normalizeCityName(m.nome)
      if (k) nomeCanonPorChave.set(k, m.nome)
    }

    const todasChavesPrioridade = new Set<string>()
    nomeCanonPorChave.forEach((_, k) => todasChavesPrioridade.add(k))
    Object.keys(expectativaPorCidade).forEach((k) => todasChavesPrioridade.add(k))
    Object.keys(visitasPorCidade).forEach((k) => todasChavesPrioridade.add(k))
    Object.keys(agendasPorCidade).forEach((k) => todasChavesPrioridade.add(k))

    const prioridadeCampoListaRaw = [...todasChavesPrioridade].map((cidadeKey) => {
      const expectativa = Math.round(expectativaPorCidade[cidadeKey] || 0)
      const visitas = visitasPorCidade[cidadeKey] || 0
      const agendas = agendasPorCidade[cidadeKey] || 0
      const ultimaVisita = ultimaVisitaPorCidade[cidadeKey] || null
      const cidadeExibicao =
        nomeOriginalCidade[cidadeKey] || nomeCanonPorChave.get(cidadeKey) || formatCityName(cidadeKey)
      const eleitorado = getEleitoradoByCity(cidadeExibicao) || 0
      const semExpectativa = expectativa <= 0

      const score = semExpectativa
        ? eleitorado / (visitas + 1)
        : expectativa / (visitas + 1)

      return {
        cidade: cidadeExibicao,
        expectativaVotos: expectativa,
        eleitorado,
        semExpectativa,
        visitas,
        agendas,
        ultimaVisita,
        score,
      }
    })

    const prioridadeCampoLista = prioridadeCampoListaRaw
      .sort((a, b) => {
        if (a.semExpectativa !== b.semExpectativa) return a.semExpectativa ? -1 : 1
        if (b.score !== a.score) return b.score - a.score
        if (b.eleitorado !== a.eleitorado) return b.eleitorado - a.eleitorado
        if (b.expectativaVotos !== a.expectativaVotos) return b.expectativaVotos - a.expectativaVotos
        return a.visitas - b.visitas
      })
      .map(({ cidade, expectativaVotos, eleitorado, semExpectativa, visitas, agendas, ultimaVisita }) => ({
        cidade,
        expectativaVotos,
        eleitorado,
        semExpectativa,
        visitas,
        agendas,
        motivo: semExpectativa ? 'Sem liderança mapeada' : '',
        ultimaVisita,
      }))

    return NextResponse.json({
      territoriosFrios,
      territoriosQuentes,
      territoriosMornos,
      cidadesNaoVisitadasLista,
      cidadesComLiderancas,
      cidadesVisitadasLista,
      expectativaPorCidadeLista,
      prioridadeCampoLista,
      estatisticas: {
        totalCidades,
        cidadesVisitadas,
        cidadesNaoVisitadas,
        totalVisitas,
        totalExpectativa: Math.round(totalExpectativa),
        percentualCobertura: totalCidades > 0 ? Math.round((cidadesVisitadas / totalCidades) * 100) : 0,
      },
    })
  } catch (error: unknown) {
    if (isSupabaseNetworkError(error)) {
      console.warn('[territorios-frios] Supabase indisponível (rede). Respondendo 503 retryable.')
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
        },
        { status: 503 }
      )
    }
    console.error('Erro ao calcular Territórios:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao processar dados' },
      { status: 500 }
    )
  }
}
