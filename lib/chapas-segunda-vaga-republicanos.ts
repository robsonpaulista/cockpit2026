/**
 * Indicadores de vaga com base apenas na disputa de sobras (D'Hondt após vagas diretas).
 * Não há “margem” sobre vagas obtidas só por cota cheia — só quando o partido ganha assento em rodada de sobra.
 */
import { nomePartidoEhRepublicanos } from '@/lib/chapas-republicanos-match'

export interface PartidoVotosMinimo {
  nome: string
  votosTotal: number
  atingiuMinimo: boolean
}

interface PartidoCenario {
  nome: string
  votosTotal: number
  vagasObtidas: number
}

export interface RodadaDHondt {
  rodada: number
  ganhador: string
  qpGanhador: number
  divisorGanhador: number
  runnerUp: string
  qpRunnerUp: number
  divisorRunnerUp: number
}

/** Votos para próxima vaga (além do cenário atual projetado). */
export interface ProximaVagaExtra {
  distancia: number
  competidorProximo: string | null
  alvoVaga: number
}

export interface SegundaVagaPartidoResult {
  vagasAtuais: number
  alvoVaga: number
  distancia: number
  distanciaCompetidor: number
  tipo: 'margem' | 'faltam'
  competidorProximo: string | null
  /** Mantido para compatibilidade com API / dashboard (QP do partido alvo na rodada relevante). */
  qpRepublicanos: number
  qpCompetidor: number
  rodada: number
  /** Quando já há margem de manutenção, opcionalmente quanto falta para mais uma vaga. */
  proximaVagaExtra?: ProximaVagaExtra | null
}

/** @deprecated Use SegundaVagaPartidoResult; alias conservado para imports antigos. */
export type SegundaVagaRepublicanosResult = SegundaVagaPartidoResult

export function calcularDistribuicaoDHondtComHistorico(
  partidos: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number
) {
  const partidosElegiveis = partidos.filter((p) => p.atingiuMinimo)

  const partidosComVagas: PartidoCenario[] = partidosElegiveis.map((partido) => {
    const vagasDiretas = Math.floor(partido.votosTotal / quociente)
    return {
      nome: partido.nome,
      votosTotal: partido.votosTotal,
      vagasObtidas: vagasDiretas,
    }
  })

  const vagasDistribuidas = partidosComVagas.reduce((total, p) => total + p.vagasObtidas, 0)
  const vagasRestantes = numVagas - vagasDistribuidas

  const historicoRodadas: RodadaDHondt[] = []

  for (let i = 0; i < vagasRestantes; i++) {
    const quocientesPartidarios = partidosComVagas.map((p) => ({
      nome: p.nome,
      votos: p.votosTotal,
      divisor: p.vagasObtidas + 1,
      quocientePartidario: p.votosTotal / (p.vagasObtidas + 1),
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

      const partidoGanhador = partidosComVagas.find((p) => p.nome === ganhador.nome)
      if (partidoGanhador) {
        partidoGanhador.vagasObtidas++
      }
    } else {
      break
    }
  }

  return { partidosComVagas, historicoRodadas }
}

export function calcularDistribuicaoDHondt(
  partidos: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number
) {
  return calcularDistribuicaoDHondtComHistorico(partidos, quociente, numVagas).partidosComVagas
}

/**
 * Simula sobras a partir das vagas diretas e retorna a menor quantidade de votos
 * que o partido alvo precisaria a mais para vencer uma rodada em que outro partido ganhou.
 */
function simularFaltaProximaVaga(
  partidosComVotos: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number,
  partidoEhAlvo: (nome: string) => boolean,
  vagasAtuaisProjecao: number
): ProximaVagaExtra | null {
  const alvoAtual = partidosComVotos.find((p) => partidoEhAlvo(p.nome))
  if (!alvoAtual) return null

  let menorFalta = Infinity
  let rodadaCritica: RodadaDHondt | null = null

  const partidosTemp: PartidoCenario[] = partidosComVotos
    .filter((p) => p.atingiuMinimo)
    .map((p) => ({
      nome: p.nome,
      votosTotal: p.votosTotal,
      vagasObtidas: Math.floor(p.votosTotal / quociente),
    }))

  const vagasDistribuidas = partidosTemp.reduce((total, p) => total + p.vagasObtidas, 0)
  const vagasRestantes = numVagas - vagasDistribuidas

  for (let i = 0; i < vagasRestantes; i++) {
    const alvoTemp = partidosTemp.find((p) => partidoEhAlvo(p.nome))
    if (!alvoTemp) break

    const divisorAlvo = alvoTemp.vagasObtidas + 1
    const qpAlvo = alvoTemp.votosTotal / divisorAlvo

    const quocientesPartidarios = partidosTemp
      .map((p) => ({
        nome: p.nome,
        divisor: p.vagasObtidas + 1,
        quocientePartidario: p.votosTotal / (p.vagasObtidas + 1),
      }))
      .sort((a, b) => b.quocientePartidario - a.quocientePartidario)

    const ganhador = quocientesPartidarios[0]

    if (!partidoEhAlvo(ganhador.nome)) {
      const votosNecessarios = Math.ceil(ganhador.quocientePartidario * divisorAlvo) + 1
      const falta = votosNecessarios - alvoAtual.votosTotal

      if (falta < menorFalta && falta > 0) {
        menorFalta = falta
        rodadaCritica = {
          rodada: i + 1,
          ganhador: ganhador.nome,
          qpGanhador: ganhador.quocientePartidario,
          divisorGanhador: ganhador.divisor,
          runnerUp: alvoAtual.nome,
          qpRunnerUp: qpAlvo,
          divisorRunnerUp: divisorAlvo,
        }
      }
    }

    const partidoGanhador = partidosTemp.find((p) => p.nome === ganhador.nome)
    if (partidoGanhador) {
      partidoGanhador.vagasObtidas++
    }
  }

  if (rodadaCritica && menorFalta < Infinity) {
    return {
      distancia: menorFalta,
      competidorProximo: rodadaCritica.ganhador,
      alvoVaga: vagasAtuaisProjecao + 1,
    }
  }
  return null
}

export function calcularDistanciaProximaVagaPartido(
  partidosComVotos: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number,
  partidoEhAlvo: (nome: string) => boolean
): SegundaVagaPartidoResult {
  const alvoAtual = partidosComVotos.find((p) => partidoEhAlvo(p.nome))
  if (!alvoAtual) {
    return {
      vagasAtuais: 0,
      alvoVaga: 1,
      distancia: 0,
      distanciaCompetidor: 0,
      tipo: 'faltam',
      competidorProximo: null,
      qpRepublicanos: 0,
      qpCompetidor: 0,
      rodada: 0,
      proximaVagaExtra: null,
    }
  }

  const { partidosComVagas, historicoRodadas } = calcularDistribuicaoDHondtComHistorico(
    partidosComVotos,
    quociente,
    numVagas
  )
  const alvoFinal = partidosComVagas.find((p) => partidoEhAlvo(p.nome))
  const vagasAtuais = alvoFinal?.vagasObtidas || 0
  const alvoVaga = vagasAtuais + 1

  const rodadasAlvoGanhou = historicoRodadas.filter((r) => partidoEhAlvo(r.ganhador))

  const anexarProximaSeAplicavel = (): ProximaVagaExtra | null => {
    if (vagasAtuais >= numVagas) return null
    return simularFaltaProximaVaga(partidosComVotos, quociente, numVagas, partidoEhAlvo, vagasAtuais)
  }

  /** Margem só quando há vaga conquistada em rodada de sobra (não se aplica a vagas puramente diretas). */
  if (vagasAtuais >= 1 && rodadasAlvoGanhou.length > 0) {
    const ultimaRodada = rodadasAlvoGanhou[rodadasAlvoGanhou.length - 1]

    const limiteVotos = Math.ceil(ultimaRodada.qpRunnerUp * ultimaRodada.divisorGanhador)
    const margem = alvoAtual.votosTotal - limiteVotos

    const competidorAtual = partidosComVotos.find((p) => p.nome === ultimaRodada.runnerUp)
    let distanciaCompetidor = 0
    if (competidorAtual) {
      const votosCompNecessarios = Math.ceil(ultimaRodada.qpGanhador * ultimaRodada.divisorRunnerUp) + 1
      distanciaCompetidor = votosCompNecessarios - competidorAtual.votosTotal
    }

    const proximaVagaExtra = anexarProximaSeAplicavel()

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
      proximaVagaExtra,
    }
  }

  /** Votos que faltam para vencer uma rodada de sobra (próxima vaga além das diretas já distribuídas). */
  if (vagasAtuais < numVagas) {
    const extra = simularFaltaProximaVaga(
      partidosComVotos,
      quociente,
      numVagas,
      partidoEhAlvo,
      vagasAtuais
    )

    if (extra && extra.distancia > 0) {
      return {
        vagasAtuais,
        alvoVaga,
        distancia: extra.distancia,
        distanciaCompetidor: 0,
        tipo: 'faltam',
        competidorProximo: extra.competidorProximo,
        qpRepublicanos: 0,
        qpCompetidor: 0,
        rodada: 0,
        proximaVagaExtra: null,
      }
    }

    return {
      vagasAtuais,
      alvoVaga,
      distancia: 0,
      distanciaCompetidor: 0,
      tipo: 'faltam',
      competidorProximo: extra?.competidorProximo ?? null,
      qpRepublicanos: 0,
      qpCompetidor: 0,
      rodada: 0,
      proximaVagaExtra: null,
    }
  }

  return {
    vagasAtuais,
    alvoVaga,
    distancia: 0,
    distanciaCompetidor: 0,
    tipo: 'faltam',
    competidorProximo: null,
    qpRepublicanos: 0,
    qpCompetidor: 0,
    rodada: 0,
    proximaVagaExtra: null,
  }
}

export function calcularDistanciaSegundaVagaRepublicanos(
  partidosComVotos: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number
): SegundaVagaPartidoResult {
  return calcularDistanciaProximaVagaPartido(
    partidosComVotos,
    quociente,
    numVagas,
    nomePartidoEhRepublicanos
  )
}

export type SegundaVagaFeedbackTone = 'positive' | 'negative' | 'neutral'

function textoFaltamVotos(distancia: number, vagaAlvo: number, competidor: string) {
  return `-${distancia.toLocaleString('pt-BR')} votos p/ ${vagaAlvo}ª vaga (${competidor})`
}

/**
 * Texto e tom alinhados ao KPI Projeção Federal / Estadual.
 * Margem = só disputa de sobras; linha extra = votos para próxima vaga também via sobras.
 */
export function buildSegundaVagaFeedbackLabel(
  s: SegundaVagaPartidoResult | null,
  opts: { escopo: 'federal' | 'estadual' }
): { text: string; tone: SegundaVagaFeedbackTone; segundaLinha?: string } | null {
  if (!s) return null

  const competidor = s.competidorProximo || '?'
  const vagaAlvo = s.alvoVaga || s.vagasAtuais + 1

  const montarSegundaLinhaProxima = (extra: ProximaVagaExtra): string | undefined => {
    if (extra.distancia <= 0) return undefined
    const c = extra.competidorProximo || '?'
    return textoFaltamVotos(extra.distancia, extra.alvoVaga, c)
  }

  if (opts.escopo === 'estadual') {
    if (s.tipo === 'margem') {
      const margem = s.distancia
      const tone: SegundaVagaFeedbackTone =
        margem > 20000 ? 'positive' : margem > 5000 ? 'neutral' : 'negative'
      let primeiraLinha: string
      if (margem > 0) {
        primeiraLinha = `Margem: ${margem.toLocaleString('pt-BR')} votos`
        if (s.distanciaCompetidor > 0) {
          primeiraLinha += ` · ${competidor} +${s.distanciaCompetidor.toLocaleString('pt-BR')}`
        }
      } else {
        primeiraLinha = `Margem crítica (${s.vagasAtuais} vaga${s.vagasAtuais !== 1 ? 's' : ''})`
        if (s.distanciaCompetidor > 0) {
          primeiraLinha += ` · ${competidor} +${s.distanciaCompetidor.toLocaleString('pt-BR')}`
        }
      }
      const segundaLinha = s.proximaVagaExtra ? montarSegundaLinhaProxima(s.proximaVagaExtra) : undefined
      return { text: primeiraLinha, tone, segundaLinha }
    }
    if (s.distancia > 0) {
      return {
        text: textoFaltamVotos(s.distancia, vagaAlvo, competidor),
        tone: 'negative',
      }
    }
    if (!s.competidorProximo) {
      return null
    }
    return {
      text: `${vagaAlvo}ª vaga em disputa (${competidor})`,
      tone: 'neutral',
    }
  }

  if (s.tipo === 'margem') {
    const d = Math.max(0, s.distancia)
    const tone: SegundaVagaFeedbackTone =
      s.distancia > 20000 ? 'positive' : s.distancia > 5000 ? 'neutral' : 'negative'
    const primeiraLinha = `Margem: ${d.toLocaleString('pt-BR')} votos`
    const segundaLinha = s.proximaVagaExtra ? montarSegundaLinhaProxima(s.proximaVagaExtra) : undefined
    return { text: primeiraLinha, tone, segundaLinha }
  }
  if (s.distancia > 0) {
    return {
      text: textoFaltamVotos(s.distancia, vagaAlvo, competidor),
      tone: 'negative',
    }
  }
  return null
}
