import {
  IPT_TOTAL_MUNICIPIOS_PI,
  municipioCobertoCampo,
  temExpectativa,
} from '@/lib/ipt-missoes'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { getEleitoradoByCity, getEleitoradoTotalPiaui } from '@/lib/eleitores'
import { AGENDA_PROXIMOS_JANELA_DIAS } from '@/lib/war-room/agenda-proximos'

/** Indicadores de desempenho da Expectativa (área × campo × eleitorado × agenda). */
export type ExpectativaDesempenhoMetrics = {
  totalMunicipiosPi: number
  /** Municípios com expectativa > 0 (= área de cobertura). */
  comExpectativa: number
  /** % dos 224 com expectativa. */
  coberturaPct: number
  /** Com expectativa e ≥1 visita nos últimos 15 dias. */
  visitadosNaArea15d: number
  /** % da área (com expectativa) visitada em 15 dias. */
  visitasAreaPct: number
  /** Eleitores das cidades com expectativa. */
  eleitoresArea: number
  /** Eleitorado total do Piauí. */
  eleitoresEstado: number
  /** eleitoresArea / eleitoresEstado × 100. */
  eleitoradoAreaPct: number
  /** Cidades distintas com visita agendada (próximos N dias). */
  cidadesAgendadas: number
  /** Dessas, quantas estão na área de cobertura. */
  cidadesAgendadasNaArea: number
  /** Janela da agenda em dias. */
  agendaJanelaDias: number
}

export function calcExpectativaDesempenho(
  municipios: IptMunicipio[],
  opts?: {
    /** Chaves normalizadas de municípios com agenda próxima. */
    agendaMunicipioKeys?: Iterable<string>
    agendaJanelaDias?: number
  },
): ExpectativaDesempenhoMetrics {
  const comMeta = municipios.filter(temExpectativa)
  const comExpectativa = comMeta.length
  const visitadosNaArea15d = comMeta.filter(municipioCobertoCampo).length

  // Mesma regra do ícone no Ranking: município IPT com ≥1 item em agendaPorMunicipio.
  const agendaKeys = new Set<string>()
  for (const key of opts?.agendaMunicipioKeys ?? []) {
    const k = String(key).trim()
    if (k) agendaKeys.add(k)
  }
  const temAgenda = (municipio: string) =>
    agendaKeys.has(normalizeIptMunicipio(municipio))

  const cidadesAgendadas = municipios.filter((m) => temAgenda(m.municipio)).length
  const cidadesAgendadasNaArea = comMeta.filter((m) => temAgenda(m.municipio)).length

  const eleitoresEstado = getEleitoradoTotalPiaui()
  const eleitoresArea = comMeta.reduce((sum, m) => {
    const n = getEleitoradoByCity(m.municipio)
    return sum + (typeof n === 'number' && Number.isFinite(n) ? n : 0)
  }, 0)

  const coberturaPct =
    IPT_TOTAL_MUNICIPIOS_PI > 0
      ? (comExpectativa / IPT_TOTAL_MUNICIPIOS_PI) * 100
      : 0
  const visitasAreaPct =
    comExpectativa > 0 ? (visitadosNaArea15d / comExpectativa) * 100 : 0
  const eleitoradoAreaPct =
    eleitoresEstado > 0 ? (eleitoresArea / eleitoresEstado) * 100 : 0

  return {
    totalMunicipiosPi: IPT_TOTAL_MUNICIPIOS_PI,
    comExpectativa,
    coberturaPct,
    visitadosNaArea15d,
    visitasAreaPct,
    eleitoresArea,
    eleitoresEstado,
    eleitoradoAreaPct,
    cidadesAgendadas,
    cidadesAgendadasNaArea,
    agendaJanelaDias: opts?.agendaJanelaDias ?? AGENDA_PROXIMOS_JANELA_DIAS,
  }
}

function formatPct1(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
}

function formatInt(value: number): string {
  return value.toLocaleString('pt-BR')
}

export type ExpectativaDesempenhoKpi = {
  id: string
  label: string
  total: number
  valueLabel: string
  legend: string
  /** Linha auxiliar (ex.: “12,4% da área”). */
  detail?: string
}

export function buildExpectativaDesempenhoKpis(
  metrics: ExpectativaDesempenhoMetrics,
): ExpectativaDesempenhoKpi[] {
  const agendaNaAreaPct =
    metrics.comExpectativa > 0
      ? (metrics.cidadesAgendadasNaArea / metrics.comExpectativa) * 100
      : 0

  return [
    {
      id: 'cobertura',
      label: 'Área de cobertura',
      total: metrics.comExpectativa,
      valueLabel: `${formatInt(metrics.comExpectativa)} de ${formatInt(metrics.totalMunicipiosPi)}`,
      legend: 'Municípios com expectativa',
      detail: `${formatPct1(metrics.coberturaPct)} do Piauí`,
    },
    {
      id: 'visitas15',
      label: 'Visitas · 15 dias',
      total: metrics.visitadosNaArea15d,
      valueLabel: `${formatInt(metrics.visitadosNaArea15d)} de ${formatInt(metrics.comExpectativa)}`,
      legend: 'Da área de cobertura',
      detail: `${formatPct1(metrics.visitasAreaPct)} visitados`,
    },
    {
      id: 'agenda',
      label: `Agenda · ${metrics.agendaJanelaDias} dias`,
      total: metrics.cidadesAgendadas,
      valueLabel: formatInt(metrics.cidadesAgendadas),
      legend: 'Com ícone de agenda no ranking',
      detail: `${formatInt(metrics.cidadesAgendadasNaArea)} na área · ${formatPct1(agendaNaAreaPct)}`,
    },
    {
      id: 'eleitorado',
      label: 'Eleitorado da área',
      total: metrics.eleitoradoAreaPct,
      valueLabel: formatPct1(metrics.eleitoradoAreaPct),
      legend: 'Do total de eleitores do PI',
      detail: `${formatInt(metrics.eleitoresArea)} de ${formatInt(metrics.eleitoresEstado)}`,
    },
  ]
}
