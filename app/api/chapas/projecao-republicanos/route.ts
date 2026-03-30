import { createClient } from '@/lib/supabase/server'
import {
  nomePartidoEhRepublicanos,
  normalizarNomePartidoChapa,
} from '@/lib/chapas-republicanos-match'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const ESTADUAL_PREFIX = 'estadual_'
const PARTIDO_ALVO_ETIQUETA = 'REPUBLICANOS'

/**
 * Mesma regra do client (chapasService): dono da base compartilhada de chapas.
 * Evita misturar cenários de usuários diferentes quando o RLS retorna todas as linhas.
 */
async function getChapasSharedOwnerUserId(
  supabase: ReturnType<typeof createClient>,
  fallbackUserId: string
): Promise<string> {
  const { data: ativo } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .eq('ativo', true)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ativo?.user_id) return ativo.user_id

  const { data: base } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .eq('id', 'base')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .limit(1)
    .maybeSingle()

  if (base?.user_id) return base.user_id

  const { data: first } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (first?.user_id) return first.user_id

  return fallbackUserId
}

/**
 * Mesma regra do client (chapas-estaduais-service): dono da base estadual (ids `estadual_%`).
 * Não usar o resolvedor federal aqui — cenários federais e estaduais podem ter `user_id` de origem diferente.
 */
async function getChapasEstaduaisSharedOwnerUserId(
  supabase: ReturnType<typeof createClient>,
  fallbackUserId: string
): Promise<string> {
  const baseEstadualId = `${ESTADUAL_PREFIX}base`

  const { data: ativo } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${ESTADUAL_PREFIX}%`)
    .eq('ativo', true)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ativo?.user_id) return ativo.user_id

  const { data: base } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .eq('id', baseEstadualId)
    .limit(1)
    .maybeSingle()

  if (base?.user_id) return base.user_id

  const { data: first } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${ESTADUAL_PREFIX}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (first?.user_id) return first.user_id

  return fallbackUserId
}

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
  numVagas: number,
  usarMargemDiretaParaUmaVaga: boolean = false
): { 
  vagasAtuais: number
  alvoVaga: number
  distancia: number
  distanciaCompetidor: number  // quantos votos o competidor precisa GANHAR para roubar
  tipo: 'margem' | 'faltam'
  competidorProximo: string | null
  qpRepublicanos: number
  qpCompetidor: number
  rodada: number
} {
  const repAtual = partidosComVotos.find((p) => nomePartidoEhRepublicanos(p.nome))
  if (!repAtual) {
    return { vagasAtuais: 0, alvoVaga: 1, distancia: 0, distanciaCompetidor: 0, tipo: 'faltam', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
  }

  const { partidosComVagas, historicoRodadas } = calcularDistribuicaoDHondtComHistorico(partidosComVotos, quociente, numVagas)
  const repFinal = partidosComVagas.find((p) => nomePartidoEhRepublicanos(p.nome))
  const vagasAtuais = repFinal?.vagasObtidas || 0
  const alvoVaga = vagasAtuais + 1

  // Encontrar rodadas onde REPUBLICANOS ganhou vagas por sobra
  const rodadasRepGanhou = historicoRodadas.filter((r) => nomePartidoEhRepublicanos(r.ganhador))

  if (vagasAtuais >= 1 && rodadasRepGanhou.length > 0) {
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
      alvoVaga,
      distancia: margem,
      distanciaCompetidor: Math.max(0, distanciaCompetidor),
      tipo: 'margem',
      competidorProximo: ultimaRodada.runnerUp,
      qpRepublicanos: ultimaRodada.qpGanhador,
      qpCompetidor: ultimaRodada.qpRunnerUp,
      rodada: ultimaRodada.rodada,
    }
  } else if (usarMargemDiretaParaUmaVaga && vagasAtuais >= 1 && rodadasRepGanhou.length === 0) {
    // Caso sem vaga por sobra (somente vagas diretas):
    // margem para manter o patamar atual de vagas diretas.
    const limiteVotosDiretos = quociente * vagasAtuais
    const margemDireta = repAtual.votosTotal - limiteVotosDiretos

    return {
      vagasAtuais,
      alvoVaga,
      distancia: margemDireta,
      distanciaCompetidor: 0,
      tipo: 'margem',
      competidorProximo: null,
      qpRepublicanos: 0,
      qpCompetidor: 0,
      rodada: 0,
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
      const repTemp = partidosTemp.find((p) => nomePartidoEhRepublicanos(p.nome))
      if (!repTemp) break
      
      const divisorRep = repTemp.vagasObtidas + 1
      const qpRep = repTemp.votosTotal / divisorRep
      
      const quocientesPartidarios = partidosTemp.map(p => ({
        nome: p.nome,
        divisor: p.vagasObtidas + 1,
        quocientePartidario: p.votosTotal / (p.vagasObtidas + 1)
      })).sort((a, b) => b.quocientePartidario - a.quocientePartidario)
      
      const ganhador = quocientesPartidarios[0]
      
      if (!nomePartidoEhRepublicanos(ganhador.nome)) {
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
            runnerUp: repAtual.nome,
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
        alvoVaga,
        distancia: menorFalta,
        distanciaCompetidor: 0,
        tipo: 'faltam',
        competidorProximo: rodadaCritica.ganhador,
        qpRepublicanos: rodadaCritica.qpRunnerUp,
        qpCompetidor: rodadaCritica.qpGanhador,
        rodada: rodadaCritica.rodada,
      }
    }

    return { vagasAtuais, alvoVaga, distancia: 0, distanciaCompetidor: 0, tipo: 'faltam', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
  }

  return { vagasAtuais, alvoVaga, distancia: 0, distanciaCompetidor: 0, tipo: 'margem', competidorProximo: null, qpRepublicanos: 0, qpCompetidor: 0, rodada: 0 }
}

type CenarioFederalRow = {
  id: string
  nome: string
  quociente_eleitoral: number | null
  user_id: string
  ativo: boolean | null
}

/**
 * Projeção federal no dashboard: alinhar à página Chapas — priorizar sempre o CENÁRIO PRINCIPAL
 * quando existir, em vez do Cenário Base ou de outra simulação só por estar marcada como ativa.
 */
function resolverCenarioFederalParaProjecao(cenarios: CenarioFederalRow[]): CenarioFederalRow | null {
  if (!cenarios.length) return null

  /** Reconhece ex. "CENÁRIO PRINCIPAL", títulos compostos e id tipo `cenario_principal`. */
  const nomeEhPrincipal = (nome: string) => {
    const semAcento = nome
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
    if (
      semAcento === 'principal' ||
      semAcento.startsWith('principal ') ||
      semAcento.endsWith(' principal')
    ) {
      return true
    }
    if (
      semAcento === 'cenario principal' ||
      semAcento.startsWith('cenario principal ') ||
      semAcento.includes('cenario principal')
    ) {
      return true
    }
    return false
  }

  const idEhPrincipal = (id: string) => {
    const s = id.trim().toLowerCase()
    return s === 'principal' || /(^|_)principal($|_)/.test(s)
  }

  const principal = cenarios.find((c) => idEhPrincipal(c.id) || nomeEhPrincipal(c.nome))
  const ativo = cenarios.find((c) => c.ativo)
  const base = cenarios.find((c) => c.id === 'base')

  if (principal) return principal
  if (ativo && ativo.id !== 'base') return ativo
  if (ativo) return ativo
  if (base) return base
  return cenarios[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const votosExpectativa = parseInt(searchParams.get('votosExpectativa') || '0', 10)
    const escopo = searchParams.get('escopo') === 'estadual' ? 'estadual' : 'federal'

    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const chapasOwnerUserId =
      escopo === 'estadual'
        ? await getChapasEstaduaisSharedOwnerUserId(supabase, user.id)
        : await getChapasSharedOwnerUserId(supabase, user.id)

    let cenarioId = escopo === 'estadual' ? `${ESTADUAL_PREFIX}base` : 'base'
    let ownerUserId: string | null = null
    let quociente = escopo === 'estadual' ? 67000 : 190000
    const numVagas = escopo === 'estadual' ? 30 : 10
    let cenarioNome = 'Cenário Base'

    if (escopo === 'federal') {
      const { data: cenariosFederais } = await supabase
        .from('chapas_cenarios')
        .select('id, nome, quociente_eleitoral, user_id, ativo')
        .eq('user_id', chapasOwnerUserId)
        .not('id', 'like', `${ESTADUAL_PREFIX}%`)

      const escolhido = resolverCenarioFederalParaProjecao((cenariosFederais ?? []) as CenarioFederalRow[])
      if (escolhido) {
        cenarioId = escolhido.id
        ownerUserId = escolhido.user_id
        quociente = escolhido.quociente_eleitoral || 190000
        cenarioNome = escolhido.nome
      }
    } else {
      // Estadual: mesmo critério da página /dashboard/chapas-estaduais (cenário ativo estadual_*, senão base)
      const { data: cenarioAtivo } = await supabase
        .from('chapas_cenarios')
        .select('id, nome, quociente_eleitoral, user_id')
        .eq('user_id', chapasOwnerUserId)
        .eq('ativo', true)
        .like('id', `${ESTADUAL_PREFIX}%`)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cenarioAtivo) {
        cenarioId = cenarioAtivo.id
        ownerUserId = cenarioAtivo.user_id
        quociente = cenarioAtivo.quociente_eleitoral || 67000
        cenarioNome = cenarioAtivo.nome
      } else {
        const { data: cenarioBase } = await supabase
          .from('chapas_cenarios')
          .select('id, nome, quociente_eleitoral, user_id')
          .eq('user_id', chapasOwnerUserId)
          .eq('id', cenarioId)
          .like('id', `${ESTADUAL_PREFIX}%`)
          .maybeSingle()

        if (cenarioBase) {
          ownerUserId = cenarioBase.user_id
          quociente = cenarioBase.quociente_eleitoral || 67000
          cenarioNome = cenarioBase.nome
        }
      }
    }

    if (!ownerUserId) {
      return NextResponse.json(
        {
          escopo,
          message:
            escopo === 'estadual'
              ? 'Cenário estadual não configurado. Acesse Chapas Estaduais.'
              : 'Cenário federal não configurado. Acesse Chapas (federal).',
        },
        { status: 200 }
      )
    }

    // Buscar partidos do cenário
    const { data: partidosData, error: partidosError } = await supabase
      .from('chapas_partidos')
      .select('partido_nome, votos_legenda, candidato_nome, candidato_votos')
      .eq('user_id', ownerUserId)
      .eq('cenario_id', cenarioId)

    if (partidosError) {
      console.error('Erro ao buscar partidos:', partidosError)
      return NextResponse.json(
        {
          escopo,
          message:
            escopo === 'estadual'
              ? 'Não foi possível carregar chapas estaduais.'
              : 'Não foi possível carregar chapas federais.',
        },
        { status: 200 }
      )
    }

    if (!partidosData || partidosData.length === 0) {
      return NextResponse.json(
        {
          escopo,
          cenario: cenarioNome,
          message:
            escopo === 'estadual'
              ? 'Nenhum candidato neste cenário estadual. Verifique Chapas Estaduais.'
              : 'Nenhum candidato neste cenário federal. Verifique Chapas.',
        },
        { status: 200 }
      )
    }

    // Agrupar por partido e calcular votos totais
    const partidosMap: { [key: string]: { votosLegenda: number; votosCandidatos: number } } = {}

    partidosData.forEach((item) => {
      const chavePartido = normalizarNomePartidoChapa(item.partido_nome)
      if (!chavePartido) return

      if (!partidosMap[chavePartido]) {
        partidosMap[chavePartido] = {
          votosLegenda: 0,
          votosCandidatos: 0,
        }
      }

      const candRaw = (item.candidato_nome ?? '').trim()
      const cand = normalizarNomePartidoChapa(candRaw)
      // Igual à página Chapas: legenda pode estar só em votos_legenda (replicado nas linhas) ou na linha LEGENDA
      partidosMap[chavePartido].votosLegenda = Math.max(
        partidosMap[chavePartido].votosLegenda,
        item.votos_legenda || 0
      )
      if (cand === 'LEGENDA' || cand === 'VOTOS LEGENDA') {
        partidosMap[chavePartido].votosLegenda = Math.max(
          partidosMap[chavePartido].votosLegenda,
          item.candidato_votos || 0
        )
      } else {
        partidosMap[chavePartido].votosCandidatos += item.candidato_votos || 0
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

    // Calcular distribuição D'Hondt
    const distribuicao = calcularDistribuicaoDHondt(partidosComVotos, quociente, numVagas)

    // Encontrar o partido REPUBLICANOS
    const republicanos = distribuicao.find((p) => nomePartidoEhRepublicanos(p.nome))

    // Calcular distância para 2ª vaga do REPUBLICANOS
    const analiseSegundaVaga = calcularDistanciaSegundaVaga(
      partidosComVotos,
      quociente,
      numVagas,
      escopo === 'estadual'
    )

    // Calcular ranking individual se votosExpectativa foi informado
    // Exclui o próprio Jadyel (REPUBLICANOS) da comparação, pois queremos saber
    // quantos dos DEMAIS candidatos têm votação acima da expectativa dele
    let rankingInfo = null
    if (votosExpectativa > 0) {
      const candidatosValidos = partidosData.filter((c) => {
        const n = normalizarNomePartidoChapa(c.candidato_nome)
        return (
          n !== 'LEGENDA' &&
          n !== 'VOTOS LEGENDA' &&
          !(c.candidato_nome && c.candidato_nome.toUpperCase().includes('JADYEL'))
        )
      })

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
        partido: PARTIDO_ALVO_ETIQUETA,
        eleitos: 0,
        escopo,
        cenario: cenarioNome,
        quociente,
        numVagas,
        ranking: rankingInfo,
        segundaVaga: analiseSegundaVaga,
        message: `Partido ${PARTIDO_ALVO_ETIQUETA} (ou sigla REPUB) não encontrado no cenário.`
      })
    }

    return NextResponse.json({
      partido: PARTIDO_ALVO_ETIQUETA,
      eleitos: republicanos.vagasObtidas,
      escopo,
      cenario: cenarioNome,
      quociente,
      numVagas,
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
