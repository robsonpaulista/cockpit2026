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

/** Janela de avaliação de visitas de campo no IPT (dias corridos). */
export const IPT_VISITAS_JANELA_DIAS = 30

/** Cobertura recente de campo: ≥1 visita nesta janela = município coberto. */
export const IPT_VISITAS_COBERTURA_DIAS = 15

export type IptDetalhes = {
  visitasNoPeriodo: number
  /** Visitas nos últimos {@link IPT_VISITAS_COBERTURA_DIAS} dias (cobertura recente). */
  visitasUltimos15Dias: number
  /** Total acumulado de visitas (planilha Território). */
  visitasHistorico: number
  /** Visitas na janela anterior (ex.: dias 31–60). */
  visitasPeriodoAnterior: number
  obrasQuantidade: number
  obrasValorTotal: number
  /** Posts do Instagram classificados com vínculo a obra deste município. */
  obrasDivulgacaoPosts: number
  pesquisaPosicaoTop5: number | null
  pesquisaTop5: IptPesquisaTopItem[]
  /** Estimulada na cidade, ou espontânea quando não houver estimulada cadastrada. */
  pesquisaBase: IptPesquisaBase | null
  /** Média de intenção do candidato (todas as ondas do tipo da base). */
  pesquisaMediaPct: number | null
  /** Intenção na onda mais recente. */
  pesquisaRecentePct: number | null
  /** Intenção na onda anterior (se houver). */
  pesquisaAnteriorPct: number | null
  /** Delta em p.p. (recente − anterior). */
  pesquisaDeltaPp: number | null
  /**
   * Presença digital (Instagram Insights · top cidades).
   * null = cidade fora do top Meta / sem match.
   */
  digitalSeguidores: number | null
  digitalSeguidoresPct: number | null
  digitalContasEngajadas: number | null
  /** Snapshot anterior de seguidores (histórico diário). */
  digitalSeguidoresAnterior: number | null
  digitalContasEngajadasAnterior: number | null
  /**
   * Menor contagem de seguidores entre municípios presentes na base Instagram.
   * Usado para rotular cidades fora da base como "< X seguidores".
   */
  digitalSeguidoresMinBase: number | null
  /**
   * Menor contagem de contas engajadas entre municípios presentes na base.
   * Usado para rotular cidades fora da base como "< X engajadas".
   */
  digitalContasEngajadasMinBase: number | null
}

export type IptEvolucaoMunicipio = {
  pesquisa: import('@/lib/ipt-evolucao').IptEvolucao
  digitalSeguidores: import('@/lib/ipt-evolucao').IptEvolucao
  digitalEngajamento: import('@/lib/ipt-evolucao').IptEvolucao
  visitas: import('@/lib/ipt-evolucao').IptEvolucao
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
    /** Presença digital (Instagram) — não entra na prioridade geral. */
    digital: IptSinal
  }
  /** Sinais calculados antes de override manual (quando houver). */
  sinaisOriginais?: {
    visitas: IptSinal
    obras: IptSinal
    pesquisa: IptSinal
    digital: IptSinal
  }
  /** Indicadores com avaliação ajustada por insight de campo. */
  overridesAtivos?: Partial<
    Record<'visitas' | 'obras' | 'pesquisa', { sinal: IptSinal }>
  >
  detalhes: IptDetalhes
  evolucao: IptEvolucaoMunicipio
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
  visitasNoPeriodo: number
  /** Visitas nos últimos {@link IPT_VISITAS_COBERTURA_DIAS} dias. */
  visitasUltimos15Dias?: number
  obrasCount: number
  obrasValorTotal: number
  /** Posts vinculados a obras deste município (classificação Redes). */
  obrasDivulgacaoPosts?: number
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

/**
 * Sinal de visitas de campo.
 * ≥1 visita nos últimos {@link IPT_VISITAS_COBERTURA_DIAS} dias = coberto (`bem`).
 * Sem visita recente: usa a janela de {@link IPT_VISITAS_JANELA_DIAS} dias.
 */
export function classificarSinalVisitas(
  expectativa: number,
  visitasNoPeriodo: number,
  pesoExpectativaPct: number,
  visitasUltimos15Dias = 0
): IptSinal {
  if (visitasUltimos15Dias >= 1) return 'bem'
  if (visitasNoPeriodo <= 0) return 'mal'
  // Visitas só entre 16–30d: potencial alto ainda pede atenção.
  if (expectativa >= 1200 || pesoExpectativaPct >= 2) {
    return 'neutro'
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

/**
 * Diagnóstico Geral (cores dos cards) — Digital não entra.
 * Peso: Pesquisa → Obras → Visitas.
 * - bem nos 3 → Estamos bem (forte)
 * - bem só nos 2 primeiros (Pesquisa + Obras) → Acompanhar (estavel)
 * - bem em quaisquer outros 2 dos 3 → Precisa atenção (atencao)
 * - bem em 1 ou 0 dos 3 → Prioridade crítica (critico)
 */
export function classificarPrioridade(
  _pesoExpectativaPct: number,
  sinais: { visitas: IptSinal; obras: IptSinal; pesquisa: IptSinal },
  _expectativa: number
): IptPrioridade {
  const pesquisaBem = sinais.pesquisa === 'bem'
  const obrasBem = sinais.obras === 'bem'
  const visitasBem = sinais.visitas === 'bem'
  const bemNosTres = [pesquisaBem, obrasBem, visitasBem].filter(Boolean).length

  if (bemNosTres === 3) return 'forte'
  // Somente os 2 de maior peso (Pesquisa + Obras), sem visita bem.
  if (pesquisaBem && obrasBem && !visitasBem) return 'estavel'
  if (bemNosTres === 2) return 'atencao'
  return 'critico'
}

/** Tem dado no top Instagram → bem; senão sem_dado (não usa bem/mal operacional). */
export function classificarSinalDigital(
  seguidores: number | null | undefined,
  contasEngajadas: number | null | undefined
): IptSinal {
  const seg = seguidores ?? 0
  const eng = contasEngajadas ?? 0
  return seg > 0 || eng > 0 ? 'bem' : 'sem_dado'
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
  const visitas = detalhes.visitasNoPeriodo
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
  if (indicador === 'digital') {
    const seg = m.detalhes.digitalSeguidores
    if (seg == null || seg <= 0) return 'sem dado Instagram'
    const pct = m.detalhes.digitalSeguidoresPct
    const pctTxt =
      pct != null && Number.isFinite(pct)
        ? ` (${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`
        : ''
    return `${seg.toLocaleString('pt-BR')} seguidores${pctTxt}`
  }

  if (m.prioridade === 'sem_expectativa') return null
  const { detalhes } = m

  if (indicador === 'visitas') {
    const n = detalhes.visitasNoPeriodo
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
      const n = detalhes.visitasNoPeriodo
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
      if (!iptMunicipioComCoberturaIndicador(m, indicador)) continue
      const sinal = m.sinais[indicador]
      const lista = porSinal.get(sinal) ?? []
      lista.push(m)
      porSinal.set(sinal, lista)
    }
    for (const lista of porSinal.values()) {
      const ordenados = [...lista].sort((a, b) => {
        if (indicador === 'digital') {
          return (b.detalhes.digitalSeguidores ?? 0) - (a.detalhes.digitalSeguidores ?? 0)
        }
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

      const visitasUltimos15Dias = Math.max(0, input.visitasUltimos15Dias ?? 0)
      const sinais = {
        visitas: classificarSinalVisitas(
          expectativaVotos,
          input.visitasNoPeriodo,
          pesoExpectativaPct,
          visitasUltimos15Dias
        ),
        obras: classificarSinalObras(input.obrasCount),
        pesquisa: classificarSinalPesquisa(
          input.pesquisaPosicaoTop5,
          input.pesquisaTop5.length > 0,
          input.intencaoPesquisa
        ),
        digital: classificarSinalDigital(null, null),
      }

      const prioridade: IptPrioridade =
        input.expectativaVotos <= 0
          ? 'sem_expectativa'
          : classificarPrioridade(
              pesoExpectativaPct,
              {
                visitas: sinais.visitas,
                obras: sinais.obras,
                pesquisa: sinais.pesquisa,
              },
              expectativaVotos
            )
      const geo = coords.get(normalizeIptMunicipio(input.municipio))

      return {
        municipio: input.municipio,
        prioridade,
        expectativaVotos,
        pesoExpectativaPct,
        sinais,
        detalhes: {
          visitasNoPeriodo: input.visitasNoPeriodo,
          visitasUltimos15Dias,
          visitasHistorico: Math.max(0, input.visitas),
          visitasPeriodoAnterior: 0,
          obrasQuantidade: input.obrasCount,
          obrasValorTotal: input.obrasValorTotal,
          obrasDivulgacaoPosts: Math.max(0, input.obrasDivulgacaoPosts ?? 0),
          pesquisaPosicaoTop5: input.pesquisaPosicaoTop5,
          pesquisaTop5: input.pesquisaTop5,
          pesquisaBase: input.pesquisaBase,
          pesquisaMediaPct: null,
          pesquisaRecentePct: null,
          pesquisaAnteriorPct: null,
          pesquisaDeltaPp: null,
          digitalSeguidores: null,
          digitalSeguidoresPct: null,
          digitalContasEngajadas: null,
          digitalSeguidoresAnterior: null,
          digitalContasEngajadasAnterior: null,
          digitalSeguidoresMinBase: null,
          digitalContasEngajadasMinBase: null,
        },
        evolucao: {
          pesquisa: 'sem_dado',
          digitalSeguidores: 'sem_dado',
          digitalEngajamento: 'sem_dado',
          visitas: 'sem_dado',
        } satisfies IptEvolucaoMunicipio,
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

export type IptIndicador = 'visitas' | 'obras' | 'pesquisa' | 'digital'

export const IPT_INDICADOR_OPCOES: {
  id: IptIndicador | 'geral'
  label: string
}[] = [
  { id: 'geral', label: 'Visão geral (prioridade)' },
  { id: 'pesquisa', label: 'Pesquisa' },
  { id: 'obras', label: 'Obras destinadas' },
  { id: 'visitas', label: 'Visitas de campo' },
  { id: 'digital', label: 'Presença digital' },
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

/** Município com cobertura na lente (o que entra no mapa filtrado por status). */
export function iptMunicipioComCoberturaIndicador(m: IptMunicipio, indicador: IptIndicador): boolean {
  // Visitas: todos os 224 municípios (sem expectativa = cinza; sem visita = diminuiu).
  if (indicador === 'visitas') return true

  if (indicador === 'digital') {
    return (
      (m.detalhes.digitalSeguidores != null && m.detalhes.digitalSeguidores > 0) ||
      (m.detalhes.digitalContasEngajadas != null && m.detalhes.digitalContasEngajadas > 0)
    )
  }

  // Pesquisa: qualquer cidade com ranking/média (estimulada ou espontânea),
  // mesmo sem expectativa cadastrada na planilha.
  if (indicador === 'pesquisa') {
    return (
      m.sinais.pesquisa !== 'sem_dado' ||
      m.detalhes.pesquisaTop5.length > 0 ||
      m.detalhes.pesquisaMediaPct != null
    )
  }

  // Obras: cobertura bruta (com obra cadastrada), independente da expectativa.
  if (indicador === 'obras') {
    return m.detalhes.obrasQuantidade > 0
  }

  if (m.prioridade === 'sem_expectativa') return false

  return false
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
    digital: contagemIptPorIndicador(municipios, 'digital'),
  }
}

export function buildContagemIptSinalMal(municipios: IptMunicipio[]): Record<IptIndicador, number> {
  return {
    visitas: contagemIptSinalMal(municipios, 'visitas'),
    obras: contagemIptSinalMal(municipios, 'obras'),
    pesquisa: contagemIptSinalMal(municipios, 'pesquisa'),
    digital: contagemIptSinalMal(municipios, 'digital'),
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

/** Acima deste valor, a pílula "Prioridade crítica" ganha destaque de alerta. */
export const IPT_LIMIAR_ALERTA_CRITICO = 1

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
  if (indicador === 'digital' && sinal === 'bem') return 'No top Instagram'
  if (indicador === 'digital' && sinal === 'sem_dado') return 'Sem dado'
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
