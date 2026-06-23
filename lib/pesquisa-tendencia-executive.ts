/**
 * Painel executivo: espontânea ajustada vs estimulada por candidato e métricas de topo.
 */

import { getEleitoradoByCity } from '@/lib/eleitores'
import {
  DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE,
  isBrancoNuloOuNenhumNome,
  isCandidatoCampoAtivoEspontanea,
  isNaoSabeOuNaoOpinaNome,
  normalizarLinhaEspontanea,
} from '@/lib/espontanea-normalize'

export type PollExecutiveInput = {
  data: string
  tipo: 'estimulada' | 'espontanea'
  candidato_nome: string
  intencao: number
  instituto: string
  /** Quando existir, entra na chave da pesquisa (data + instituto + cidade). */
  cidadeId?: string | null
  /** Fallback da cidade para a chave quando não houver `cidadeId`. */
  cidadeNome?: string | null
}

/** Chave estável da cidade no recorte (id, nome normalizado ou estadual). */
export function cidadeChavePoll(p: PollExecutiveInput): string {
  const id = p.cidadeId != null && String(p.cidadeId).trim() !== '' ? String(p.cidadeId).trim() : ''
  if (id) return `id:${id}`
  const nm = (p.cidadeNome ?? '').trim().toLowerCase()
  if (nm) return `nm:${nm}`
  return '__estado__'
}

/** Rótulo amigável da cidade para tabelas. */
export function cidadeRotuloPoll(p: PollExecutiveInput): string {
  const nome = (p.cidadeNome ?? '').trim()
  if (nome) return nome
  if (p.cidadeId != null && String(p.cidadeId).trim() !== '') return `Cidade (id ${String(p.cidadeId).trim()})`
  return 'Estado (todas as cidades)'
}

/** Uma pesquisa = mesma data (dia), instituto e cidade (estadual quando sem cidade). */
export function chavePesquisaDistinta(p: PollExecutiveInput): string {
  const raw = p.data
  const d = raw.includes('T') ? (raw.split('T')[0] ?? raw) : raw
  const inst = (p.instituto ?? '').trim().toLowerCase()
  return `${d}|${inst}|${cidadeChavePoll(p)}`
}

export type TendenciaPosicaoCandidato = 'subindo' | 'caindo' | 'estavel'

export type CandidatoMediaNaCidade = {
  nome: string
  /** Média aritmética da intenção (%) nas linhas do candidato na cidade. */
  mediaPct: number
  /**
   * Tendência da posição nas últimas ondas de pesquisa do município (regressão linear).
   * `null` quando não há ondas suficientes para estimar.
   */
  tendenciaPosicao?: TendenciaPosicaoCandidato | null
  /** Quantas ondas distintas entraram no cálculo da tendência. */
  ondasTendencia?: number
  /** Força da tendência (0–1), para intensidade do heatmap. */
  intensidadeTendencia?: number
}

/** Últimas N pesquisas distintas usadas na regressão de posição por município. */
export const CIDADE_TENDENCIA_ONDAS_MAX = 5

/** Mínimo de ondas no município para exibir seta de tendência. */
export const CIDADE_TENDENCIA_MIN_ONDAS = 3

/** Inclinação (posições por onda) abaixo disso = melhora; acima = queda; entre = estável. */
export const CIDADE_TENDENCIA_SLOPE_LIMIAR = 0.2

export function rotuloTendenciaPosicao(
  tendencia: TendenciaPosicaoCandidato,
  ondas: number
): string {
  const base = `Tendência nas últimas ${ondas} pesquisas distintas do município (regressão da posição no ranking).`
  if (tendencia === 'subindo') {
    return `${base} Melhora consistente — posição subindo.`
  }
  if (tendencia === 'caindo') {
    return `${base} Queda consistente — posição caindo.`
  }
  return `${base} Posição estável.`
}

function linhaCandidatoValidaParaRanking(nome: string): boolean {
  return !isNaoSabeOuNaoOpinaNome(nome) && !isBrancoNuloOuNenhumNome(nome)
}

function dataOrdenavelDaChavePesquisa(chave: string): string {
  return chave.split('|')[0] ?? chave
}

/** Ranking por onda (pesquisa distinta), em ordem cronológica. */
function rankingsPorOndaCronologicos(linhasTipo: PollExecutiveInput[]): Map<string, number>[] {
  const porOnda = new Map<string, PollExecutiveInput[]>()
  for (const q of linhasTipo) {
    if (!Number.isFinite(q.intencao)) continue
    if (!linhaCandidatoValidaParaRanking(q.candidato_nome)) continue
    const chave = chavePesquisaDistinta(q)
    const bucket = porOnda.get(chave) ?? []
    bucket.push(q)
    porOnda.set(chave, bucket)
  }

  const ondasOrdenadas = [...porOnda.entries()].sort(([a], [b]) => {
    const da = dataOrdenavelDaChavePesquisa(a)
    const db = dataOrdenavelDaChavePesquisa(b)
    if (da !== db) return da.localeCompare(db)
    return a.localeCompare(b)
  })

  return ondasOrdenadas.map(([, rows]) => {
    const mediaPorCandidato = new Map<string, { sum: number; count: number }>()
    for (const row of rows) {
      const cur = mediaPorCandidato.get(row.candidato_nome) ?? { sum: 0, count: 0 }
      cur.sum += row.intencao
      cur.count += 1
      mediaPorCandidato.set(row.candidato_nome, cur)
    }
    const ordenados = [...mediaPorCandidato.entries()]
      .map(([nome, { sum, count }]) => ({
        nome,
        media: count > 0 ? sum / count : 0,
      }))
      .sort((a, b) =>
        b.media !== a.media
          ? b.media - a.media
          : a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
      )
    const posicoes = new Map<string, number>()
    ordenados.forEach((item, idx) => posicoes.set(item.nome, idx + 1))
    return posicoes
  })
}

function inclinacaoRegressaoLinear(valores: number[]): number {
  const n = valores.length
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += valores[i]!
    sumXY += i * valores[i]!
    sumX2 += i * i
  }
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

function posicaoCandidatoNaOnda(nome: string, ranking: Map<string, number>): number {
  const direta = ranking.get(nome)
  if (direta !== undefined) return direta
  const maxPos = ranking.size > 0 ? Math.max(...ranking.values()) : 0
  return maxPos + 1
}

function intensidadeTendenciaDeSlope(slope: number): number {
  return Math.min(1, Math.abs(slope) / 1.2)
}

function tendenciaPosicaoDeSerie(
  posicoes: number[]
): { tendencia: TendenciaPosicaoCandidato; intensidade: number } {
  const slope = inclinacaoRegressaoLinear(posicoes)
  let tendencia: TendenciaPosicaoCandidato = 'estavel'
  if (slope <= -CIDADE_TENDENCIA_SLOPE_LIMIAR) tendencia = 'subindo'
  else if (slope >= CIDADE_TENDENCIA_SLOPE_LIMIAR) tendencia = 'caindo'
  return { tendencia, intensidade: intensidadeTendenciaDeSlope(slope) }
}

function tendenciaPosicaoCandidatoNasOndas(
  nome: string,
  ondas: Map<string, number>[]
): {
  tendencia: TendenciaPosicaoCandidato
  ondasUsadas: number
  intensidade: number
} | null {
  if (ondas.length < CIDADE_TENDENCIA_MIN_ONDAS) return null
  const recentes = ondas.slice(-CIDADE_TENDENCIA_ONDAS_MAX)
  const serie = recentes.map((ranking) => posicaoCandidatoNaOnda(nome, ranking))
  if (serie.length < CIDADE_TENDENCIA_MIN_ONDAS) return null
  const { tendencia, intensidade } = tendenciaPosicaoDeSerie(serie)
  return {
    tendencia,
    ondasUsadas: serie.length,
    intensidade,
  }
}

function enriquecerTopComTendencia(
  top10: CandidatoMediaNaCidade[],
  linhasTipo: PollExecutiveInput[]
): CandidatoMediaNaCidade[] {
  const ondas = rankingsPorOndaCronologicos(linhasTipo)
  return top10.map((candidato) => {
    const calc = tendenciaPosicaoCandidatoNasOndas(candidato.nome, ondas)
    if (!calc) {
      return { ...candidato, tendenciaPosicao: null, ondasTendencia: ondas.length }
    }
    return {
      ...candidato,
      tendenciaPosicao: calc.tendencia,
      ondasTendencia: calc.ondasUsadas,
      intensidadeTendencia: calc.intensidade,
    }
  })
}

/** Quantidade de posições exibidas no ranking por cidade (vagas típicas na eleição). */
export const CIDADE_INTENCAO_TOP_N = 10

export type CidadeIntencaoTopoRow = {
  cidadeChave: string
  cidadeLabel: string
  /** Pesquisas distintas (data + instituto + cidade) só nas linhas espontâneas. */
  pesquisasDistintasEspontanea: number
  /** Até `CIDADE_INTENCAO_TOP_N` candidatos com maior média na espontânea (excl. NS/branco). */
  top10Espontanea: CandidatoMediaNaCidade[]
  /** Pesquisas distintas só nas linhas estimuladas. */
  pesquisasDistintasEstimulada: number
  /** Até `CIDADE_INTENCAO_TOP_N` candidatos com maior média na estimulada (excl. NS/branco). */
  top10Estimulada: CandidatoMediaNaCidade[]
}

function pesquisasDistintasELeaderboardTopN(
  linhasTipo: PollExecutiveInput[]
): { pesquisasDistintas: number; top10: CandidatoMediaNaCidade[] } {
  const pesquisasDistintas = new Set(linhasTipo.map((q) => chavePesquisaDistinta(q))).size
  const aggCand = new Map<string, { sum: number; count: number }>()
  for (const q of linhasTipo) {
    if (isNaoSabeOuNaoOpinaNome(q.candidato_nome) || isBrancoNuloOuNenhumNome(q.candidato_nome)) continue
    const cur = aggCand.get(q.candidato_nome) ?? { sum: 0, count: 0 }
    cur.sum += q.intencao
    cur.count += 1
    aggCand.set(q.candidato_nome, cur)
  }
  const top10 = [...aggCand.entries()]
    .map(([nome, { sum, count }]) => ({
      nome,
      mediaPct: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    }))
    .sort((a, b) =>
      b.mediaPct !== a.mediaPct
        ? b.mediaPct - a.mediaPct
        : a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    )
    .slice(0, CIDADE_INTENCAO_TOP_N)
  return {
    pesquisasDistintas,
    top10: enriquecerTopComTendencia(top10, linhasTipo),
  }
}

/** Por cidade: pesquisas distintas e top N por média, separados entre espontânea e estimulada. */
export function buildCidadesIntencaoTopoMedia(polls: PollExecutiveInput[]): CidadeIntencaoTopoRow[] {
  const byCity = new Map<string, { label: string; polls: PollExecutiveInput[] }>()
  for (const p of polls) {
    if (!Number.isFinite(p.intencao)) continue
    const ck = cidadeChavePoll(p)
    if (!byCity.has(ck)) {
      byCity.set(ck, { label: cidadeRotuloPoll(p), polls: [] })
    }
    const bucket = byCity.get(ck)!
    bucket.polls.push(p)
    const nm = (p.cidadeNome ?? '').trim()
    if (nm) bucket.label = nm
  }

  const linhas: CidadeIntencaoTopoRow[] = []
  for (const [cidadeChave, { label, polls: cityPolls }] of byCity) {
    const esp = cityPolls.filter((q) => q.tipo === 'espontanea')
    const est = cityPolls.filter((q) => q.tipo === 'estimulada')
    const espBlock = pesquisasDistintasELeaderboardTopN(esp)
    const estBlock = pesquisasDistintasELeaderboardTopN(est)
    linhas.push({
      cidadeChave,
      cidadeLabel: label,
      pesquisasDistintasEspontanea: espBlock.pesquisasDistintas,
      top10Espontanea: espBlock.top10,
      pesquisasDistintasEstimulada: estBlock.pesquisasDistintas,
      top10Estimulada: estBlock.top10,
    })
  }
  linhas.sort((a, b) => {
    const sa = a.pesquisasDistintasEspontanea + a.pesquisasDistintasEstimulada
    const sb = b.pesquisasDistintasEspontanea + b.pesquisasDistintasEstimulada
    if (sb !== sa) return sb - sa
    return a.cidadeLabel.localeCompare(b.cidadeLabel, 'pt-BR', { sensitivity: 'base' })
  })
  return linhas
}

/** Média aritmética de intenção (%) por candidato na cidade, só no tipo indicado. */
function mediasCandidatoNaCidadePorTipo(
  cityPolls: PollExecutiveInput[],
  tipo: 'estimulada' | 'espontanea'
): Map<string, number> {
  const linhasTipo = cityPolls.filter((q) => q.tipo === tipo)
  const agg = new Map<string, { sum: number; count: number }>()
  for (const q of linhasTipo) {
    if (!Number.isFinite(q.intencao)) continue
    if (isNaoSabeOuNaoOpinaNome(q.candidato_nome) || isBrancoNuloOuNenhumNome(q.candidato_nome)) continue
    const cur = agg.get(q.candidato_nome) ?? { sum: 0, count: 0 }
    cur.sum += q.intencao
    cur.count += 1
    agg.set(q.candidato_nome, cur)
  }
  const out = new Map<string, number>()
  for (const [nome, { sum, count }] of agg) {
    out.set(nome, count > 0 ? Math.round((sum / count) * 10) / 10 : 0)
  }
  return out
}

export type ProjecaoVotoCandidatoRow = {
  rank: number
  nome: string
  /** Soma nos municípios: eleitorado × (média % / 100). */
  votosProjetados: number
  /** Participação relativa entre os candidatos listados (soma das projeções = 100%). */
  pctSobreSomaProjetada: number
}

export type ProjecaoVotosEleitoradoRecorte = {
  /** Como a intenção % foi escolhida em cada município (texto curto para o painel). */
  baseIntencaoLabel: string
  ranking: ProjecaoVotoCandidatoRow[]
  /** Soma do eleitorado TRE nos municípios onde houve projeção (cadastro encontrado). */
  eleitoradoSomadoRecorte: number
  /** Soma das projeções de votos de todos os candidatos listados. */
  somaVotosProjetados: number
  municipiosPonderados: number
  municipiosComPesquisaSemEleitoradoCadastrado: number
  municipiosApenasEstadualExcluidos: number
}

/**
 * Acumula votos projetados: em cada município com pesquisa, multiplica o eleitorado oficial (`lib/eleitores`)
 * pela média de intenção (%) do candidato naquele município — estimulada se existir na cidade, senão espontânea bruta.
 * Linhas só estaduais (sem cidade) não entram. Cidades sem cadastro de eleitorado são contadas mas não somam votos.
 */
export function buildProjecaoVotosEleitorado(polls: PollExecutiveInput[]): ProjecaoVotosEleitoradoRecorte {
  const byCity = new Map<string, { label: string; polls: PollExecutiveInput[] }>()
  for (const p of polls) {
    if (!Number.isFinite(p.intencao)) continue
    const ck = cidadeChavePoll(p)
    if (!byCity.has(ck)) {
      byCity.set(ck, { label: cidadeRotuloPoll(p), polls: [] })
    }
    const bucket = byCity.get(ck)!
    bucket.polls.push(p)
    const nm = (p.cidadeNome ?? '').trim()
    if (nm) bucket.label = nm
  }

  const votosPorCandidato = new Map<string, number>()
  let eleitoradoSomadoRecorte = 0
  let municipiosPonderados = 0
  let municipiosComPesquisaSemEleitoradoCadastrado = 0
  let municipiosApenasEstadualExcluidos = 0

  for (const [cidadeChave, { label, polls: cityPolls }] of byCity) {
    if (cidadeChave === '__estado__') {
      municipiosApenasEstadualExcluidos += 1
      continue
    }
    const labelTrim = label.trim()
    if (!labelTrim || labelTrim.startsWith('Cidade (id')) {
      municipiosComPesquisaSemEleitoradoCadastrado += 1
      continue
    }

    const temEstNaCidade = cityPolls.some((q) => q.tipo === 'estimulada')
    const tipo: 'estimulada' | 'espontanea' = temEstNaCidade ? 'estimulada' : 'espontanea'
    const medias = mediasCandidatoNaCidadePorTipo(cityPolls, tipo)
    if (medias.size === 0) continue

    const eleitores = getEleitoradoByCity(labelTrim)
    if (eleitores == null || eleitores <= 0) {
      municipiosComPesquisaSemEleitoradoCadastrado += 1
      continue
    }

    eleitoradoSomadoRecorte += eleitores
    municipiosPonderados += 1
    for (const [nome, mediaPct] of medias) {
      const add = eleitores * (mediaPct / 100)
      votosPorCandidato.set(nome, (votosPorCandidato.get(nome) ?? 0) + add)
    }
  }

  const preRanking = [...votosPorCandidato.entries()]
    .map(([nome, v]) => ({ nome, votosProjetados: Math.round(v) }))
    .filter((r) => r.votosProjetados > 0)
    .sort((a, b) => b.votosProjetados - a.votosProjetados)

  const somaVotosProjetados = preRanking.reduce((s, r) => s + r.votosProjetados, 0)

  const ranking: ProjecaoVotoCandidatoRow[] = preRanking.map((row, i) => ({
    rank: i + 1,
    nome: row.nome,
    votosProjetados: row.votosProjetados,
    pctSobreSomaProjetada:
      somaVotosProjetados > 0 ? Math.round((row.votosProjetados / somaVotosProjetados) * 1000) / 10 : 0,
  }))

  return {
    baseIntencaoLabel:
      'Por município: média da estimulada quando houver linhas estimuladas na cidade; caso contrário, média da espontânea bruta.',
    ranking,
    eleitoradoSomadoRecorte,
    somaVotosProjetados,
    municipiosPonderados,
    municipiosComPesquisaSemEleitoradoCadastrado,
    municipiosApenasEstadualExcluidos,
  }
}

export type SeriePontoExecutive = {
  dataLabel: string
  dataMs: number
  valor: number
  /** Instituto da onda (mesma data / tipo) quando disponível */
  instituto?: string
}

export type CandidatoExecutiveCard = {
  nome: string
  pontosEspAjustada: SeriePontoExecutive[]
  pontosEstimulada: SeriePontoExecutive[]
  ultimaEsp: number | null
  ultimaEst: number | null
  primeiraEsp: number | null
  primeiraEst: number | null
  /** Média dos pontos da série no período (espontânea ajustada). */
  mediaEspAjustada: number | null
  /** Média dos pontos da série no período (estimulada). */
  mediaEstimulada: number | null
  deltaEstVsEsp: number | null
  variacaoEsp: number | null
  variacaoEst: number | null
  institutoUltimaEst: string | null
  institutoUltimaEsp: string | null
  /** Pesquisas distintas no recorte (data + instituto + cidade) em que o candidato tem registro. */
  pesquisasDistintas: number
  badge: string
  badgeVariant: 'success' | 'warning' | 'neutral' | 'danger' | 'muted'
}

export type ExecutiveTendenciaResumo = {
  totalPesquisasUnicas: number
  periodoLabel: string
  lider: { nome: string; pct: number; base: 'espontanea_ajustada' | 'estimulada' } | null
  maiorVariacao: {
    nome: string
    delta: number
    base: 'estimulada' | 'espontanea_ajustada'
  } | null
  indecisosUltimaEspPct: number | null
}

export type ExecutiveTendenciaModel = {
  temEstimulada: boolean
  temEspontanea: boolean
  datasOrdenadas: string[]
  cards: CandidatoExecutiveCard[]
  /** Visão geral por município: espontânea e estimulada separadas (Pesq. distintas + top 10 por média em cada tipo). */
  cidadesIntencaoTop10: CidadeIntencaoTopoRow[]
  /** Projeção acumulada (média × eleitorado por município) para confrontar com a base na eleição. */
  projecaoVotosEleitorado: ProjecaoVotosEleitoradoRecorte
  resumo: ExecutiveTendenciaResumo
}

export function formatDataPesquisaPtBr(dateStr: string): string {
  if (!dateStr) return ''
  if (dateStr.includes('T')) {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function dataLabelToMs(label: string): number {
  const parts = label.split('/').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 0
  const [d, m, y] = parts
  return new Date(y, m - 1, d).getTime()
}

/** Rótulo curto para eixo em espaço apertado (ex.: 12/01/2026 → 12/01/26). */
export function shortDataLabelPtBr(dl: string): string {
  const parts = dl.split('/').map((p) => Number(p))
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dl
  const [d, m, y] = parts
  const yy = y % 100
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(yy).padStart(2, '0')}`
}

function intencaoKey(nome: string): string {
  return `intencao_${nome.replace(/\s+/g, '_')}`
}

type CelulaPonto = { intencao: number; instituto: string }

/** Agrupa valor + instituto por (dataLabel, candidato); último registro do array prevalece na mesma data. */
function mapaCelulasPorDataTipo(
  polls: PollExecutiveInput[],
  tipo: 'estimulada' | 'espontanea'
): Map<string, Map<string, CelulaPonto>> {
  const porData = new Map<string, Map<string, CelulaPonto>>()
  const filtrados = polls.filter((p) => p.tipo === tipo)
  for (const p of filtrados) {
    const dl = formatDataPesquisaPtBr(p.data)
    if (!porData.has(dl)) porData.set(dl, new Map())
    porData.get(dl)!.set(p.candidato_nome, {
      intencao: p.intencao,
      instituto: (p.instituto ?? '').trim(),
    })
  }
  return porData
}

function mapaIntencaoFromCelulas(
  cel: Map<string, Map<string, CelulaPonto>>
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const [dl, row] of cel) {
    const m = new Map<string, number>()
    for (const [nome, c] of row) m.set(nome, c.intencao)
    out.set(dl, m)
  }
  return out
}

function institutoNaDataEspBruta(
  mapEspCelulas: Map<string, Map<string, CelulaPonto>>,
  dl: string,
  nome: string
): string | null {
  const row = mapEspCelulas.get(dl)
  if (!row) return null
  const own = row.get(nome)?.instituto?.trim()
  if (own) return own
  for (const c of row.values()) {
    const t = c.instituto?.trim()
    if (t) return t
  }
  return null
}

function normalizarMapaEspontanea(
  mapaEsp: Map<string, Map<string, number>>
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const [dl, cmap] of mapaEsp) {
    const row: Record<string, string | number | undefined> = { data: dl }
    for (const [nome, v] of cmap) {
      row[intencaoKey(nome)] = v
    }
    const norm = normalizarLinhaEspontanea(
      row,
      DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE
    ) as Record<string, string | number | undefined>
    const m = new Map<string, number>()
    for (const k of Object.keys(norm)) {
      if (!k.startsWith('intencao_')) continue
      const nome = k.replace(/^intencao_/, '').replace(/_/g, ' ')
      const val = norm[k]
      if (typeof val === 'number' && Number.isFinite(val)) m.set(nome, val)
    }
    out.set(dl, m)
  }
  return out
}

function pontosDaSerieCelulas(
  mapa: Map<string, Map<string, CelulaPonto>>,
  nome: string,
  datasOrdenadas: string[]
): SeriePontoExecutive[] {
  const pts: SeriePontoExecutive[] = []
  for (const dl of datasOrdenadas) {
    const cell = mapa.get(dl)?.get(nome)
    if (!cell || !Number.isFinite(cell.intencao)) continue
    const inst = cell.instituto.trim()
    pts.push({
      dataLabel: dl,
      dataMs: dataLabelToMs(dl),
      valor: cell.intencao,
      ...(inst ? { instituto: inst } : {}),
    })
  }
  return pts
}

function pontosEspAjustadaComInstituto(
  mapAdj: Map<string, Map<string, number>>,
  mapEspCelulas: Map<string, Map<string, CelulaPonto>>,
  nome: string,
  datasOrdenadas: string[]
): SeriePontoExecutive[] {
  const pts: SeriePontoExecutive[] = []
  for (const dl of datasOrdenadas) {
    const v = mapAdj.get(dl)?.get(nome)
    if (v === undefined || !Number.isFinite(v)) continue
    const inst = institutoNaDataEspBruta(mapEspCelulas, dl, nome)
    pts.push({
      dataLabel: dl,
      dataMs: dataLabelToMs(dl),
      valor: v,
      ...(inst ? { instituto: inst } : {}),
    })
  }
  return pts
}

function ultimoInstitutoDaSerie(pts: SeriePontoExecutive[]): string | null {
  for (let i = pts.length - 1; i >= 0; i--) {
    const s = pts[i].instituto?.trim()
    if (s) return s
  }
  return null
}

function ultimoValor(pts: SeriePontoExecutive[]): number | null {
  if (pts.length === 0) return null
  return pts[pts.length - 1].valor
}

function primeiroValor(pts: SeriePontoExecutive[]): number | null {
  if (pts.length === 0) return null
  return pts[0].valor
}

function mediaDaSerie(pts: SeriePontoExecutive[]): number | null {
  if (pts.length === 0) return null
  const sum = pts.reduce((acc, p) => acc + p.valor, 0)
  return Math.round((sum / pts.length) * 10) / 10
}

function classificarBadge(
  nome: string,
  liderNome: string | null,
  ultimaEsp: number | null,
  deltaEstVsEsp: number | null,
  variacaoEsp: number | null,
  ultimaEst: number | null,
  variacaoEst: number | null,
  temEspontanea: boolean,
  temEstimulada: boolean
): { badge: string; badgeVariant: CandidatoExecutiveCard['badgeVariant'] } {
  if (isNaoSabeOuNaoOpinaNome(nome)) {
    return { badge: 'ATENÇÃO', badgeVariant: 'warning' }
  }
  if (isBrancoNuloOuNenhumNome(nome)) {
    return { badge: 'OUTROS', badgeVariant: 'muted' }
  }
  if (liderNome && nome === liderNome) {
    return { badge: 'LÍDER', badgeVariant: 'success' }
  }

  const ultimaRef = temEspontanea ? ultimaEsp : ultimaEst
  const metricaSalto =
    deltaEstVsEsp ?? (!temEspontanea && temEstimulada ? variacaoEst : null)
  const variacaoSerie = temEspontanea ? variacaoEsp : variacaoEst

  if (ultimaRef === null) {
    return { badge: 'ACOMPANHAR', badgeVariant: 'neutral' }
  }

  const esp = ultimaRef

  if (esp < 4 && esp > 0 && (metricaSalto === null || metricaSalto < 12)) {
    return { badge: 'BAIXA EXPRESSÃO', badgeVariant: 'neutral' }
  }
  if (metricaSalto !== null && metricaSalto >= 22) {
    return { badge: 'EM ALTA', badgeVariant: 'success' }
  }
  if (metricaSalto !== null && metricaSalto >= 8 && metricaSalto < 22) {
    return { badge: 'EM CRESCIMENTO', badgeVariant: 'warning' }
  }
  if (variacaoSerie !== null && Math.abs(variacaoSerie) < 1) {
    return { badge: 'ESTÁVEL', badgeVariant: 'warning' }
  }
  if (variacaoSerie !== null && variacaoSerie >= 1) {
    return { badge: 'EM CRESCIMENTO', badgeVariant: 'warning' }
  }
  return { badge: 'ACOMPANHAR', badgeVariant: 'neutral' }
}

/**
 * Monta o modelo do painel a partir das pesquisas já filtradas (cargo, cidade, região, etc.).
 */
export function buildExecutiveTendenciaModel(polls: PollExecutiveInput[]): ExecutiveTendenciaModel {
  const temEstimulada = polls.some((p) => p.tipo === 'estimulada')
  const temEspontanea = polls.some((p) => p.tipo === 'espontanea')

  const mapEstCelulas = mapaCelulasPorDataTipo(polls, 'estimulada')
  const mapEspCelulas = mapaCelulasPorDataTipo(polls, 'espontanea')
  const mapEspBruto = mapaIntencaoFromCelulas(mapEspCelulas)
  const mapEspAdj = normalizarMapaEspontanea(mapEspBruto)

  const datasSet = new Set<string>([...mapEstCelulas.keys(), ...mapEspAdj.keys()])
  const datasOrdenadas = [...datasSet].sort((a, b) => dataLabelToMs(a) - dataLabelToMs(b))

  const nomes = new Set<string>()
  for (const p of polls) nomes.add(p.candidato_nome)

  const nomesOrdenados = [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  /**
   * Por candidato: chave = pesquisa (data + instituto + cidade); dentro da chave, média da intenção
   * nas linhas (ex.: estimulada + espontânea na mesma onda).
   */
  const porCandidatoPorPesquisa = new Map<string, Map<string, { sum: number; count: number }>>()
  let somaIntencaoGlobalSemResiduos = 0
  let registrosGlobalSemResiduos = 0
  for (const p of polls) {
    if (!Number.isFinite(p.intencao)) continue
    const nome = p.candidato_nome
    if (!porCandidatoPorPesquisa.has(nome)) porCandidatoPorPesquisa.set(nome, new Map())
    const chave = chavePesquisaDistinta(p)
    const inner = porCandidatoPorPesquisa.get(nome)!
    const cur = inner.get(chave) ?? { sum: 0, count: 0 }
    cur.sum += p.intencao
    cur.count += 1
    inner.set(chave, cur)
    if (!isNaoSabeOuNaoOpinaNome(nome) && !isBrancoNuloOuNenhumNome(nome)) {
      somaIntencaoGlobalSemResiduos += p.intencao
      registrosGlobalSemResiduos += 1
    }
  }

  type MetricasPesquisaCandidato = { pesquisasDistintas: number; sumMediasPorPesquisa: number }
  const metricasPorCandidato = new Map<string, MetricasPesquisaCandidato>()
  for (const [nome, porPesquisa] of porCandidatoPorPesquisa) {
    let sumMedias = 0
    for (const { sum, count } of porPesquisa.values()) {
      sumMedias += count > 0 ? sum / count : 0
    }
    const n = porPesquisa.size
    metricasPorCandidato.set(nome, { pesquisasDistintas: n, sumMediasPorPesquisa: sumMedias })
  }

  const mediaGlobalSemResiduos =
    registrosGlobalSemResiduos > 0 ? somaIntencaoGlobalSemResiduos / registrosGlobalSemResiduos : 0
  /** Peso do prior global na média ajustada por presença (maior = mais “puxa” quem tem poucas pesquisas). */
  const PRIOR_PRESENCA_K = 3
  const intencaoMediaAjustadaPresenca = (nome: string): number => {
    const m = metricasPorCandidato.get(nome)
    if (!m || m.pesquisasDistintas < 1) return mediaGlobalSemResiduos
    return (
      (m.sumMediasPorPesquisa + PRIOR_PRESENCA_K * mediaGlobalSemResiduos) /
      (m.pesquisasDistintas + PRIOR_PRESENCA_K)
    )
  }

  const contagensCampoAtivo = nomesOrdenados
    .filter((n) => isCandidatoCampoAtivoEspontanea(n))
    .map((n) => metricasPorCandidato.get(n)?.pesquisasDistintas ?? 0)
  const maxPesquisasCampoAtivo = contagensCampoAtivo.length > 0 ? Math.max(...contagensCampoAtivo) : 0
  /** Exige pelo menos 2 pesquisas distintas para disputar líder quando houver candidato de campo com isso. */
  const minPesquisasParaLider =
    maxPesquisasCampoAtivo >= 2 && contagensCampoAtivo.some((c) => c >= 2) ? 2 : 1

  const pesquisasUnicas = new Set(polls.map((p) => chavePesquisaDistinta(p)))

  const periodoLabel =
    datasOrdenadas.length >= 2
      ? `${datasOrdenadas[0]} → ${datasOrdenadas[datasOrdenadas.length - 1]}`
      : datasOrdenadas.length === 1
        ? datasOrdenadas[0]
        : '—'

  const cardsParcial: Omit<CandidatoExecutiveCard, 'badge' | 'badgeVariant'>[] = nomesOrdenados.map(
    (nome) => {
      const ptsE = pontosDaSerieCelulas(mapEstCelulas, nome, datasOrdenadas)
      const ptsS = pontosEspAjustadaComInstituto(mapEspAdj, mapEspCelulas, nome, datasOrdenadas)
      const ultE = ultimoValor(ptsE)
      const ultS = ultimoValor(ptsS)
      const priS = primeiroValor(ptsS)
      const priE = primeiroValor(ptsE)
      const deltaEstVsEsp =
        ultE !== null && ultS !== null ? Math.round((ultE - ultS) * 10) / 10 : null
      const variacaoEsp =
        ultS !== null && priS !== null ? Math.round((ultS - priS) * 10) / 10 : null
      const variacaoEst =
        ultE !== null && priE !== null ? Math.round((ultE - priE) * 10) / 10 : null
      const mediaS = mediaDaSerie(ptsS)
      const mediaE = mediaDaSerie(ptsE)

      return {
        nome,
        pontosEspAjustada: ptsS,
        pontosEstimulada: ptsE,
        ultimaEsp: ultS,
        ultimaEst: ultE,
        primeiraEsp: priS,
        primeiraEst: priE,
        mediaEspAjustada: mediaS,
        mediaEstimulada: mediaE,
        deltaEstVsEsp,
        variacaoEsp,
        variacaoEst,
        institutoUltimaEst: ultimoInstitutoDaSerie(ptsE),
        institutoUltimaEsp: ultimoInstitutoDaSerie(ptsS),
        pesquisasDistintas: metricasPorCandidato.get(nome)?.pesquisasDistintas ?? 0,
      }
    }
  )

  let liderNome: string | null = null
  let liderPct = 0
  let liderBase: 'espontanea_ajustada' | 'estimulada' = 'espontanea_ajustada'

  if (temEspontanea) {
    for (const c of cardsParcial) {
      if (!isCandidatoCampoAtivoEspontanea(c.nome)) continue
      if (c.pesquisasDistintas < minPesquisasParaLider) continue
      const v = c.ultimaEsp
      if (v !== null && v > liderPct) {
        liderPct = v
        liderNome = c.nome
        liderBase = 'espontanea_ajustada'
      }
    }
  }
  if (liderNome === null && temEstimulada) {
    liderPct = 0
    for (const c of cardsParcial) {
      if (!isCandidatoCampoAtivoEspontanea(c.nome)) continue
      if (c.pesquisasDistintas < minPesquisasParaLider) continue
      const v = c.ultimaEst
      if (v !== null && v > liderPct) {
        liderPct = v
        liderNome = c.nome
        liderBase = 'estimulada'
      }
    }
  }

  let maiorVarNome: string | null = null
  let maiorVarDelta = 0
  let maiorVarBase: 'estimulada' | 'espontanea_ajustada' = 'estimulada'

  if (temEstimulada) {
    for (const c of cardsParcial) {
      if (!isCandidatoCampoAtivoEspontanea(c.nome)) continue
      const pts = c.pontosEstimulada
      if (pts.length < 2) continue
      const d = pts[pts.length - 1].valor - pts[0].valor
      const ad = Math.abs(d)
      if (ad > Math.abs(maiorVarDelta) || (ad === Math.abs(maiorVarDelta) && ad > 0)) {
        maiorVarDelta = Math.round(d * 10) / 10
        maiorVarNome = c.nome
        maiorVarBase = 'estimulada'
      }
    }
  }

  if (maiorVarNome === null && temEspontanea) {
    maiorVarDelta = 0
    for (const c of cardsParcial) {
      if (!isCandidatoCampoAtivoEspontanea(c.nome)) continue
      const pts = c.pontosEspAjustada
      if (pts.length < 2) continue
      const d = pts[pts.length - 1].valor - pts[0].valor
      const ad = Math.abs(d)
      if (ad > Math.abs(maiorVarDelta) || (ad === Math.abs(maiorVarDelta) && ad > 0)) {
        maiorVarDelta = Math.round(d * 10) / 10
        maiorVarNome = c.nome
        maiorVarBase = 'espontanea_ajustada'
      }
    }
  }

  let indecisosUltimaEspPct: number | null = null
  if (datasOrdenadas.length > 0 && mapEspBruto.size > 0) {
    const ultData = datasOrdenadas[datasOrdenadas.length - 1]
    const brutoUlt = mapEspBruto.get(ultData)
    if (brutoUlt) {
      let somaNs = 0
      for (const [nome, val] of brutoUlt) {
        if (isNaoSabeOuNaoOpinaNome(nome)) somaNs += val
      }
      if (somaNs > 0) indecisosUltimaEspPct = Math.round(somaNs * 10) / 10
    }
  }

  const cards: CandidatoExecutiveCard[] = cardsParcial.map((c) => {
    const { badge, badgeVariant } = classificarBadge(
      c.nome,
      liderNome,
      c.ultimaEsp,
      c.deltaEstVsEsp,
      c.variacaoEsp,
      c.ultimaEst,
      c.variacaoEst,
      temEspontanea,
      temEstimulada
    )
    return { ...c, badge, badgeVariant }
  })

  /**
   * Ordenação: média por pesquisa “encolhida” para a média global quando há poucas pesquisas distintas,
   * depois desempate por quantidade de pesquisas e nome.
   */
  cards.sort((a, b) => {
    const aNs = isNaoSabeOuNaoOpinaNome(a.nome) || isBrancoNuloOuNenhumNome(a.nome)
    const bNs = isNaoSabeOuNaoOpinaNome(b.nome) || isBrancoNuloOuNenhumNome(b.nome)
    if (aNs !== bNs) return aNs ? 1 : -1
    const ia = intencaoMediaAjustadaPresenca(a.nome)
    const ib = intencaoMediaAjustadaPresenca(b.nome)
    if (ib !== ia) return ib - ia
    const ca = a.pesquisasDistintas
    const cb = b.pesquisasDistintas
    if (cb !== ca) return cb - ca
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const cidadesIntencaoTop10 = buildCidadesIntencaoTopoMedia(polls)
  const projecaoVotosEleitorado = buildProjecaoVotosEleitorado(polls)

  return {
    temEstimulada,
    temEspontanea,
    datasOrdenadas,
    cards,
    cidadesIntencaoTop10,
    projecaoVotosEleitorado,
    resumo: {
      totalPesquisasUnicas: pesquisasUnicas.size,
      periodoLabel,
      lider: liderNome ? { nome: liderNome, pct: Math.round(liderPct * 10) / 10, base: liderBase } : null,
      maiorVariacao:
        maiorVarNome != null ? { nome: maiorVarNome, delta: maiorVarDelta, base: maiorVarBase } : null,
      indecisosUltimaEspPct,
    },
  }
}
