import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface PartidoCenario {
  nome: string
  votosTotal: number
  vagasObtidas: number
}

// Registro de uma rodada do D'Hondt
interface RodadaDHondt {
  rodada: number
  ganhador: string
  qpGanhador: number
  divisorGanhador: number
  runnerUp: string
  qpRunnerUp: number
  divisorRunnerUp: number
}

// Função para calcular distribuição D'Hondt COM histórico de rodadas
function calcularDistribuicaoDHondtComHistorico(
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
  
  const historicoRodadas: RodadaDHondt[] = []
  
  // Distribuir vagas restantes pelo método D'Hondt, gravando cada rodada
  for (let i = 0; i < vagasRestantes; i++) {
    const quocientesPartidarios = partidosComVagas.map(p => ({
      nome: p.nome,
      votos: p.votosTotal,
      divisor: p.vagasObtidas + 1,
      quocientePartidario: p.votosTotal / (p.vagasObtidas + 1)
    }))
    
    quocientesPartidarios.sort((a, b) => b.quocientePartidario - a.quocientePartidario)
    
    const ganhador = quocientesPartidarios[0]
    const runnerUp = quocientesPartidarios[1]
    
    if (ganhador && ganhador.nome) {
      historicoRodadas.push({
        rodada: i + 1,
        ganhador: ganhador.nome,
        qpGanhador: ganhador.quocientePartidario,
        divisorGanhador: ganhador.divisor,
        runnerUp: runnerUp?.nome || '',
        qpRunnerUp: runnerUp?.quocientePartidario || 0,
        divisorRunnerUp: runnerUp?.divisor || 1,
      })
      
      const partidoGanhador = partidosComVagas.find(p => p.nome === ganhador.nome)
      if (partidoGanhador) {
        partidoGanhador.vagasObtidas++
      }
    } else {
      break
    }
  }
  
  return { partidosComVagas, historicoRodadas }
}

// Wrapper simples que retorna apenas partidos (compatibilidade)
function calcularDistribuicaoDHondt(
  partidos: Array<{ nome: string; votosTotal: number; atingiuMinimo: boolean }>,
  quociente: number,
  numVagas: number
) {
  return calcularDistribuicaoDHondtComHistorico(partidos, quociente, numVagas).partidosComVagas
}

// Calcula a distância EXATA em votos usando o histórico de rodadas do D'Hondt
function calcularDistanciaSegundaVaga(
  partidosComVotos: Array<{ nome: string; votosTotal: number; atingiuMinimo: boolean }>,
  quociente: number,
  numVagas: number
): { 
  vagasAtuais: number
  distancia: number
  distanciaCompetidor: number  // quantos votos o competidor precisa GANHAR para roubar
  tipo: 'margem' | 'faltam'
  competidorProximo: string | null
  qpRepublicanos: number
  qpCompetidor: number
  rodada: number
} {
  const repAtual = partidosComVotos.find(p => p.nome === 'REPUBLICANOS')
  if (!repAtual) {
    return { vagasAtuais: 0, distancia: 0, distanciaCompetidor: 0, tipo: 'faltam', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
  }

  const { partidosComVagas, historicoRodadas } = calcularDistribuicaoDHondtComHistorico(partidosComVotos, quociente, numVagas)
  const repFinal = partidosComVagas.find(p => p.nome === 'REPUBLICANOS')
  const vagasAtuais = repFinal?.vagasObtidas || 0

  // Encontrar rodadas onde REPUBLICANOS ganhou vagas por sobra
  const rodadasRepGanhou = historicoRodadas.filter(r => r.ganhador === 'REPUBLICANOS')

  if (vagasAtuais >= 2 && rodadasRepGanhou.length > 0) {
    // REPUBLICANOS tem 2+ vagas: calcular margem baseada na ÚLTIMA rodada onde ganhou
    // Essa é a rodada mais "apertada" (divisor maior = QP menor)
    const ultimaRodada = rodadasRepGanhou[rodadasRepGanhou.length - 1]
    
    // Na rodada onde ganhou, o runner-up tinha QP = qpRunnerUp
    // REPUBLICANOS precisa manter: votosRep / divisor > qpRunnerUp
    // Limite: votosRep = qpRunnerUp × divisor (abaixo disso, perde a vaga)
    // Margem em votos = votosRep - (qpRunnerUp × divisorGanhador)
    const limiteVotos = Math.ceil(ultimaRodada.qpRunnerUp * ultimaRodada.divisorGanhador)
    const margem = repAtual.votosTotal - limiteVotos

    // Calcular quanto o competidor precisa GANHAR para ultrapassar
    // competidor precisa: votosComp / divisorComp > qpRepublicanos
    // votosComp > qpRepublicanos × divisorComp
    const competidorAtual = partidosComVotos.find(p => p.nome === ultimaRodada.runnerUp)
    let distanciaCompetidor = 0
    if (competidorAtual) {
      const votosCompNecessarios = Math.ceil(ultimaRodada.qpGanhador * ultimaRodada.divisorRunnerUp) + 1
      distanciaCompetidor = votosCompNecessarios - competidorAtual.votosTotal
    }

    return {
      vagasAtuais,
      distancia: margem,
      distanciaCompetidor: Math.max(0, distanciaCompetidor),
      tipo: 'margem',
      competidorProximo: ultimaRodada.runnerUp,
      qpRepublicanos: ultimaRodada.qpGanhador,
      qpCompetidor: ultimaRodada.qpRunnerUp,
      rodada: ultimaRodada.rodada,
    }
  } else if (vagasAtuais < 2) {
    // REPUBLICANOS não tem 2ª vaga: encontrar a rodada onde ele PERDEU 
    // (onde outro partido ganhou e REPUBLICANOS era o runner-up ou estava competindo)
    
    // Achar a rodada onde REPUBLICANOS ficaria como runner-up mais próximo do ganhador
    // Ou: calcular quanto REPUBLICANOS precisaria ter para vencer cada rodada onde perdeu
    
    // Abordagem: para cada rodada onde REPUBLICANOS NÃO ganhou,
    // calcular quanto precisaria para ter o QP maior
    let menorFalta = Infinity
    let rodadaCritica: RodadaDHondt | null = null
    
    // Precisamos saber o divisor do REPUBLICANOS em cada rodada
    // Reprocessar o D'Hondt manualmente para isso
    const partidosTemp: PartidoCenario[] = partidosComVotos
      .filter(p => p.atingiuMinimo)
      .map(p => ({
        nome: p.nome,
        votosTotal: p.votosTotal,
        vagasObtidas: Math.floor(p.votosTotal / quociente)
      }))
    
    const vagasDistribuidas = partidosTemp.reduce((total, p) => total + p.vagasObtidas, 0)
    const vagasRestantes = numVagas - vagasDistribuidas
    
    for (let i = 0; i < vagasRestantes; i++) {
      const repTemp = partidosTemp.find(p => p.nome === 'REPUBLICANOS')
      if (!repTemp) break
      
      const divisorRep = repTemp.vagasObtidas + 1
      const qpRep = repTemp.votosTotal / divisorRep
      
      const quocientesPartidarios = partidosTemp.map(p => ({
        nome: p.nome,
        divisor: p.vagasObtidas + 1,
        quocientePartidario: p.votosTotal / (p.vagasObtidas + 1)
      })).sort((a, b) => b.quocientePartidario - a.quocientePartidario)
      
      const ganhador = quocientesPartidarios[0]
      
      if (ganhador.nome !== 'REPUBLICANOS') {
        // REPUBLICANOS perdeu esta rodada
        // Para vencer: votosRep / divisorRep > ganhador.QP
        // votosRep > ganhador.QP × divisorRep
        const votosNecessarios = Math.ceil(ganhador.quocientePartidario * divisorRep) + 1
        const falta = votosNecessarios - repAtual.votosTotal
        
        if (falta < menorFalta && falta > 0) {
          menorFalta = falta
          rodadaCritica = {
            rodada: i + 1,
            ganhador: ganhador.nome,
            qpGanhador: ganhador.quocientePartidario,
            divisorGanhador: ganhador.divisor,
            runnerUp: 'REPUBLICANOS',
            qpRunnerUp: qpRep,
            divisorRunnerUp: divisorRep,
          }
        }
      }
      
      // Avançar a rodada (dar a vaga ao ganhador)
      const partidoGanhador = partidosTemp.find(p => p.nome === ganhador.nome)
      if (partidoGanhador) {
        partidoGanhador.vagasObtidas++
      }
    }

    if (rodadaCritica && menorFalta < Infinity) {
      return {
        vagasAtuais,
        distancia: menorFalta,
        distanciaCompetidor: 0,
        tipo: 'faltam',
        competidorProximo: rodadaCritica.ganhador,
        qpRepublicanos: rodadaCritica.qpRunnerUp,
        qpCompetidor: rodadaCritica.qpGanhador,
        rodada: rodadaCritica.rodada,
      }
    }

    return { vagasAtuais, distancia: 0, distanciaCompetidor: 0, tipo: 'faltam', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
  }

  return { vagasAtuais, distancia: 0, distanciaCompetidor: 0, tipo: 'margem', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const votosExpectativa = parseInt(searchParams.get('votosExpectativa') || '0', 10)

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

    // Calcular distância para 2ª vaga do REPUBLICANOS
    const analiseSegundaVaga = calcularDistanciaSegundaVaga(partidosComVotos, quociente, numVagas)

    // Calcular ranking individual se votosExpectativa foi informado
    // Exclui o próprio Jadyel (REPUBLICANOS) da comparação, pois queremos saber
    // quantos dos DEMAIS candidatos têm votação acima da expectativa dele
    let rankingInfo = null
    if (votosExpectativa > 0) {
      const candidatosValidos = partidosData.filter(
        c => c.candidato_nome !== 'LEGENDA' 
          && c.candidato_nome !== 'VOTOS LEGENDA'
          && !c.candidato_nome.toUpperCase().includes('JADYEL')
      )

      const todosOrdenados = candidatosValidos
        .map(c => ({
          nome: c.candidato_nome,
          partido: c.partido_nome,
          votos: c.candidato_votos || 0,
        }))
        .sort((a, b) => b.votos - a.votos)

      // Contar quantos candidatos têm votação acima da expectativa
      const acimaDaExpectativa = todosOrdenados.filter(c => c.votos > votosExpectativa).length
      const posicao = acimaDaExpectativa + 1

      rankingInfo = {
        posicao,
        totalCandidatos: todosOrdenados.length,
      }
    }

    if (!republicanos) {
      return NextResponse.json({
        partido: 'REPUBLICANOS',
        eleitos: 0,
        cenario: cenarioNome,
        quociente,
        ranking: rankingInfo,
        segundaVaga: analiseSegundaVaga,
        message: 'Partido REPUBLICANOS não encontrado no cenário.'
      })
    }

    return NextResponse.json({
      partido: 'REPUBLICANOS',
      eleitos: republicanos.vagasObtidas,
      cenario: cenarioNome,
      quociente,
      ranking: rankingInfo,
      segundaVaga: analiseSegundaVaga,
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
