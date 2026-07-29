import { IPT_TOTAL_MUNICIPIOS_PI } from '@/lib/ipt-missoes'
import {
  buildPosicoesPesquisaPorMunicipio,
  type PollIptRow,
} from '@/lib/ipt-pesquisa'
import { getEleitoradoByCity, getEleitoradoTotalPiaui } from '@/lib/eleitores'

/** Indicadores de desempenho das pesquisas (cobertura × top 5 × eleitorado). */
export type PesquisasDesempenhoMetrics = {
  totalMunicipiosPi: number
  cidadesComPesquisa: number
  coberturaPct: number
  emTop5: number
  foraTop5: number
  eleitoresEstado: number
  eleitoresEmTop5: number
  eleitoresForaTop5: number
  /** % do eleitorado do estado nas cidades em que estamos no top 5. */
  eleitoradoEmTop5Pct: number
  /** % do eleitorado do estado nas cidades com pesquisa fora do top 5. */
  eleitoradoForaTop5Pct: number
  /**
   * Estimativa de votos: Σ (média% válidos × eleitorado da cidade)
   * só nas cidades com pesquisa e com o candidato na média.
   */
  estimativaVotos: number
  /** Cidades que entraram na soma da estimativa. */
  cidadesNaEstimativa: number
  /** Nome do candidato foco (exibição). */
  candidato: string
}

export type PesquisasDesempenhoKpi = {
  id: string
  label: string
  total: number
  valueLabel: string
  legend: string
  detail?: string
}

export function calcPesquisasDesempenho(
  polls: PollIptRow[],
  candidato: string,
): PesquisasDesempenhoMetrics {
  const posicoes = buildPosicoesPesquisaPorMunicipio(polls, candidato)
  const cidadesComPesquisa = posicoes.length
  const emTop5Rows = posicoes.filter((p) => p.emTop5)
  const foraTop5Rows = posicoes.filter((p) => !p.emTop5)

  const eleitoresEstado = getEleitoradoTotalPiaui()
  const sumEleitores = (rows: typeof posicoes) =>
    rows.reduce((sum, row) => {
      const n = getEleitoradoByCity(row.cidade)
      return sum + (typeof n === 'number' && Number.isFinite(n) ? n : 0)
    }, 0)

  const eleitoresEmTop5 = sumEleitores(emTop5Rows)
  const eleitoresForaTop5 = sumEleitores(foraTop5Rows)

  let estimativaVotos = 0
  let cidadesNaEstimativa = 0
  for (const row of posicoes) {
    if (row.mediaPct == null || !Number.isFinite(row.mediaPct) || row.mediaPct <= 0) {
      continue
    }
    const eleitores = getEleitoradoByCity(row.cidade)
    if (eleitores == null || !Number.isFinite(eleitores) || eleitores <= 0) continue
    estimativaVotos += (row.mediaPct / 100) * eleitores
    cidadesNaEstimativa += 1
  }
  estimativaVotos = Math.round(estimativaVotos)

  return {
    totalMunicipiosPi: IPT_TOTAL_MUNICIPIOS_PI,
    cidadesComPesquisa,
    coberturaPct:
      IPT_TOTAL_MUNICIPIOS_PI > 0
        ? (cidadesComPesquisa / IPT_TOTAL_MUNICIPIOS_PI) * 100
        : 0,
    emTop5: emTop5Rows.length,
    foraTop5: foraTop5Rows.length,
    eleitoresEstado,
    eleitoresEmTop5,
    eleitoresForaTop5,
    eleitoradoEmTop5Pct:
      eleitoresEstado > 0 ? (eleitoresEmTop5 / eleitoresEstado) * 100 : 0,
    eleitoradoForaTop5Pct:
      eleitoresEstado > 0 ? (eleitoresForaTop5 / eleitoresEstado) * 100 : 0,
    estimativaVotos,
    cidadesNaEstimativa,
    candidato: candidato.trim() || 'Candidato',
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

function shortCandidatoLabel(nome: string): string {
  const parts = nome.trim().split(/\s+/)
  if (parts.length <= 2) return nome.trim()
  return `${parts[0]} ${parts[parts.length - 1]}`
}

export function buildPesquisasDesempenhoKpis(
  metrics: PesquisasDesempenhoMetrics,
): PesquisasDesempenhoKpi[] {
  const candidatoCurto = shortCandidatoLabel(metrics.candidato)

  return [
    {
      id: 'cobertura',
      label: 'Cidades com pesquisa',
      total: metrics.cidadesComPesquisa,
      valueLabel: `${formatInt(metrics.cidadesComPesquisa)} de ${formatInt(metrics.totalMunicipiosPi)}`,
      legend: 'Cobertura no Piauí',
      detail: `${formatPct1(metrics.coberturaPct)} dos municípios`,
    },
    {
      id: 'top5',
      label: 'No top 5',
      total: metrics.emTop5,
      valueLabel: formatInt(metrics.emTop5),
      legend: 'Cidades · votos válidos',
      detail: `${formatPct1(metrics.eleitoradoEmTop5Pct)} do eleitorado do PI`,
    },
    {
      id: 'fora',
      label: 'Fora do top 5',
      total: metrics.foraTop5,
      valueLabel: formatInt(metrics.foraTop5),
      legend: 'Cidades · votos válidos',
      detail: `${formatPct1(metrics.eleitoradoForaTop5Pct)} do eleitorado do PI`,
    },
    {
      id: 'proporcao',
      label: 'Proporção eleitoral',
      total: metrics.eleitoradoEmTop5Pct,
      valueLabel: `${formatPct1(metrics.eleitoradoEmTop5Pct)} · ${formatPct1(metrics.eleitoradoForaTop5Pct)}`,
      legend: 'Top 5 · fora · do eleitorado do PI',
      detail: `${formatInt(metrics.eleitoresEmTop5)} · ${formatInt(metrics.eleitoresForaTop5)} eleitores`,
    },
    {
      id: 'estimativa',
      label: `Estimativa · ${candidatoCurto}`,
      total: metrics.estimativaVotos,
      valueLabel: formatInt(metrics.estimativaVotos),
      legend: 'Média% × eleitorado · cidades com pesquisa',
      detail: `${formatInt(metrics.cidadesNaEstimativa)} municípios na soma`,
    },
  ]
}
