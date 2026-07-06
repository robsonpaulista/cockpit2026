import municipiosPiaui from '@/lib/municipios-piaui.json'
import { calcPesoExpectativaPct } from '@/lib/territorio-expectativa-visitas-cobertura'

/** Prioridade para tomada de decisão — sem score numérico no mapa. */
export type IptPrioridade = 'critico' | 'atencao' | 'estavel' | 'forte' | 'sem_expectativa'

export type IptSinal = 'bem' | 'mal' | 'neutro' | 'sem_dado'

export type IptPesquisaTopItem = {
  nome: string
  mediaPct: number
}

export type IptPesquisaBase = 'estimulada' | 'espontanea'

export type IptDetalhes = {
  visitasUltimos15Dias: number
  /** Total acumulado de visitas (planilha Território). */
  visitasHistorico: number
  obrasQuantidade: number
  obrasValorTotal: number
  pesquisaPosicaoTop5: number | null
  pesquisaTop5: IptPesquisaTopItem[]
  /** Estimulada na cidade, ou espontânea quando não houver estimulada cadastrada. */
  pesquisaBase: IptPesquisaBase | null
}

export type IptMunicipio = {
  municipio: string
  prioridade: IptPrioridade
  /** Votos esperados 2026 (planilha Território). */
  expectativaVotos: number
  /** Peso da cidade na expectativa total (0–100). Define relevância estratégica. */
  pesoExpectativaPct: number
  sinais: {
    visitas: IptSinal
    obras: IptSinal
    pesquisa: IptSinal
  }
  /** Sinais calculados antes de override manual (quando houver). */
  sinaisOriginais?: {
    visitas: IptSinal
    obras: IptSinal
    pesquisa: IptSinal
  }
  /** Indicadores com avaliação ajustada por insight de campo. */
  overridesAtivos?: Partial<
    Record<IptIndicador, { sinal: IptSinal }>
  >
  detalhes: IptDetalhes
  lat: number
  lng: number
}

export type IptResumo = {
  municipiosMonitorados: number
  criticos: number
  atencao: number
  estaveis: number
  fortes: number
  semExpectativa: number
}

export type IptMunicipioInput = {
  municipio: string
  expectativaVotos: number
  eleitorado: number
  liderancas: number
  visitas: number
  visitasUltimos15Dias: number
  obrasCount: number
  obrasValorTotal: number
  intencaoPesquisa?: number | null
  /** Posição do candidato foco no top 5 local (1–5), ou null. */
  pesquisaPosicaoTop5: number | null
  pesquisaTop5: IptPesquisaTopItem[]
  pesquisaBase: IptPesquisaBase | null
}

export function normalizeIptMunicipio(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Sinal de visitas alinhado ao popup: recorte dos últimos 15 dias. Zero visitas = mal (nunca sem dado). */
export function classificarSinalVisitas(
  expectativa: number,
  visitasUltimos15Dias: number,
  pesoExpectativaPct: number
): IptSinal {
  if (visitasUltimos15Dias <= 0) return 'mal'
  if (expectativa >= 1200 || pesoExpectativaPct >= 2) {
    return visitasUltimos15Dias >= 2 ? 'bem' : 'neutro'
  }
  return 'bem'
}

/** Zero obras = mal (nunca neutro), inclusive sem expectativa cadastrada. */
export function classificarSinalObras(obrasCount: number): IptSinal {
  return obrasCount > 0 ? 'bem' : 'mal'
}

/**
 * Classifica pesquisa pela posição no ranking local.
 * 1º–3º = bem · 4º–5º = neutro · fora do top ou ausente = mal · sem pesquisa = sem_dado.
 */
export function classificarSinalPesquisa(
  posicaoTop5: number | null,
  temPesquisaNoMunicipio: boolean,
  intencao: number | null | undefined
): IptSinal {
  if (posicaoTop5 != null) {
    if (posicaoTop5 <= 3) return 'bem'
    if (posicaoTop5 <= 5) return 'neutro'
    return 'mal'
  }
  if (temPesquisaNoMunicipio) return 'mal'
  if (intencao != null && intencao > 0) return 'mal'
  return 'sem_dado'
}

export function classificarPrioridade(
  pesoExpectativaPct: number,
  sinais: { visitas: IptSinal; obras: IptSinal; pesquisa: IptSinal },
  expectativa: number
): IptPrioridade {
  const avaliaveis = [sinais.visitas, sinais.obras, sinais.pesquisa].filter((s) => s !== 'sem_dado')
  const mal = avaliaveis.filter((s) => s === 'mal').length
  const bem = avaliaveis.filter((s) => s === 'bem').length
  const pesoAlto = pesoExpectativaPct >= 2 || expectativa >= 1200
  const pesoMedio = pesoExpectativaPct >= 0.8 || expectativa >= 400

  if (pesoAlto && mal >= 2) return 'critico'
  if (pesoAlto && mal >= 1) return 'atencao'
  if (pesoMedio && mal >= 2) return 'atencao'
  if (mal >= 3) return 'critico'
  if (mal >= 2) return 'atencao'
  if (bem >= 2 && mal === 0) return 'forte'
  if (bem >= 1 && mal === 0) return 'estavel'
  if (mal === 1) return 'estavel'
  return pesoMedio ? 'atencao' : 'estavel'
}

/** Resumo numérico para tooltip permanente — ex.: «0 visitas · R$ 100K obras». */
export function formatObrasValorAbreviado(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return 'R$ 0 obras'

  const abrev = (n: number): string => {
    const rounded = Math.round(n * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, '')
  }

  if (valor >= 1_000_000_000) return `R$ ${abrev(valor / 1_000_000_000)}B obras`
  if (valor >= 1_000_000) return `R$ ${abrev(valor / 1_000_000)}M obras`
  if (valor >= 1_000) return `R$ ${abrev(valor / 1_000)}K obras`
  return `R$ ${Math.round(valor)} obras`
}

export function iptLabelTipoPesquisa(base: IptPesquisaBase | null): string {
  return base === 'espontanea' ? 'espontânea' : 'estimulada'
}

function partesVisitasObras(detalhes: IptDetalhes): string[] {
  const visitas = detalhes.visitasUltimos15Dias
  return [
    `${visitas} visita${visitas === 1 ? '' : 's'}`,
    formatObrasValorAbreviado(detalhes.obrasValorTotal),
  ]
}

function partePesquisaTooltip(detalhes: IptDetalhes): string | null {
  if (detalhes.pesquisaTop5.length === 0) return null
  const tipo = iptLabelTipoPesquisa(detalhes.pesquisaBase)
  const pos = detalhes.pesquisaPosicaoTop5
  return pos != null ? `${pos}º · ${tipo}` : `fora do top 5 · ${tipo}`
}

/** Resumo do mini card na lente de um indicador. */
export function iptTextoTooltipPorIndicador(m: IptMunicipio, indicador: IptIndicador): string | null {
  if (m.prioridade === 'sem_expectativa') return null
  const { detalhes } = m

  if (indicador === 'visitas') {
    const n = detalhes.visitasUltimos15Dias
    return `${n} visita${n === 1 ? '' : 's'}`
  }
  if (indicador === 'obras') {
    return formatObrasValorAbreviado(detalhes.obrasValorTotal)
  }
  return partePesquisaTooltip(detalhes) ?? 'sem pesquisa'
}

export function iptTextoTooltipSintetico(
  m: IptMunicipio,
  indicador: IptIndicador | null = null
): string | null {
  if (indicador) return iptTextoTooltipPorIndicador(m, indicador)

  if (m.prioridade === 'sem_expectativa') return null

  const { detalhes } = m
  const partes: string[] = []

  if (m.prioridade === 'forte' || m.prioridade === 'estavel') {
    partes.push(...partesVisitasObras(detalhes))
    const pesquisa = partePesquisaTooltip(detalhes)
    if (pesquisa) partes.push(pesquisa)
    return partes.join(' · ')
  }

  if (m.prioridade === 'critico' || m.prioridade === 'atencao') {
    if (m.sinais.visitas === 'mal') {
      const n = detalhes.visitasUltimos15Dias
      partes.push(`${n} visita${n === 1 ? '' : 's'}`)
    }
    if (m.sinais.obras === 'mal') {
      partes.push(formatObrasValorAbreviado(detalhes.obrasValorTotal))
    }
    if (m.sinais.pesquisa === 'mal') {
      const pos = detalhes.pesquisaPosicaoTop5
      partes.push(pos != null ? `${pos}º pesquisa` : 'fora do top 5')
    }
    if (partes.length === 0) return null
    return partes.join(' · ')
  }

  return null
}

/** Máximo de mini cards permanentes por cor/status — evita poluir o mapa. */
export const IPT_LIMITE_TOOLTIPS_AUTOMATICOS = 15

/** Com lente de indicador: até 5 por sinal (bem / neutro / mal / sem dado). */
export const IPT_LIMITE_TOOLTIPS_POR_INDICADOR = 5

/** Todos os status com expectativa; cinza só no clique. */
export function iptElegivelTooltipAutomatico(m: IptMunicipio): boolean {
  return m.prioridade !== 'sem_expectativa'
}

/**
 * Conjunto de municípios (nome normalizado) com tooltip permanente.
 * Visão geral: até 15 por prioridade. Lente de indicador: até 5 por sinal do indicador.
 */
export function buildIptMunicipiosComTooltipAutomatico(
  municipios: IptMunicipio[],
  indicador: IptIndicador | null = null
): Set<string> {
  const result = new Set<string>()

  if (indicador) {
    const porSinal = new Map<IptSinal, IptMunicipio[]>()
    for (const m of municipios) {
      if (m.prioridade === 'sem_expectativa') continue
      const sinal = m.sinais[indicador]
      const lista = porSinal.get(sinal) ?? []
      lista.push(m)
      porSinal.set(sinal, lista)
    }
    for (const lista of porSinal.values()) {
      const ordenados = [...lista].sort((a, b) => {
        if (b.expectativaVotos !== a.expectativaVotos) return b.expectativaVotos - a.expectativaVotos
        return a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
      })
      const limite = Math.min(ordenados.length, IPT_LIMITE_TOOLTIPS_POR_INDICADOR)
      for (let i = 0; i < limite; i++) {
        result.add(normalizeIptMunicipio(ordenados[i].municipio))
      }
    }
    return result
  }

  const porPrioridade = new Map<IptPrioridade, IptMunicipio[]>()

  for (const m of municipios) {
    if (!iptElegivelTooltipAutomatico(m)) continue
    const lista = porPrioridade.get(m.prioridade) ?? []
    lista.push(m)
    porPrioridade.set(m.prioridade, lista)
  }

  for (const lista of porPrioridade.values()) {
    const ordenados = [...lista].sort((a, b) => {
      if (b.expectativaVotos !== a.expectativaVotos) return b.expectativaVotos - a.expectativaVotos
      return a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
    })
    const limite = Math.min(ordenados.length, IPT_LIMITE_TOOLTIPS_AUTOMATICOS)
    for (let i = 0; i < limite; i++) {
      result.add(normalizeIptMunicipio(ordenados[i].municipio))
    }
  }
  return result
}

/** @deprecated Use `buildIptMunicipiosComTooltipAutomatico`. */
export function iptExibirPopupBasico(m: IptMunicipio): boolean {
  return iptElegivelTooltipAutomatico(m)
}

export function calcularIptMunicipios(inputs: IptMunicipioInput[]): IptMunicipio[] {
  const coords = new Map(
    (municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>).map((m) => [
      normalizeIptMunicipio(m.nome),
      m,
    ])
  )

  const totalExpectativa = inputs.reduce(
    (s, i) => s + (i.expectativaVotos > 0 ? i.expectativaVotos : 0),
    0
  )

  return inputs
    .map((input) => {
      const expectativaVotos = Math.max(0, input.expectativaVotos)
      const pesoExpectativaPct = calcPesoExpectativaPct(expectativaVotos, totalExpectativa)

      const sinais = {
        visitas: classificarSinalVisitas(
          expectativaVotos,
          input.visitasUltimos15Dias,
          pesoExpectativaPct
        ),
        obras: classificarSinalObras(input.obrasCount),
        pesquisa: classificarSinalPesquisa(
          input.pesquisaPosicaoTop5,
          input.pesquisaTop5.length > 0,
          input.intencaoPesquisa
        ),
      }

      const prioridade: IptPrioridade =
        input.expectativaVotos <= 0
          ? 'sem_expectativa'
          : classificarPrioridade(pesoExpectativaPct, sinais, expectativaVotos)
      const geo = coords.get(normalizeIptMunicipio(input.municipio))

      return {
        municipio: input.municipio,
        prioridade,
        expectativaVotos,
        pesoExpectativaPct,
        sinais,
        detalhes: {
          visitasUltimos15Dias: input.visitasUltimos15Dias,
          visitasHistorico: Math.max(0, input.visitas),
          obrasQuantidade: input.obrasCount,
          obrasValorTotal: input.obrasValorTotal,
          pesquisaPosicaoTop5: input.pesquisaPosicaoTop5,
          pesquisaTop5: input.pesquisaTop5,
          pesquisaBase: input.pesquisaBase,
        },
        lat: geo?.lat ?? -6.5,
        lng: geo?.lng ?? -43,
      }
    })
    .sort((a, b) => prioridadeOrdem(a.prioridade) - prioridadeOrdem(b.prioridade))
}

function prioridadeOrdem(p: IptPrioridade): number {
  if (p === 'critico') return 0
  if (p === 'atencao') return 1
  if (p === 'estavel') return 2
  if (p === 'forte') return 3
  return 4
}

export function calcularIptResumo(municipios: IptMunicipio[]): IptResumo {
  return {
    municipiosMonitorados: municipios.length,
    criticos: municipios.filter((m) => m.prioridade === 'critico').length,
    atencao: municipios.filter((m) => m.prioridade === 'atencao').length,
    estaveis: municipios.filter((m) => m.prioridade === 'estavel').length,
    fortes: municipios.filter((m) => m.prioridade === 'forte').length,
    semExpectativa: municipios.filter((m) => m.prioridade === 'sem_expectativa').length,
  }
}

export type IptIndicador = 'visitas' | 'obras' | 'pesquisa'

export const IPT_INDICADOR_OPCOES: {
  id: IptIndicador | 'geral'
  label: string
}[] = [
  { id: 'geral', label: 'Visão geral (prioridade)' },
  { id: 'visitas', label: 'Visitas de campo' },
  { id: 'obras', label: 'Obras destinadas' },
  { id: 'pesquisa', label: 'Pesquisa' },
]

export function iptSinalCor(sinal: IptSinal): string {
  if (sinal === 'bem') return '#059669'
  if (sinal === 'mal') return '#dc2626'
  if (sinal === 'neutro') return '#ca8a04'
  return '#64748b'
}

export function iptCorMunicipio(m: IptMunicipio, indicador: IptIndicador | null): string {
  if (!indicador) return iptPrioridadeCor(m.prioridade)
  return iptSinalCor(m.sinais[indicador])
}

export function contagemIptComExpectativa(municipios: IptMunicipio[]): number {
  return municipios.filter((m) => m.prioridade !== 'sem_expectativa').length
}

/** Município com expectativa e dado registrado para o indicador (cobertura da lente). */
export function iptMunicipioComCoberturaIndicador(m: IptMunicipio, indicador: IptIndicador): boolean {
  if (m.prioridade === 'sem_expectativa') return false

  if (indicador === 'visitas') {
    return m.detalhes.visitasUltimos15Dias > 0 || m.detalhes.visitasHistorico > 0
  }
  if (indicador === 'obras') {
    return m.detalhes.obrasQuantidade > 0
  }
  return m.sinais.pesquisa !== 'sem_dado'
}

export function contagemIptPorIndicador(
  municipios: IptMunicipio[],
  indicador: IptIndicador
): number {
  return municipios.filter((m) => iptMunicipioComCoberturaIndicador(m, indicador)).length
}

export function buildContagemIptPorIndicador(municipios: IptMunicipio[]): Record<IptIndicador, number> {
  return {
    visitas: contagemIptPorIndicador(municipios, 'visitas'),
    obras: contagemIptPorIndicador(municipios, 'obras'),
    pesquisa: contagemIptPorIndicador(municipios, 'pesquisa'),
  }
}

export function contagemIptSinalMal(
  municipios: IptMunicipio[],
  indicador: IptIndicador
): number {
  return municipios.filter((m) => m.prioridade !== 'sem_expectativa' && m.sinais[indicador] === 'mal').length
}

export function iptPrioridadeCor(prioridade: IptPrioridade): string {
  switch (prioridade) {
    case 'forte':
      return '#059669'
    case 'estavel':
      return '#ca8a04'
    case 'atencao':
      return '#ea580c'
    case 'critico':
      return '#dc2626'
    case 'sem_expectativa':
      return '#64748b'
  }
}

export function iptPrioridadeLabel(prioridade: IptPrioridade): string {
  switch (prioridade) {
    case 'forte':
      return 'Estamos bem'
    case 'estavel':
      return 'Acompanhar'
    case 'atencao':
      return 'Precisa atenção'
    case 'critico':
      return 'Prioridade crítica'
    case 'sem_expectativa':
      return 'Sem votos'
  }
}

export const IPT_FAIXAS: {
  prioridade: IptPrioridade
  cor: string
  label: string
  descricao: string
}[] = [
  { prioridade: 'forte', cor: '#059669', label: 'Verde', descricao: 'Estamos bem' },
  { prioridade: 'estavel', cor: '#ca8a04', label: 'Amarelo', descricao: 'Acompanhar' },
  { prioridade: 'atencao', cor: '#ea580c', label: 'Laranja', descricao: 'Precisa atenção' },
  { prioridade: 'critico', cor: '#dc2626', label: 'Vermelho', descricao: 'Prioridade crítica' },
  {
    prioridade: 'sem_expectativa',
    cor: '#64748b',
    label: 'Cinza',
    descricao: 'Sem votos',
  },
]

export const IPT_SINAL_LABEL: Record<IptSinal, string> = {
  bem: 'Estamos bem',
  mal: 'Estamos mal',
  neutro: 'Neutro',
  sem_dado: 'Sem dado',
}

export function iptRotuloSinalIndicador(indicador: IptIndicador, sinal: IptSinal): string {
  if (indicador === 'obras' && sinal === 'bem') return 'Temos Obras'
  return IPT_SINAL_LABEL[sinal]
}

export function iptLabelIndicador(indicador: IptIndicador): string {
  return IPT_INDICADOR_OPCOES.find((o) => o.id === indicador)?.label ?? indicador
}

export function iptMarkerSize(pesoExpectativaPct: number, compact: boolean): number {
  if (compact) {
    if (pesoExpectativaPct >= 3) return 14
    if (pesoExpectativaPct >= 1) return 11
    return 9
  }
  if (pesoExpectativaPct >= 3) return 18
  if (pesoExpectativaPct >= 1) return 14
  return 11
}
