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
  /** Atlas DH 2010 (Ipeadata). Mantido para os demais painéis; o card de Atendimento usa `renda_censo_2022`. */
  renda_vulnerabilidade: {
    renda_per_capita: number | null
    percentual_vulneraveis_pobreza: number | null
    fonte?: string | null
    ano_referencia?: number | null
  }
  /** Censo 2022: rendimento domiciliar per capita (tabelas SIDRA 10295 e 10296). */
  renda_censo_2022?: RendaCenso2022 | null
  /** Censo 2022: saneamento dos domicílios (tabelas SIDRA 6803, 6892 e 6805). */
  saneamento_censo_2022?: SaneamentoCenso2022 | null
  /** Censo 2022: pessoas com deficiência (SIDRA 10125). */
  deficiencia_censo_2022?: DeficienciaCenso2022 | null
}

export type DeficienciaCenso2022 = {
  ano_referencia: number
  pessoas_2_anos_ou_mais: number | null
  pessoas_com_deficiencia: number | null
  fonte?: string | null
}

export type SaneamentoCenso2022 = {
  ano_referencia: number
  domicilios_total: number | null
  domicilios_sem_ligacao_rede_agua: number | null
  domicilios_lixo_coletado: number | null
  domicilios_esgoto_adequado: number | null
  fonte?: string | null
}

export type RendaCenso2022 = {
  ano_referencia: number
  moradores_total: number | null
  renda_media_domiciliar_pc: number | null
  renda_mediana_domiciliar_pc: number | null
  moradores_ate_quarto_sm: number | null
  moradores_quarto_a_meio_sm: number | null
  moradores_sem_rendimento: number | null
  fonte?: string | null
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
