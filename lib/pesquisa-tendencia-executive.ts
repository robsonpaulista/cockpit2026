/**
 * Painel executivo: espontânea ajustada vs estimulada por candidato e métricas de topo.
 */

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

  const pesquisasUnicas = new Set(
    polls.map((p) => {
      const d = p.data.includes('T') ? p.data.split('T')[0] : p.data
      return `${d}|${p.instituto.trim().toLowerCase()}|${p.tipo}`
    })
  )

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
      }
    }
  )

  let liderNome: string | null = null
  let liderPct = 0
  let liderBase: 'espontanea_ajustada' | 'estimulada' = 'espontanea_ajustada'

  if (temEspontanea) {
    for (const c of cardsParcial) {
      if (!isCandidatoCampoAtivoEspontanea(c.nome)) continue
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

  /** Média de intenção por candidato: todas as linhas de pesquisa no recorte (estimulada + espontânea). */
  const mediaIntencaoPorCandidato = (() => {
    const agg = new Map<string, { sum: number; count: number }>()
    for (const p of polls) {
      if (!Number.isFinite(p.intencao)) continue
      const cur = agg.get(p.candidato_nome) ?? { sum: 0, count: 0 }
      cur.sum += p.intencao
      cur.count += 1
      agg.set(p.candidato_nome, cur)
    }
    const out = new Map<string, number>()
    for (const [nome, { sum, count }] of agg) {
      out.set(nome, count > 0 ? sum / count : -1)
    }
    return out
  })()

  cards.sort((a, b) => {
    const aNs = isNaoSabeOuNaoOpinaNome(a.nome) || isBrancoNuloOuNenhumNome(a.nome)
    const bNs = isNaoSabeOuNaoOpinaNome(b.nome) || isBrancoNuloOuNenhumNome(b.nome)
    if (aNs !== bNs) return aNs ? 1 : -1
    const ma = mediaIntencaoPorCandidato.get(a.nome) ?? -1
    const mb = mediaIntencaoPorCandidato.get(b.nome) ?? -1
    if (mb !== ma) return mb - ma
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return {
    temEstimulada,
    temEspontanea,
    datasOrdenadas,
    cards,
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
