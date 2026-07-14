import {
  formatObrasValorAbreviado,
  iptPrioridadeLabel,
  type IptMunicipio,
  type IptPrioridade,
  type IptSinal,
} from '@/lib/ipt'

/** Missões estratégicas do Diagnóstico Operacional (README). */
export type IptMissaoId = 'campo' | 'pesquisa' | 'digital' | 'obras'

export type IptMissaoFiltro = IptMissaoId | 'todas'

export type IptMissaoPrioridadeImpacto = 'alta' | 'media' | 'baixa'

export type IptMissaoConfig = {
  id: IptMissaoId
  label: string
  titulo: string
  tagline: string
  descricao: string
  cor: string
  corSuave: string
  corTexto: string
  corTint: string
}

export const IPT_MISSOES: IptMissaoConfig[] = [
  {
    id: 'campo',
    label: 'MISSÃO CAMPO',
    titulo: 'Onde ir',
    tagline: 'Campo',
    descricao: 'Alta expectativa de votos com baixa presença de campo.',
    cor: '#D79A19',
    corSuave: '#FFF8E8',
    corTexto: '#9A6B0A',
    corTint: '#FFF8E8',
  },
  {
    id: 'pesquisa',
    label: 'MISSÃO PESQUISA',
    titulo: 'Para onde olhar',
    tagline: 'Pesquisa',
    descricao: 'Pesquisa abaixo do esperado considerando o potencial.',
    cor: '#3269C8',
    corSuave: '#F1F6FF',
    corTexto: '#1E4A9A',
    corTint: '#F1F6FF',
  },
  {
    id: 'digital',
    label: 'MISSÃO DIGITAL',
    titulo: 'Para onde apontar',
    tagline: 'Digital',
    descricao: 'Expectativa de votos desproporcional à presença digital.',
    cor: '#29935F',
    corSuave: '#EFFAF4',
    corTexto: '#1B6B45',
    corTint: '#EFFAF4',
  },
  {
    id: 'obras',
    label: 'MISSÃO OBRAS',
    titulo: 'Onde acelerar',
    tagline: 'Obras',
    descricao: 'Obras e entregas com baixa comunicação e aproveitamento.',
    cor: '#7851B8',
    corSuave: '#F7F2FC',
    corTexto: '#5A3A91',
    corTint: '#F7F2FC',
  },
]

export const IPT_MISSAO_FILTRO_OPCOES: { id: IptMissaoFiltro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'campo', label: 'Onde ir' },
  { id: 'pesquisa', label: 'Para onde olhar' },
  { id: 'digital', label: 'Para onde apontar' },
  { id: 'obras', label: 'Onde acelerar' },
]

const CONTAGE_HISTORICO_KEY = 'ipt-missoes-contagem-snapshot-v1'

/** Mesmo limiar de “cidade pesada” de `classificarSinalVisitas`. */
export function iptAltaExpectativa(m: IptMunicipio): boolean {
  return m.expectativaVotos >= 1200 || m.pesoExpectativaPct >= 2
}

function temExpectativa(m: IptMunicipio): boolean {
  return m.prioridade !== 'sem_expectativa' && m.expectativaVotos > 0
}

export function municipioNaMissaoCampo(m: IptMunicipio): boolean {
  if (!temExpectativa(m)) return false
  if (!iptAltaExpectativa(m) && m.prioridade !== 'critico' && m.prioridade !== 'atencao') {
    return false
  }
  return (
    m.sinais.visitas === 'mal' ||
    m.sinais.visitas === 'neutro' ||
    m.evolucao.visitas === 'diminuiu'
  )
}

export function municipioNaMissaoPesquisa(m: IptMunicipio): boolean {
  if (!temExpectativa(m)) return false
  if (m.sinais.pesquisa === 'mal' || m.sinais.pesquisa === 'neutro') return true
  if (m.evolucao.pesquisa === 'diminuiu') return true
  if (m.sinais.pesquisa === 'sem_dado' && iptAltaExpectativa(m)) return true
  return false
}

export function municipioNaMissaoDigital(m: IptMunicipio): boolean {
  if (!temExpectativa(m)) return false
  if (!iptAltaExpectativa(m) && m.pesoExpectativaPct < 1) return false
  return m.sinais.digital === 'sem_dado' || m.evolucao.digitalSeguidores === 'diminuiu'
}

export function municipioNaMissaoObras(m: IptMunicipio): boolean {
  if (!temExpectativa(m)) return false
  const temObra = m.detalhes.obrasQuantidade > 0 || m.sinais.obras === 'mal'
  if (!temObra) return false
  const baixoAproveitamento =
    m.sinais.visitas === 'mal' ||
    m.sinais.visitas === 'neutro' ||
    m.sinais.pesquisa === 'mal' ||
    m.sinais.pesquisa === 'neutro' ||
    m.sinais.digital === 'sem_dado' ||
    m.sinais.obras === 'mal' ||
    m.evolucao.visitas === 'diminuiu'
  return baixoAproveitamento
}

export function municipioNaMissao(m: IptMunicipio, missao: IptMissaoId): boolean {
  if (missao === 'campo') return municipioNaMissaoCampo(m)
  if (missao === 'pesquisa') return municipioNaMissaoPesquisa(m)
  if (missao === 'digital') return municipioNaMissaoDigital(m)
  return municipioNaMissaoObras(m)
}

/** Ordem de impacto quando a cidade entra em várias missões. */
const MISSAO_PRIORIDADE: IptMissaoId[] = ['campo', 'pesquisa', 'obras', 'digital']

export function missoesDoMunicipio(m: IptMunicipio): IptMissaoId[] {
  return MISSAO_PRIORIDADE.filter((id) => municipioNaMissao(m, id))
}

export function missaoPrincipal(m: IptMunicipio): IptMissaoId | null {
  return missoesDoMunicipio(m)[0] ?? null
}

export function iptMissaoConfig(id: IptMissaoId): IptMissaoConfig {
  return IPT_MISSOES.find((m) => m.id === id) ?? IPT_MISSOES[0]
}

export function filtrarMunicipiosPorMissao(
  municipios: IptMunicipio[],
  filtro: IptMissaoFiltro
): IptMunicipio[] {
  if (filtro === 'todas') {
    return municipios.filter((m) => missoesDoMunicipio(m).length > 0)
  }
  return municipios.filter((m) => municipioNaMissao(m, filtro))
}

/** Score 0–100 (interno) para ordenação e faixa de prioridade. */
export function relevanciaInternaMissao(m: IptMunicipio, missao: IptMissaoFiltro): number {
  const importancia = Math.min(55, m.pesoExpectativaPct * 12 + Math.min(m.expectativaVotos / 800, 20))
  let incompatibilidade = 20
  let recencia = 10
  let qualidade = 10

  const alvo: IptMissaoId | null =
    missao === 'todas' ? missaoPrincipal(m) : missao

  if (alvo === 'campo') {
    incompatibilidade =
      m.sinais.visitas === 'mal' ? 35 : m.sinais.visitas === 'neutro' ? 28 : 18
    recencia = m.detalhes.visitasNoPeriodo === 0 ? 20 : Math.max(4, 16 - m.detalhes.visitasNoPeriodo * 3)
    qualidade = m.detalhes.visitasHistorico > 0 || m.expectativaVotos > 0 ? 12 : 4
  } else if (alvo === 'pesquisa') {
    incompatibilidade =
      m.sinais.pesquisa === 'mal' ? 35 : m.sinais.pesquisa === 'neutro' ? 28 : 22
    if (m.evolucao.pesquisa === 'diminuiu') incompatibilidade += 8
    const delta = m.detalhes.pesquisaDeltaPp ?? 0
    if (delta < 0) incompatibilidade += Math.min(10, Math.abs(delta) * 2)
    qualidade = m.sinais.pesquisa !== 'sem_dado' ? 12 : 5
  } else if (alvo === 'digital') {
    incompatibilidade = m.sinais.digital === 'sem_dado' ? 32 : 24
    if (m.evolucao.digitalSeguidores === 'diminuiu') incompatibilidade += 8
    qualidade = m.detalhes.digitalSeguidores != null ? 12 : 5
  } else if (alvo === 'obras') {
    incompatibilidade = m.sinais.obras === 'mal' ? 30 : 24
    incompatibilidade += Math.min(12, m.detalhes.obrasValorTotal / 2_000_000)
    qualidade = m.detalhes.obrasQuantidade > 0 ? 12 : 5
  }

  return Math.max(0, Math.min(100, Math.round(importancia + incompatibilidade + recencia + qualidade)))
}

export function prioridadeImpactoMissao(
  m: IptMunicipio,
  missao: IptMissaoFiltro = 'todas'
): IptMissaoPrioridadeImpacto {
  const score = relevanciaInternaMissao(m, missao)
  if (score >= 75) return 'alta'
  if (score >= 50) return 'media'
  return 'baixa'
}

export function ordenarMunicipiosMissao(
  municipios: IptMunicipio[],
  filtro: IptMissaoFiltro
): IptMunicipio[] {
  return [...municipios].sort((a, b) => {
    const sa = relevanciaInternaMissao(a, filtro)
    const sb = relevanciaInternaMissao(b, filtro)
    if (sb !== sa) return sb - sa
    return a.municipio.localeCompare(b.municipio, 'pt-BR')
  })
}

export function contagemPorMissao(municipios: IptMunicipio[]): Record<IptMissaoId, number> {
  return {
    campo: municipios.filter(municipioNaMissaoCampo).length,
    pesquisa: municipios.filter(municipioNaMissaoPesquisa).length,
    digital: municipios.filter(municipioNaMissaoDigital).length,
    obras: municipios.filter(municipioNaMissaoObras).length,
  }
}

export type IptMissaoVariacao = {
  delta: number | null
  rotulo: string
}

export type IptContagemHistorico = {
  at: string
  counts: Record<IptMissaoId, number>
}

export function lerContagemHistorico(): IptContagemHistorico | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONTAGE_HISTORICO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as IptContagemHistorico
    if (!parsed?.counts || !parsed.at) return null
    return parsed
  } catch {
    return null
  }
}

export function salvarContagemHistorico(counts: Record<IptMissaoId, number>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: IptContagemHistorico = {
      at: new Date().toISOString(),
      counts,
    }
    window.localStorage.setItem(CONTAGE_HISTORICO_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

export function variacaoMissao(
  atual: number,
  anterior: number | null | undefined
): IptMissaoVariacao {
  if (anterior == null || !Number.isFinite(anterior)) {
    return { delta: null, rotulo: 'Sem base de comparação ainda' }
  }
  const delta = atual - anterior
  if (delta === 0) return { delta: 0, rotulo: 'Sem alteração' }
  if (delta > 0) {
    return {
      delta,
      rotulo: `↑ ${delta} município${delta === 1 ? '' : 's'} desde a última atualização`,
    }
  }
  const n = Math.abs(delta)
  return {
    delta,
    rotulo: `↓ ${n} município${n === 1 ? '' : 's'} desde a última atualização`,
  }
}

export type IptResumoCampanha = {
  expectativaTotal: number
  metaExpectativa: number
  expectativaVsMetaPct: number | null
  municipiosCobertos: number
  municipiosTotal: number
  municipiosCobertosPct: number
  visitasRealizadas: number
  visitasPeriodoAnterior: number
  visitasVariacaoPct: number | null
  obrasValorTotal: number
  municipiosComObras: number
  obrasCoberturaPct: number
  seguidoresDigitais: number
  municipiosComDigital: number
  digitalCoberturaPct: number
  focoPrincipal: string[]
  /** Missão que originou o recorte (quando filtrado). */
  missao: IptMissaoFiltro
  /** Municípios do recorte com expectativa relevante. */
  municipiosExpectativaRelevante: number
  /** Campo: cobertura presencial suficiente no grupo. */
  municipiosCampoSuficiente: number
  municipiosCampoSuficientePct: number
  /** Proxy textual do tempo médio desde a última visita no grupo. */
  tempoMedioSemVisita: string
  municipiosComPesquisa: number
  municipiosComPesquisaPct: number
}

/** Meta de expectativa estadual usada no resumo executivo. */
export const IPT_META_EXPECTATIVA_VOTOS = 150_000

function proxyDiasSemVisita(m: IptMunicipio): number | null {
  if (m.detalhes.visitasNoPeriodo > 0) {
    return Math.max(1, Math.round(15 / Math.max(1, m.detalhes.visitasNoPeriodo)))
  }
  if (m.detalhes.visitasPeriodoAnterior > 0) return 45
  if (m.detalhes.visitasHistorico > 0) return 75
  return null
}

/** Cobertura = municípios com ao menos um sinal positivo (visita, obra, pesquisa ou digital). */
export function buildResumoCampanha(
  municipios: IptMunicipio[],
  missao: IptMissaoFiltro = 'todas'
): IptResumoCampanha {
  const noEscopo =
    missao === 'todas' ? municipios : filtrarMunicipiosPorMissao(municipios, missao)

  let expectativaTotal = 0
  let municipiosCobertos = 0
  let visitasRealizadas = 0
  let visitasPeriodoAnterior = 0
  let obrasValorTotal = 0
  let seguidoresDigitais = 0
  let municipiosComObras = 0
  let municipiosComDigital = 0
  let municipiosExpectativaRelevante = 0
  let municipiosCampoSuficiente = 0
  let municipiosComPesquisa = 0
  let somaProxyDias = 0
  let qtdProxyDias = 0

  for (const m of noEscopo) {
    if (m.expectativaVotos > 0) expectativaTotal += m.expectativaVotos
    if (iptAltaExpectativa(m) || m.pesoExpectativaPct >= 1) {
      municipiosExpectativaRelevante += 1
    }
    const coberto =
      m.detalhes.visitasHistorico > 0 ||
      m.detalhes.visitasNoPeriodo > 0 ||
      m.detalhes.obrasQuantidade > 0 ||
      m.sinais.pesquisa !== 'sem_dado' ||
      m.sinais.digital === 'bem'
    if (coberto) municipiosCobertos += 1
    visitasRealizadas += m.detalhes.visitasNoPeriodo
    visitasPeriodoAnterior += m.detalhes.visitasPeriodoAnterior
    obrasValorTotal += m.detalhes.obrasValorTotal > 0 ? m.detalhes.obrasValorTotal : 0
    if (m.detalhes.obrasQuantidade > 0) municipiosComObras += 1
    seguidoresDigitais += m.detalhes.digitalSeguidores ?? 0
    if (m.sinais.digital !== 'sem_dado' || (m.detalhes.digitalSeguidores ?? 0) > 0) {
      municipiosComDigital += 1
    }
    if (coberturaCampoSuficiente(m)) municipiosCampoSuficiente += 1
    if (m.sinais.pesquisa !== 'sem_dado') municipiosComPesquisa += 1
    const proxy = proxyDiasSemVisita(m)
    if (proxy != null) {
      somaProxyDias += proxy
      qtdProxyDias += 1
    }
  }

  const municipiosTotal = Math.max(1, noEscopo.length)
  const expectativaVsMetaPct =
    IPT_META_EXPECTATIVA_VOTOS > 0
      ? Math.round((expectativaTotal / IPT_META_EXPECTATIVA_VOTOS) * 100)
      : null
  const visitasVariacaoPct =
    visitasPeriodoAnterior > 0
      ? Math.round(
          ((visitasRealizadas - visitasPeriodoAnterior) / visitasPeriodoAnterior) * 100
        )
      : null

  const focoPrincipal = ordenarMunicipiosMissao(noEscopo, missao)
    .slice(0, 3)
    .map((m) => m.municipio)

  const mediaDias = qtdProxyDias > 0 ? Math.round(somaProxyDias / qtdProxyDias) : null
  const tempoMedioSemVisita =
    mediaDias == null
      ? '—'
      : mediaDias <= 30
        ? `${mediaDias} dias`
        : mediaDias <= 60
          ? '31–60 dias'
          : '> 60 dias'

  return {
    expectativaTotal,
    metaExpectativa: IPT_META_EXPECTATIVA_VOTOS,
    expectativaVsMetaPct,
    municipiosCobertos,
    municipiosTotal: noEscopo.length,
    municipiosCobertosPct: Math.round((municipiosCobertos / municipiosTotal) * 100),
    visitasRealizadas,
    visitasPeriodoAnterior,
    visitasVariacaoPct,
    obrasValorTotal,
    municipiosComObras,
    obrasCoberturaPct: Math.round((municipiosComObras / municipiosTotal) * 100),
    seguidoresDigitais,
    municipiosComDigital,
    digitalCoberturaPct: Math.round((municipiosComDigital / municipiosTotal) * 100),
    focoPrincipal,
    missao,
    municipiosExpectativaRelevante,
    municipiosCampoSuficiente,
    municipiosCampoSuficientePct: Math.round(
      (municipiosCampoSuficiente / municipiosTotal) * 100
    ),
    tempoMedioSemVisita,
    municipiosComPesquisa,
    municipiosComPesquisaPct: Math.round((municipiosComPesquisa / municipiosTotal) * 100),
  }
}

export function indicadorDaMissao(
  filtro: IptMissaoFiltro
): import('@/lib/ipt').IptIndicador | null {
  if (filtro === 'campo') return 'visitas'
  if (filtro === 'pesquisa') return 'pesquisa'
  if (filtro === 'digital') return 'digital'
  if (filtro === 'obras') return 'obras'
  return null
}

export function rotuloSinalCurto(sinal: IptSinal): string {
  if (sinal === 'bem') return 'Bem'
  if (sinal === 'mal') return 'Crítico'
  if (sinal === 'neutro') return 'Atenção'
  return 'Sem dado'
}

export function estimativaDiasSemVisita(m: IptMunicipio): string {
  if (m.detalhes.visitasNoPeriodo > 0) {
    const dias = Math.max(1, Math.round(15 / Math.max(1, m.detalhes.visitasNoPeriodo)))
    return `${dias} dias`
  }
  if (m.detalhes.visitasPeriodoAnterior > 0) return '31–60 dias'
  if (m.detalhes.visitasHistorico > 0) return '> 60 dias'
  return 'sem visita registrada'
}

/** Relevância curta para colunas da lista. */
export function relevanciaCurta(m: IptMunicipio): string {
  if (iptAltaExpectativa(m) || m.prioridade === 'critico') return 'Alta'
  if (m.prioridade === 'atencao' || m.pesoExpectativaPct >= 1) return 'Média'
  if (temExpectativa(m)) return 'Moderada'
  return '—'
}

/** Cobertura presencial relativa ao potencial da cidade. */
export function coberturaCampoRotulo(m: IptMunicipio): string {
  if (m.detalhes.visitasHistorico === 0 && m.detalhes.visitasNoPeriodo === 0) {
    return 'Insuficiente'
  }
  if (m.sinais.visitas === 'mal') return 'Baixa'
  if (m.sinais.visitas === 'neutro') return 'Baixa'
  if (m.sinais.visitas === 'bem') return 'Suficiente'
  return 'Sem dado'
}

export function coberturaCampoSuficiente(m: IptMunicipio): boolean {
  return coberturaCampoRotulo(m) === 'Suficiente'
}

/** Frase curta: por que o município está na missão. */
export function frasePorQueMissao(m: IptMunicipio, missao: IptMissaoId): string {
  const relevancia = iptAltaExpectativa(m)
    ? 'Alta relevância territorial'
    : temExpectativa(m)
      ? 'Relevância territorial cadastrada'
      : 'Potencial territorial limitado'

  if (missao === 'campo') {
    return `${relevancia} com ${coberturaCampoRotulo(m).toLowerCase()} cobertura presencial.`
  }
  if (missao === 'pesquisa') {
    if (m.sinais.pesquisa === 'sem_dado') {
      return `${relevancia} sem pesquisa suficiente para o potencial.`
    }
    if (m.detalhes.pesquisaPosicaoTop5 != null) {
      return `${relevancia} com pesquisa em ${m.detalhes.pesquisaPosicaoTop5}º lugar, abaixo do potencial.`
    }
    return `${relevancia} com pesquisa abaixo do potencial esperado.`
  }
  if (missao === 'digital') {
    if (m.detalhes.digitalSeguidores == null || m.detalhes.digitalSeguidores <= 0) {
      return `${relevancia} fora dos 45 da base digital.`
    }
    return `${relevancia} com presença digital abaixo do potencial.`
  }
  if (m.detalhes.obrasQuantidade > 0) {
    return `${relevancia} com obras de baixo aproveitamento comunicacional.`
  }
  return `${relevancia} com baixo aproveitamento de entregas no território.`
}

export function textoFocoMissao(missao: IptMissaoFiltro): string {
  if (missao === 'campo') {
    return 'Municípios com maior combinação de relevância territorial e baixa cobertura de campo.'
  }
  if (missao === 'pesquisa') {
    return 'Municípios com maior combinação de relevância territorial e pesquisa abaixo do potencial.'
  }
  if (missao === 'digital') {
    return 'Municípios com maior combinação de relevância territorial e presença digital abaixo do potencial.'
  }
  if (missao === 'obras') {
    return 'Municípios com maior combinação de relevância territorial e baixo aproveitamento de obras.'
  }
  return 'Municípios com maior incompatibilidade e relevância territorial no recorte atual.'
}

export function rotuloEvolucaoVisitas(m: IptMunicipio): string {
  if (m.evolucao.visitas === 'diminuiu') return 'Diminuiu'
  if (m.evolucao.visitas === 'cresceu') return 'Cresceu'
  if (m.evolucao.visitas === 'estavel') return 'Estável'
  return 'Sem dado'
}

export function rotuloEvolucaoPesquisa(m: IptMunicipio): string {
  if (m.evolucao.pesquisa === 'diminuiu') return 'Diminuiu'
  if (m.evolucao.pesquisa === 'cresceu') return 'Cresceu'
  if (m.evolucao.pesquisa === 'estavel') return 'Estável'
  return 'Sem dado'
}

export function rotuloEvolucaoDigital(m: IptMunicipio): string {
  if (m.evolucao.digitalSeguidores === 'diminuiu') return 'Diminuiu'
  if (m.evolucao.digitalSeguidores === 'cresceu') return 'Cresceu'
  if (m.evolucao.digitalSeguidores === 'estavel') return 'Estável'
  return 'Sem dado'
}

/** Evidência principal da linha da lista (README §16). */
export function statusMissaoLinha(m: IptMunicipio, missao: IptMissaoFiltro): string {
  const alvo: IptMissaoId | null =
    missao === 'todas' ? missaoPrincipal(m) : missao

  if (alvo === 'campo') {
    return `Última visita: ${estimativaDiasSemVisita(m)}`
  }
  if (alvo === 'pesquisa') {
    if (m.detalhes.pesquisaPosicaoTop5 != null && m.detalhes.pesquisaPosicaoTop5 > 5) {
      return 'Fora do Top 5'
    }
    if (m.detalhes.pesquisaPosicaoTop5 == null) return 'Fora do Top 5'
    if (m.evolucao.pesquisa === 'diminuiu') return 'Intenção em queda'
    return `${m.detalhes.pesquisaPosicaoTop5}º na pesquisa`
  }
  if (alvo === 'digital') {
    const seg = m.detalhes.digitalSeguidores
    if (seg == null || seg <= 0) return 'Fora dos 45 da base'
    return `${seg.toLocaleString('pt-BR')} seguidores`
  }
  if (alvo === 'obras') {
    if (m.detalhes.obrasQuantidade > 0) {
      return `${formatObrasValorAbreviado(m.detalhes.obrasValorTotal).replace(/ obras$/, '')} em obras com baixa repercussão`
    }
    return 'Obras com baixo aproveitamento'
  }
  return 'Incompatibilidade territorial'
}

/** Explicação auditável (README §21). */
export function razoesMissao(m: IptMunicipio, missao: IptMissaoId): string[] {
  const reasons: string[] = []
  if (iptAltaExpectativa(m)) {
    reasons.push('possui alta relevância territorial')
  } else if (temExpectativa(m)) {
    reasons.push('possui relevância territorial cadastrada')
  }

  if (missao === 'campo') {
    reasons.push(`está há ${estimativaDiasSemVisita(m)} sem visita proporcional`)
    if (m.sinais.visitas === 'mal' || m.sinais.visitas === 'neutro') {
      reasons.push('sua cobertura de campo está abaixo do parâmetro do grupo')
    }
    if (m.evolucao.visitas === 'diminuiu') {
      reasons.push('apresenta queda recente na presença de campo')
    }
  }

  if (missao === 'pesquisa') {
    if (m.detalhes.pesquisaPosicaoTop5 == null || m.detalhes.pesquisaPosicaoTop5 > 5) {
      reasons.push('está fora do Top 5 nas pesquisas disponíveis')
    } else {
      reasons.push(`ocupa a ${m.detalhes.pesquisaPosicaoTop5}ª posição na pesquisa, abaixo do potencial`)
    }
    if (m.evolucao.pesquisa === 'diminuiu') {
      reasons.push('mostra tendência de queda na intenção de votos')
    }
    if (m.sinais.pesquisa === 'sem_dado') {
      reasons.push('não há pesquisa suficiente para o potencial eleitoral da cidade')
    }
  }

  if (missao === 'digital') {
    if (m.sinais.digital === 'sem_dado') {
      reasons.push('a presença digital local está aquém da importância eleitoral')
    }
    if (m.evolucao.digitalSeguidores === 'diminuiu') {
      reasons.push('há retração recente na tração digital do município')
    }
    if (m.detalhes.digitalSeguidoresPct != null) {
      reasons.push(
        `seguidores locais representam ${m.detalhes.digitalSeguidoresPct.toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })}% do conjunto observado`
      )
    }
  }

  if (missao === 'obras') {
    if (m.detalhes.obrasQuantidade > 0) {
      reasons.push(
        `concentra ${formatObrasValorAbreviado(m.detalhes.obrasValorTotal)} com aproveitamento territorial/comunicacional ainda limitado`
      )
    } else {
      reasons.push('há indício de obras/entregas com baixo aproveitamento no território')
    }
    if (m.sinais.visitas === 'mal' || m.sinais.pesquisa === 'mal') {
      reasons.push('campo e/ou pesquisa ainda não refletem o ativo do mandato')
    }
  }

  return reasons.length > 0 ? reasons : ['entrou no grupo pelos critérios atuais de incompatibilidade']
}

export function rotuloRelevanciaTerritorial(m: IptMunicipio): string {
  if (iptAltaExpectativa(m) || m.prioridade === 'critico') return 'Alta relevância territorial'
  if (m.prioridade === 'atencao' || m.pesoExpectativaPct >= 1) return 'Relevância territorial média'
  if (temExpectativa(m)) return 'Relevância territorial moderada'
  return 'Sem expectativa cadastrada'
}

export function diagnosticoLabel(p: IptPrioridade): string {
  return iptPrioridadeLabel(p)
}
