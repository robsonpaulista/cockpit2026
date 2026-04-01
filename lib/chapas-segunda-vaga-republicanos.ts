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
  /** Rodada de sobra no D'Hondt (1 = primeira vaga remanescente após todas as diretas). */
  rodadaSobra: number
  /** Número absoluto da próxima vaga do partido alvo (legado; textos preferem rodadaSobra). */
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
  /** Rodada D'Hondt: em “margem”, última sobra ganha; em “faltam”, rodada em que o partido perde o QP. */
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

function mapaVagasPorPartido(
  rows: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number
): Record<string, number> {
  const dist = calcularDistribuicaoDHondt(rows, quociente, numVagas)
  const m: Record<string, number> = {}
  for (const p of dist) {
    m[p.nome] = p.vagasObtidas
  }
  return m
}

function mapasVagasIguais(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  }
  return true
}

/**
 * Ordem na fila da **próxima** sobra no estado atual — igual ao painel “Cálculo de Sobras”:
 * QP = votos ÷ (vagas diretas + 1), sem incluir sobras já distribuídas no divisor.
 * (Não usar vagas finais do D'Hondt: isso descrevia um passo futuro e gerava “3º” quando o card mostra 1º.)
 */
function posicaoNaFilaProximaSobra(
  rows: PartidoVotosMinimo[],
  quociente: number,
  nomePartido: string
): number | null {
  const qpList: { nome: string; qp: number }[] = []
  for (const r of rows) {
    if (!r.atingiuMinimo) continue
    const vagasDiretas = Math.floor(r.votosTotal / quociente)
    const qp = r.votosTotal / (vagasDiretas + 1)
    qpList.push({ nome: r.nome, qp })
  }
  qpList.sort((a, b) => b.qp - a.qp)
  const idx = qpList.findIndex((x) => x.nome === nomePartido)
  if (idx < 0) return null
  return idx + 1
}

/** Aplica delta nos votos e recalcula atingiuMinimo (80% do QE), alinhado à página Chapas. */
export function partidosComDeltaVotosRecalculaMinimo(
  rows: PartidoVotosMinimo[],
  nomePartido: string,
  deltaVotos: number,
  quociente: number
): PartidoVotosMinimo[] {
  const minVotos = quociente * 0.8
  return rows.map((r) => {
    if (r.nome !== nomePartido) return { ...r }
    const vt = Math.max(0, Math.round(r.votosTotal + deltaVotos))
    return { ...r, votosTotal: vt, atingiuMinimo: vt >= minVotos }
  })
}

type ImpactoCompetidorExtra = 'sem_mudar_vagas' | 'pode_mudar_vagas'

function impactoVotosExtrasNoCompetidor(
  rows: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number,
  nomeCompetidor: string | null,
  delta: number
): ImpactoCompetidorExtra | null {
  if (!nomeCompetidor || delta <= 0) return null
  if (!rows.some((r) => r.nome === nomeCompetidor)) return null
  const base = mapaVagasPorPartido(rows, quociente, numVagas)
  const alt = mapaVagasPorPartido(
    partidosComDeltaVotosRecalculaMinimo(rows, nomeCompetidor, delta, quociente),
    quociente,
    numVagas
  )
  return mapasVagasIguais(base, alt) ? 'sem_mudar_vagas' : 'pode_mudar_vagas'
}

function impactoAlvoSomaVotos(
  rows: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number,
  nomeAlvo: string,
  delta: number
): 'ganha_vaga' | 'nao_ganha' | null {
  if (delta <= 0) return null
  if (!rows.some((r) => r.nome === nomeAlvo)) return null
  const base = mapaVagasPorPartido(rows, quociente, numVagas)
  const alt = mapaVagasPorPartido(
    partidosComDeltaVotosRecalculaMinimo(rows, nomeAlvo, delta, quociente),
    quociente,
    numVagas
  )
  return (alt[nomeAlvo] ?? 0) > (base[nomeAlvo] ?? 0) ? 'ganha_vaga' : 'nao_ganha'
}

function impactoAlvoPerdeAlemDaMargem(
  rows: PartidoVotosMinimo[],
  quociente: number,
  numVagas: number,
  nomeAlvo: string,
  margem: number
): 'perde_vaga' | 'mantem' | null {
  if (margem <= 0) return null
  const base = mapaVagasPorPartido(rows, quociente, numVagas)
  const queda = Math.floor(margem) + 1
  const alt = mapaVagasPorPartido(
    partidosComDeltaVotosRecalculaMinimo(rows, nomeAlvo, -queda, quociente),
    quociente,
    numVagas
  )
  if ((base[nomeAlvo] ?? 0) > (alt[nomeAlvo] ?? 0)) return 'perde_vaga'
  return 'mantem'
}

export type BuildSegundaVagaFeedbackContext = {
  partidosRows: PartidoVotosMinimo[]
  quociente: number
  numVagas: number
  nomePartidoAlvo: string
}

/**
 * Textos mínimos: separar “ordem na fila da sobra” (ranking de QP) de “mudança no número de vagas”.
 * Retorno com quebras de linha para o card renderizar em blocos.
 */
function montarNotasImpacto(
  s: SegundaVagaPartidoResult,
  ctx: BuildSegundaVagaFeedbackContext
): string | undefined {
  const { partidosRows, quociente, numVagas, nomePartidoAlvo } = ctx
  const pos = posicaoNaFilaProximaSobra(partidosRows, quociente, nomePartidoAlvo)
  const posTxt = pos !== null ? `${pos}º` : '?'
  const linhas: string[] = []

  if (s.tipo === 'margem') {
    const margemBruta = s.distancia
    if (margemBruta > 0) {
      linhas.push(
        `Próxima sobra agora: ${nomePartidoAlvo} ${posTxt} (÷ vagas diretas + 1 — mesmo critério dos cards de QP).`
      )
    } else {
      linhas.push(
        `Próxima sobra agora: ${nomePartidoAlvo} ${posTxt}. Margem crítica na última sobra ganha.`
      )
    }

    if (s.distanciaCompetidor > 0 && s.competidorProximo) {
      const impC = impactoVotosExtrasNoCompetidor(
        partidosRows,
        quociente,
        numVagas,
        s.competidorProximo,
        s.distanciaCompetidor
      )
      const x = s.distanciaCompetidor.toLocaleString('pt-BR')
      const c = s.competidorProximo
      if (impC === 'sem_mudar_vagas') {
        linhas.push(
          `${c} +${x}: não muda vagas no total — só quem passa na frente nesta fila (próxima sobra).`
        )
      } else if (impC === 'pode_mudar_vagas') {
        linhas.push(`${c} +${x}: pode mudar vagas no total.`)
      } else {
        linhas.push(`${c} +${x} (efeito indeterminado).`)
      }
    }

    if (margemBruta > 0) {
      const impP = impactoAlvoPerdeAlemDaMargem(
        partidosRows,
        quociente,
        numVagas,
        nomePartidoAlvo,
        margemBruta
      )
      if (impP === 'perde_vaga') {
        linhas.push(
          `Perder ~${(Math.floor(margemBruta) + 1).toLocaleString('pt-BR')} votos além da margem: pode perder vaga.`
        )
      }
    }
  }

  if (s.proximaVagaExtra && s.proximaVagaExtra.distancia > 0) {
    const ig = impactoAlvoSomaVotos(
      partidosRows,
      quociente,
      numVagas,
      nomePartidoAlvo,
      s.proximaVagaExtra.distancia
    )
    const m = s.proximaVagaExtra.distancia.toLocaleString('pt-BR')
    if (ig === 'ganha_vaga') {
      linhas.push(`−${m} (linha vermelha): no cenário fechado, +1 vaga — não é a fila “agora”.`)
    } else if (ig === 'nao_ganha') {
      linhas.push(`−${m} (linha vermelha): no total, pode não virar vaga nova.`)
    }
  }

  if (s.tipo === 'faltam' && s.distancia > 0 && !s.proximaVagaExtra) {
    const ig = impactoAlvoSomaVotos(partidosRows, quociente, numVagas, nomePartidoAlvo, s.distancia)
    if (ig === 'ganha_vaga') {
      linhas.push(`−${s.distancia.toLocaleString('pt-BR')}: cenário fechado +1 vaga.`)
    } else if (ig === 'nao_ganha') {
      linhas.push(`−${s.distancia.toLocaleString('pt-BR')}: no total, sem vaga nova.`)
    }
  }

  if (linhas.length === 0) return undefined
  return linhas.join('\n')
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
      rodadaSobra: rodadaCritica.rodada,
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
        rodada: extra.rodadaSobra,
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

export type SegundaVagaFeedbackLabelResult = {
  text: string
  tone: SegundaVagaFeedbackTone
  segundaLinha?: string
  /** Uma linha por frase (separadas por quebra de linha no card) */
  notaImpacto?: string
}

/** Faltam votos para o alvo superar o QP na rodada de sobra indicada (não é “Nª vaga” do competidor). */
export function formatarTextoFaltamVotosDisputaSobra(
  distancia: number,
  rodadaSobra: number,
  competidor: string
): string {
  const ordem = rodadaSobra > 0 ? `${rodadaSobra}ª` : 'próxima'
  return `−${distancia.toLocaleString('pt-BR')} votos p/ disputar a ${ordem} sobra (${competidor} maior QP nesta rodada)`
}

export function formatarTextoDisputaSobraSemDistancia(rodadaSobra: number, competidor: string): string {
  const ordem = rodadaSobra > 0 ? `${rodadaSobra}ª` : 'próxima'
  return `Disputa da ${ordem} sobra (${competidor} maior QP nesta rodada)`
}

function linhaMargemSobraPrefixo(margemTexto: string, competidorLabel: string, s: SegundaVagaPartidoResult) {
  let linha = `Margem na última sobra: ${margemTexto}`
  if (s.distanciaCompetidor > 0 && s.competidorProximo) {
    linha += ` · ${competidorLabel} +${s.distanciaCompetidor.toLocaleString('pt-BR')}`
  }
  return linha
}

/**
 * Texto e tom alinhados ao KPI Projeção Federal / Estadual.
 * Com `simulacao` (Chapas): linha 1 só o valor da margem; detalhes curtos em `notaImpacto`.
 */
export function buildSegundaVagaFeedbackLabel(
  s: SegundaVagaPartidoResult | null,
  opts: { escopo: 'federal' | 'estadual'; simulacao?: BuildSegundaVagaFeedbackContext }
): SegundaVagaFeedbackLabelResult | null {
  if (!s) return null

  const notaImpacto = opts.simulacao ? montarNotasImpacto(s, opts.simulacao) : undefined
  const competidor = s.competidorProximo || '?'
  const comSim = !!opts.simulacao

  const montarSegundaLinhaProxima = (extra: ProximaVagaExtra): string | undefined => {
    if (extra.distancia <= 0) return undefined
    const c = extra.competidorProximo || '?'
    return formatarTextoFaltamVotosDisputaSobra(extra.distancia, extra.rodadaSobra, c)
  }

  if (opts.escopo === 'estadual') {
    if (s.tipo === 'margem') {
      const margem = s.distancia
      const tone: SegundaVagaFeedbackTone =
        margem > 20000 ? 'positive' : margem > 5000 ? 'neutral' : 'negative'
      let primeiraLinha: string
      if (margem > 0) {
        primeiraLinha = comSim
          ? `Margem: ${margem.toLocaleString('pt-BR')} votos`
          : linhaMargemSobraPrefixo(`${margem.toLocaleString('pt-BR')} votos`, competidor, s)
      } else {
        primeiraLinha = comSim
          ? `Margem: crítica na sobra (${s.vagasAtuais} vaga${s.vagasAtuais !== 1 ? 's' : ''})`
          : `Margem crítica na última sobra (${s.vagasAtuais} vaga${s.vagasAtuais !== 1 ? 's' : ''})`
        if (!comSim && s.distanciaCompetidor > 0 && s.competidorProximo) {
          primeiraLinha += ` · ${competidor} +${s.distanciaCompetidor.toLocaleString('pt-BR')}`
        }
      }
      const segundaLinha = s.proximaVagaExtra ? montarSegundaLinhaProxima(s.proximaVagaExtra) : undefined
      return { text: primeiraLinha, tone, segundaLinha, notaImpacto }
    }
    if (s.distancia > 0) {
      return {
        text: formatarTextoFaltamVotosDisputaSobra(s.distancia, s.rodada, competidor),
        tone: 'negative',
        notaImpacto,
      }
    }
    if (!s.competidorProximo) {
      return null
    }
    return {
      text: formatarTextoDisputaSobraSemDistancia(s.rodada, competidor),
      tone: 'neutral',
      notaImpacto,
    }
  }

  if (s.tipo === 'margem') {
    const margem = s.distancia
    const tone: SegundaVagaFeedbackTone =
      margem > 20000 ? 'positive' : margem > 5000 ? 'neutral' : 'negative'
    let primeiraLinha: string
    if (margem > 0) {
      const d = margem
      primeiraLinha = comSim
        ? `Margem: ${d.toLocaleString('pt-BR')} votos`
        : linhaMargemSobraPrefixo(`${d.toLocaleString('pt-BR')} votos`, competidor, s)
    } else {
      primeiraLinha = comSim
        ? `Margem: crítica na sobra (${s.vagasAtuais} vaga${s.vagasAtuais !== 1 ? 's' : ''})`
        : `Margem crítica na última sobra (${s.vagasAtuais} vaga${s.vagasAtuais !== 1 ? 's' : ''})`
      if (!comSim && s.distanciaCompetidor > 0 && s.competidorProximo) {
        primeiraLinha += ` · ${competidor} +${s.distanciaCompetidor.toLocaleString('pt-BR')}`
      }
    }
    const segundaLinha = s.proximaVagaExtra ? montarSegundaLinhaProxima(s.proximaVagaExtra) : undefined
    return { text: primeiraLinha, tone, segundaLinha, notaImpacto }
  }
  if (s.distancia > 0) {
    return {
      text: formatarTextoFaltamVotosDisputaSobra(s.distancia, s.rodada, competidor),
      tone: 'negative',
      notaImpacto,
    }
  }
  return null
}
