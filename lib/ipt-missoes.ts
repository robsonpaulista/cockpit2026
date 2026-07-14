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
    descricao: 'Municípios pedem presença de campo agora. Potencial alto com cobertura insuficiente.',
    cor: '#ff9800',
    corSuave: '#fff4e5',
    corTexto: '#e28000',
    corTint: '#fff4e5',
  },
  {
    id: 'pesquisa',
    label: 'MISSÃO PESQUISA',
    titulo: 'Para onde olhar',
    tagline: 'Pesquisa',
    descricao: 'Desempenho em pesquisa abaixo do potencial esperado. Há hipótese a checar.',
    cor: '#e28000',
    corSuave: '#fff1e3',
    corTexto: '#e28000',
    corTint: '#fff1e3',
  },
  {
    id: 'digital',
    label: 'MISSÃO DIGITAL',
    titulo: 'Para onde apontar',
    tagline: 'Digital',
    descricao: 'Oportunidade desproporcional à presença digital. É onde a campanha deixa cobertura na mesa.',
    cor: '#8c8c8c',
    corSuave: '#f0f0f0',
    corTexto: '#666666',
    corTint: '#ececec',
  },
  {
    id: 'obras',
    label: 'MISSÃO OBRAS',
    titulo: 'Onde acelerar',
    tagline: 'Obras',
    descricao: 'Entregas e obras ainda não se converteram em percepção no território.',
    cor: '#666666',
    corSuave: '#ebebeb',
    corTexto: '#666666',
    corTint: '#e4e4e4',
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
  if (missao === 'campo') {
    return `${m.municipio} combina potencial eleitoral com ausência recente de presença territorial.`
  }
  if (missao === 'pesquisa') {
    if (m.detalhes.pesquisaPosicaoTop5 != null) {
      return `${m.municipio} está em ${m.detalhes.pesquisaPosicaoTop5}º na pesquisa, abaixo do potencial esperado para o município.`
    }
    return `${m.municipio} ainda não tem pesquisa alinhada ao potencial eleitoral da cidade.`
  }
  if (missao === 'digital') {
    return `${m.municipio} concentra oportunidade territorial com presença digital abaixo do esperado.`
  }
  return `${m.municipio} concentra entregas e obras com aproveitamento ainda limitado no território.`
}

/** Resumo diagnóstico curto no cabeçalho do município. */
export function resumoDiagnosticoMissao(m: IptMunicipio, missao: IptMissaoId): string {
  const relev = rotuloRelevanciaTerritorial(m)
  if (missao === 'campo') {
    return `${relev}, ${estimativaDiasSemVisita(m).toLowerCase()} e cobertura de campo ${coberturaCampoRotulo(m).toLowerCase()}.`
  }
  if (missao === 'pesquisa') {
    if (m.detalhes.pesquisaPosicaoTop5 != null) {
      return `${relev}, ${m.detalhes.pesquisaPosicaoTop5}º na pesquisa e fora do potencial esperado.`
    }
    return `${relev}, pesquisa ainda não alinhada ao potencial territorial.`
  }
  if (missao === 'digital') {
    return `${relev}, presença digital abaixo da oportunidade territorial.`
  }
  return `${relev}, entregas presentes com aproveitamento ainda limitado.`
}

/**
 * Rótulo de seguidores: valor da base ou "< X seguidores" quando fora dela.
 * `compacto` omite a palavra "seguidores" quando o município está na base.
 */
export function rotuloSeguidoresDigital(
  m: IptMunicipio,
  opts?: { compacto?: boolean }
): string {
  const seg = m.detalhes.digitalSeguidores
  if (seg != null && seg > 0) {
    const n = seg.toLocaleString('pt-BR')
    return opts?.compacto ? n : `${n} seguidores`
  }
  const minBase = m.detalhes.digitalSeguidoresMinBase
  if (minBase != null && minBase > 0) {
    return `< ${minBase.toLocaleString('pt-BR')} seguidores`
  }
  return 'Sem dado na base'
}

/**
 * Rótulo de engajamento (contas engajadas): valor da base ou "< X" quando fora.
 * `compacto` omite a palavra "engajadas" quando o município está na base.
 */
export function rotuloEngajamentoDigital(
  m: IptMunicipio,
  opts?: { compacto?: boolean }
): string {
  const eng = m.detalhes.digitalContasEngajadas
  if (eng != null && eng > 0) {
    const n = eng.toLocaleString('pt-BR')
    return opts?.compacto ? n : `${n} engajadas`
  }
  const minBase = m.detalhes.digitalContasEngajadasMinBase
  if (minBase != null && minBase > 0) {
    return `< ${minBase.toLocaleString('pt-BR')} engajadas`
  }
  return 'Sem dado na base'
}

export function chipsEvidenciaMissao(m: IptMunicipio, missao: IptMissaoId): string[] {
  const chips: string[] = []
  if (iptAltaExpectativa(m)) chips.push('Expectativa relevante')
  if (missao === 'campo') {
    chips.push(`Última visita: ${estimativaDiasSemVisita(m)}`)
    chips.push(`Cobertura de campo ${coberturaCampoRotulo(m).toLowerCase()}`)
    if (m.detalhes.visitasNoPeriodo === 0) chips.push('Janela de presença enfraquecida')
  } else if (missao === 'pesquisa') {
    if (m.detalhes.pesquisaPosicaoTop5 != null) {
      chips.push(`${m.detalhes.pesquisaPosicaoTop5}º na pesquisa`)
    } else {
      chips.push('Fora do Top 5')
    }
    if (m.evolucao.pesquisa === 'diminuiu') chips.push('Intenção em queda')
  } else if (missao === 'digital') {
    chips.push(rotuloSeguidoresDigital(m))
    chips.push('Cobertura digital abaixo do potencial')
  } else {
    if (m.detalhes.obrasQuantidade > 0) {
      chips.push(`${m.detalhes.obrasQuantidade} obra${m.detalhes.obrasQuantidade === 1 ? '' : 's'}`)
    } else {
      chips.push('Sem destinação cadastrada')
    }
    chips.push('Baixo aproveitamento comunicacional')
  }
  return chips.slice(0, 4)
}

export function textoFocoMissao(missao: IptMissaoFiltro): string {
  if (missao === 'campo') {
    return 'Maior incompatibilidade: relevância territorial alta + baixa cobertura de campo.'
  }
  if (missao === 'pesquisa') {
    return 'Maior incompatibilidade: relevância territorial alta + pesquisa abaixo do potencial.'
  }
  if (missao === 'digital') {
    return 'Maior incompatibilidade: relevância territorial alta + presença digital insuficiente.'
  }
  if (missao === 'obras') {
    return 'Maior incompatibilidade: entregas presentes + percepção ainda limitada no território.'
  }
  return 'Maior incompatibilidade: relevância territorial alta + baixa cobertura operacional.'
}

export function subtituloListaMissao(missao: IptMissaoFiltro): string {
  if (missao === 'campo') return 'Municípios com maior risco de subaproveitamento em campo'
  if (missao === 'pesquisa') return 'Municípios em que a pesquisa ainda não acompanha o potencial'
  if (missao === 'digital') return 'Municípios com oportunidade mal aproveitada no digital'
  if (missao === 'obras') return 'Municípios em que entregas pedem valorização e aproveitamento'
  return 'Municípios com maior prioridade de impacto no recorte atual'
}

export function microcopyMapaMissao(missao: IptMissaoFiltro): string {
  if (missao === 'campo') return 'Onde estamos deixando presença na mesa'
  if (missao === 'pesquisa') return 'Onde a campanha precisa olhar com mais atenção'
  if (missao === 'digital') return 'Onde existe oportunidade digital mal aproveitada'
  if (missao === 'obras') return 'Onde entregas pedem valorização no território'
  return 'Visão geral dos municípios da campanha'
}

export type IptMissaoCardEnrichment = {
  tensao: string
  epicentros: string
  mudanca: string
  descricaoAtiva: string
}

export function enrichMissaoCard(
  missao: IptMissaoId,
  municipios: IptMunicipio[],
  contagem: number,
  variacao: IptMissaoVariacao
): IptMissaoCardEnrichment {
  const doGrupo = ordenarMunicipiosMissao(
    filtrarMunicipiosPorMissao(municipios, missao),
    missao
  )
  const epicentros = doGrupo
    .slice(0, 3)
    .map((m) => m.municipio)
    .join(', ')
  const relevantes = doGrupo.filter((m) => iptAltaExpectativa(m)).length
  const cfg = iptMissaoConfig(missao)

  const tensao =
    missao === 'campo'
      ? `${relevantes} com expectativa relevante`
      : missao === 'pesquisa'
        ? `${doGrupo.filter((m) => m.sinais.pesquisa === 'mal' || m.sinais.pesquisa === 'neutro').length} abaixo do potencial`
        : missao === 'digital'
          ? `${doGrupo.filter((m) => m.sinais.digital === 'sem_dado').length} sem cobertura na base`
          : `${doGrupo.filter((m) => m.detalhes.obrasQuantidade > 0).length} com entrega em risco`

  const descricaoAtiva =
    contagem === 0
      ? 'Nenhum município apresenta essa incompatibilidade no recorte atual.'
      : missao === 'campo'
        ? 'pedem presença de campo agora. Potencial alto com cobertura insuficiente.'
        : missao === 'pesquisa'
          ? 'pedem olhar analítico. A pesquisa ainda não acompanha o potencial.'
          : missao === 'digital'
            ? 'pedem apontamento digital. Há oportunidade mal aproveitada.'
            : 'pedem aceleração de percepção sobre entregas.'

  return {
    tensao: `Tensão atual: ${tensao}`,
    epicentros: epicentros
      ? `Epicentros hoje: ${epicentros}`
      : 'Epicentros hoje: sem municípios no grupo',
    mudanca: `Mudança recente: ${variacao.rotulo}`,
    descricaoAtiva: descricaoAtiva || cfg.descricao,
  }
}

export function buildLeituraExecutivaHoje(
  municipios: IptMunicipio[],
  missao: IptMissaoFiltro = 'campo'
): string {
  const alvo: IptMissaoId = missao === 'todas' ? 'campo' : missao
  const doGrupo = ordenarMunicipiosMissao(
    filtrarMunicipiosPorMissao(municipios, alvo),
    alvo
  )
  const relevantes = doGrupo.filter((m) => iptAltaExpectativa(m)).length
  const foco = doGrupo
    .slice(0, 3)
    .map((m) => m.municipio)
    .join(', ')
  const titulo = iptMissaoConfig(alvo).titulo

  if (doGrupo.length === 0) {
    return `Nenhuma tensão crítica na missão ${titulo} no recorte atual.`
  }

  if (alvo === 'campo') {
    return `${relevantes || doGrupo.length} municípios com potencial relevante e baixa presença de campo. Priorize ${foco || 'os epicentros da missão'}.`
  }
  if (alvo === 'pesquisa') {
    return `${doGrupo.length} municípios em ${titulo}. A pesquisa ainda não acompanha o potencial — priorize ${foco}.`
  }
  if (alvo === 'digital') {
    return `${doGrupo.length} municípios em ${titulo}. Há oportunidade digital mal aproveitada — priorize ${foco}.`
  }
  return `${doGrupo.length} municípios em ${titulo}. Entregas pedem valorização — priorize ${foco}.`
}

export function textoAcaoRecomendada(
  missao: IptMissaoFiltro,
  focoPrincipal: string[]
): string {
  const cidades = focoPrincipal.slice(0, 3).join(', ')
  if (!cidades) return 'Sem municípios prioritários no recorte atual.'
  if (missao === 'campo' || missao === 'todas') {
    return `Abrir agenda regional em ${cidades}. Ativar líderes locais e roteiro de presença.`
  }
  if (missao === 'pesquisa') {
    return `Aprofundar leitura de pesquisa em ${cidades}. Checar hipótese e validar tendência local.`
  }
  if (missao === 'digital') {
    return `Encaminhar frente digital para ${cidades}. Priorizar cobertura e mobilização local.`
  }
  return `Acelerar valorização de entregas em ${cidades}. Conectar obras à presença no território.`
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
    return rotuloSeguidoresDigital(m)
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
