import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Função para calcular vagas diretas
function calcularVagasDiretas(votos: number, quociente: number): number {
  if (quociente <= 0) return 0
  return Math.floor(votos / quociente)
}

// Função para calcular o quociente mínimo (80% do quociente eleitoral)
function getQuocienteMinimo(quociente: number): number {
  return quociente * 0.8
}

// Função para verificar se partido atingiu o mínimo
function partidoAtingiuMinimo(votos: number, quociente: number): boolean {
  return votos >= getQuocienteMinimo(quociente)
}

// Função para calcular distribuição D'Hondt
function calcularDistribuicaoDHondt(
  partidos: Array<{ nome: string; votos: number; votosLegenda: number }>,
  quociente: number,
  numVagas: number
) {
  // Calcular vagas diretas para cada partido
  const partidosComVagas = partidos.map(partido => {
    const votosPartido = partido.votos + (partido.votosLegenda || 0)
    const vagasDiretas = calcularVagasDiretas(votosPartido, quociente)
    const atingiuMinimo = partidoAtingiuMinimo(votosPartido, quociente)
    
    return {
      partido: partido.nome,
      votos: votosPartido,
      vagasDiretas,
      vagasObtidas: vagasDiretas,
      atingiuMinimo
    }
  })

  // Total de vagas diretas distribuídas
  const vagasDistribuidas = partidosComVagas.reduce((acc, p) => acc + p.vagasDiretas, 0)
  const vagasRestantes = numVagas - vagasDistribuidas

  // Distribuição de sobras usando método D'Hondt
  if (vagasRestantes > 0) {
    const partidosElegiveis = partidosComVagas.filter(p => p.atingiuMinimo)
    
    for (let i = 0; i < vagasRestantes; i++) {
      let melhorPartido = null
      let melhorQuociente = 0

      for (const partido of partidosElegiveis) {
        const divisor = partido.vagasObtidas + 1
        const quocientePartido = partido.votos / divisor

        if (quocientePartido > melhorQuociente) {
          melhorQuociente = quocientePartido
          melhorPartido = partido
        }
      }

      if (melhorPartido) {
        melhorPartido.vagasObtidas++
      }
    }
  }

  return {
    partidosComVagas,
    vagasDistribuidas,
    vagasRestantes,
    totalVagas: numVagas
  }
}

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar cenário base
    const { data: cenarioBase, error: cenarioError } = await supabase
      .from('chapas_cenarios')
      .select('id, nome, quociente_eleitoral')
      .eq('user_id', user.id)
      .eq('tipo', 'base')
      .single()

    if (cenarioError || !cenarioBase) {
      // Se não existe cenário base, retornar 0
      return NextResponse.json({
        eleitos: 0,
        partido: 'REPUBLICANOS',
        cenario: null,
        message: 'Cenário base não encontrado'
      })
    }

    // Buscar partidos do cenário base
    const { data: partidosData, error: partidosError } = await supabase
      .from('chapas_partidos')
      .select('partido_nome, candidato_nome, candidato_votos, votos_legenda')
      .eq('user_id', user.id)
      .eq('cenario_id', cenarioBase.id)

    if (partidosError) {
      return NextResponse.json({
        eleitos: 0,
        partido: 'REPUBLICANOS',
        cenario: cenarioBase.nome,
        error: partidosError.message
      })
    }

    if (!partidosData || partidosData.length === 0) {
      return NextResponse.json({
        eleitos: 0,
        partido: 'REPUBLICANOS',
        cenario: cenarioBase.nome,
        message: 'Nenhum partido encontrado no cenário base'
      })
    }

    // Agrupar por partido e calcular votos totais
    const partidosAgrupados = new Map<string, { votos: number; votosLegenda: number; candidatos: Array<{ nome: string; votos: number }> }>()
    
    partidosData.forEach(p => {
      const atual = partidosAgrupados.get(p.partido_nome) || { votos: 0, votosLegenda: 0, candidatos: [] }
      atual.votos += p.candidato_votos || 0
      atual.votosLegenda = p.votos_legenda || 0
      if (p.candidato_nome && p.candidato_votos) {
        atual.candidatos.push({ nome: p.candidato_nome, votos: p.candidato_votos })
      }
      partidosAgrupados.set(p.partido_nome, atual)
    })

    const partidos = Array.from(partidosAgrupados.entries()).map(([nome, dados]) => ({
      nome,
      votos: dados.votos,
      votosLegenda: dados.votosLegenda,
      candidatos: dados.candidatos.sort((a, b) => b.votos - a.votos)
    }))

    // Calcular distribuição
    const quociente = cenarioBase.quociente_eleitoral || 190000
    const numVagas = 10 // Número de vagas padrão
    
    const distribuicao = calcularDistribuicaoDHondt(partidos, quociente, numVagas)

    // Encontrar vagas do Republicanos
    const republicanosPartido = partidos.find(
      p => p.nome.toUpperCase() === 'REPUBLICANOS'
    )
    const republicanosDistribuicao = distribuicao.partidosComVagas.find(
      p => p.partido.toUpperCase() === 'REPUBLICANOS'
    )

    const eleitosRepublicanos = republicanosDistribuicao?.vagasObtidas || 0

    // Preparar candidatos do Republicanos com status de eleito
    const candidatosRepublicanos = republicanosPartido?.candidatos.map((c, index) => ({
      nome: c.nome,
      votos: c.votos,
      eleito: index < eleitosRepublicanos
    })) || []

    // Votos de legenda do Republicanos
    const votosLegendaRepublicanos = republicanosPartido?.votosLegenda || 0

    return NextResponse.json({
      eleitos: eleitosRepublicanos,
      partido: 'REPUBLICANOS',
      cenario: cenarioBase.nome,
      quociente,
      votosLegenda: votosLegendaRepublicanos,
      candidatos: candidatosRepublicanos,
      distribuicao: distribuicao.partidosComVagas.map(p => {
        const partidoOriginal = partidos.find(po => po.nome === p.partido)
        return {
          partido: p.partido,
          vagas: p.vagasObtidas,
          votosLegenda: partidoOriginal?.votosLegenda || 0,
          candidatos: partidoOriginal?.candidatos || []
        }
      })
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor', eleitos: 0 },
      { status: 500 }
    )
  }
}





