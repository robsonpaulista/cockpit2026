import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface PartidoCenario {
  nome: string
  votosTotal: number
  vagasObtidas: number
}

// Função para calcular distribuição D'Hondt
function calcularDistribuicaoDHondt(
  partidos: Array<{ nome: string; votosTotal: number; atingiuMinimo: boolean }>,
  quociente: number,
  numVagas: number
) {
  const partidosElegiveis = partidos.filter(p => p.atingiuMinimo)
  
  const partidosComVagas: PartidoCenario[] = partidosElegiveis.map(partido => {
    const vagasDiretas = Math.floor(partido.votosTotal / quociente)
    return {
      nome: partido.nome,
      votosTotal: partido.votosTotal,
      vagasObtidas: vagasDiretas
    }
  })
  
  const vagasDistribuidas = partidosComVagas.reduce((total, p) => total + p.vagasObtidas, 0)
  const vagasRestantes = numVagas - vagasDistribuidas
  
  // Distribuir vagas restantes pelo método D'Hondt
  for (let i = 0; i < vagasRestantes; i++) {
    const quocientesPartidarios = partidosComVagas.map(p => ({
      nome: p.nome,
      quocientePartidario: p.votosTotal / (p.vagasObtidas + 1)
    }))
    
    quocientesPartidarios.sort((a, b) => b.quocientePartidario - a.quocientePartidario)
    
    const ganhador = quocientesPartidarios[0]
    if (ganhador && ganhador.nome) {
      const partidoGanhador = partidosComVagas.find(p => p.nome === ganhador.nome)
      if (partidoGanhador) {
        partidoGanhador.vagasObtidas++
      }
    } else {
      break
    }
  }
  
  return partidosComVagas
}

export async function GET() {
  try {
    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar cenário ativo
    const { data: cenarioAtivo, error: cenarioError } = await supabase
      .from('chapas_cenarios')
      .select('id, nome, quociente_eleitoral')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .single()

    // Se não há cenário ativo, buscar o base
    let cenarioId = 'base'
    let quociente = 190000
    let cenarioNome = 'Cenário Base'

    if (!cenarioError && cenarioAtivo) {
      cenarioId = cenarioAtivo.id
      quociente = cenarioAtivo.quociente_eleitoral || 190000
      cenarioNome = cenarioAtivo.nome
    } else {
      // Tentar buscar o cenário base
      const { data: cenarioBase } = await supabase
        .from('chapas_cenarios')
        .select('id, nome, quociente_eleitoral')
        .eq('user_id', user.id)
        .eq('id', 'base')
        .single()

      if (cenarioBase) {
        quociente = cenarioBase.quociente_eleitoral || 190000
        cenarioNome = cenarioBase.nome
      }
    }

    // Buscar partidos do cenário
    const { data: partidosData, error: partidosError } = await supabase
      .from('chapas_partidos')
      .select('partido_nome, votos_legenda, candidato_nome, candidato_votos')
      .eq('user_id', user.id)
      .eq('cenario_id', cenarioId)

    if (partidosError) {
      console.error('Erro ao buscar partidos:', partidosError)
      return NextResponse.json(
        { message: 'Cenário base não configurado. Acesse a página Chapas para configurar.' },
        { status: 200 }
      )
    }

    if (!partidosData || partidosData.length === 0) {
      return NextResponse.json(
        { message: 'Cenário base não configurado. Acesse a página Chapas para configurar.' },
        { status: 200 }
      )
    }

    // Agrupar por partido e calcular votos totais
    const partidosMap: { [key: string]: { votosLegenda: number; votosCandidatos: number } } = {}

    partidosData.forEach(item => {
      if (!partidosMap[item.partido_nome]) {
        partidosMap[item.partido_nome] = {
          votosLegenda: item.votos_legenda || 0,
          votosCandidatos: 0
        }
      }
      
      // Ignorar linhas de legenda (já contabilizadas em votos_legenda)
      if (item.candidato_nome !== 'LEGENDA' && item.candidato_nome !== 'VOTOS LEGENDA') {
        partidosMap[item.partido_nome].votosCandidatos += item.candidato_votos || 0
      }
    })

    // Calcular votos totais por partido
    const partidosComVotos = Object.entries(partidosMap).map(([nome, dados]) => {
      const votosTotal = dados.votosCandidatos + dados.votosLegenda
      const quocienteMinimo = quociente * 0.8
      const atingiuMinimo = votosTotal >= quocienteMinimo
      
      return {
        nome,
        votosTotal,
        atingiuMinimo
      }
    })

    // Calcular distribuição D'Hondt (assumindo 10 vagas, pode ser parametrizado depois)
    const numVagas = 10
    const distribuicao = calcularDistribuicaoDHondt(partidosComVotos, quociente, numVagas)

    // Encontrar o partido REPUBLICANOS
    const republicanos = distribuicao.find(p => p.nome === 'REPUBLICANOS')

    if (!republicanos) {
      return NextResponse.json({
        partido: 'REPUBLICANOS',
        eleitos: 0,
        cenario: cenarioNome,
        quociente,
        message: 'Partido REPUBLICANOS não encontrado no cenário.'
      })
    }

    return NextResponse.json({
      partido: 'REPUBLICANOS',
      eleitos: republicanos.vagasObtidas,
      cenario: cenarioNome,
      quociente
    })
  } catch (error: unknown) {
    console.error('Erro ao calcular projeção:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
