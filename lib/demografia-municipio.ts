import demografiaMunicipiosPiaui from '@/data/demografia-municipios-piaui.json'

export type DemografiaMunicipioRow = {
  codigo_ibge: string
  municipio: string
  estado: string
  mesorregiao: string | null
  microrregiao: string | null
  populacao_censo_2022: number | null
  populacao_estimada_ultimo_ano: number | null
  ano_estimativa: number | null
  sexo: {
    masculino: number | null
    feminino: number | null
    total: number | null
  }
  faixas_etarias: {
    de_0_a_14: number | null
    de_15_a_59: number | null
    de_60_ou_mais: number | null
    total: number | null
  }
  cor_raca: {
    branca: number | null
    preta: number | null
    parda: number | null
    amarela: number | null
    indigena: number | null
    total: number | null
  }
  alfabetizacao: {
    taxa_15_mais: number | null
    taxa_analfabetismo_15_mais: number | null
  }
  urbanizacao: {
    urbana: number | null
    rural: number | null
    total: number | null
    taxa_urbana: number | null
    taxa_rural: number | null
    nota_fonte?: string | null
  }
  renda_vulnerabilidade: {
    renda_per_capita: number | null
    percentual_vulneraveis_pobreza: number | null
    fonte?: string | null
    ano_referencia?: number | null
  }
}

export type IndicadoresDemograficosPct = {
  pct014: number | null
  pct1559: number | null
  pct60: number | null
  pctMasc: number | null
  pctFem: number | null
}

function normalizeMunicipioNome(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

let demografiaIndex: Map<string, DemografiaMunicipioRow> | null = null

function getDemografiaIndex(): Map<string, DemografiaMunicipioRow> {
  if (demografiaIndex) return demografiaIndex
  const mapa = new Map<string, DemografiaMunicipioRow>()
  for (const item of demografiaMunicipiosPiaui as DemografiaMunicipioRow[]) {
    mapa.set(normalizeMunicipioNome(item.municipio), item)
  }
  demografiaIndex = mapa
  return mapa
}

export function getDemografiaMunicipio(municipio: string | null | undefined): DemografiaMunicipioRow | null {
  if (!municipio) return null
  return getDemografiaIndex().get(normalizeMunicipioNome(municipio)) ?? null
}

let populacaoTotalPiauiCache: number | null = null

/** Soma da população (estimativa preferida; censo como fallback) no Piauí. */
export function getPopulacaoTotalPiaui(): number {
  if (populacaoTotalPiauiCache != null) return populacaoTotalPiauiCache
  let total = 0
  for (const item of demografiaMunicipiosPiaui as DemografiaMunicipioRow[]) {
    const pop =
      item.populacao_estimada_ultimo_ano ?? item.populacao_censo_2022 ?? null
    if (pop != null && Number.isFinite(pop)) total += pop
  }
  populacaoTotalPiauiCache = total
  return total
}

export function calcularIndicadoresDemograficos(
  row: DemografiaMunicipioRow | null
): IndicadoresDemograficosPct | null {
  if (!row) return null
  const popTotal = row.populacao_censo_2022
  const pct = (v: number | null, t: number | null): number | null => {
    if (!Number.isFinite(Number(v)) || !Number.isFinite(Number(t)) || Number(t) <= 0) return null
    return (Number(v) / Number(t)) * 100
  }
  return {
    pct014: pct(row.faixas_etarias.de_0_a_14, popTotal),
    pct1559: pct(row.faixas_etarias.de_15_a_59, popTotal),
    pct60: pct(row.faixas_etarias.de_60_ou_mais, popTotal),
    pctMasc: pct(row.sexo.masculino, popTotal),
    pctFem: pct(row.sexo.feminino, popTotal),
  }
}

export function formatDemografiaNumero(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toLocaleString('pt-BR')
}

export function formatDemografiaPercent(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '-'
  return `${Number(value).toFixed(1)}%`
}
