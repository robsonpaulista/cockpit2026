/**
 * Temas monitorados na aba Viral — pautas específicas da campanha (Piauí).
 * Interesse Google Trends 0–100 é relativo ao período/região, não volume absoluto.
 */

export type CampaignTrendsKeywordGroup = 'pauta' | 'deputado' | 'cidade'

export type CampaignTrendsKeyword = {
  term: string
  group: CampaignTrendsKeywordGroup
  label?: string
}

/** Pautas e obras/ações da campanha. */
export const CAMPAIGN_TRENDS_PAUTAS: CampaignTrendsKeyword[] = [
  { term: 'Hospital de Amor', group: 'pauta' },
  { term: 'proteção das crianças', group: 'pauta' },
  { term: 'eca digital', group: 'pauta', label: 'ECA Digital' },
  { term: 'pavimentação', group: 'pauta' },
  { term: 'asfalto', group: 'pauta' },
  { term: 'orla de atalaia', group: 'pauta', label: 'Orla de Atalaia' },
  { term: 'praia de atalaia', group: 'pauta', label: 'Praia de Atalaia' },
  { term: 'pacto pelos animais', group: 'pauta' },
  { term: 'mutirão de catarata', group: 'pauta' },
]

/** Nome do deputado e variações de busca. */
export const CAMPAIGN_TRENDS_DEPUTADO: CampaignTrendsKeyword[] = [
  { term: 'Jadyel Alencar', group: 'deputado' },
  { term: 'Jadyel', group: 'deputado' },
  { term: 'Deputado Jadyel', group: 'deputado' },
  { term: 'Dep. Jadyel Alencar', group: 'deputado' },
]

/**
 * Cidades-foco (expectativa de votos) — interesse relativo do nome no Piauí.
 * Comparar até 5 no gráfico; não é mapa de notícias por município.
 */
export const CAMPAIGN_TRENDS_CIDADES: CampaignTrendsKeyword[] = [
  { term: 'Teresina', group: 'cidade' },
  { term: 'Parnaíba', group: 'cidade' },
  { term: 'Picos', group: 'cidade' },
  { term: 'Floriano', group: 'cidade' },
  { term: 'Piripiri', group: 'cidade' },
  { term: 'Campo Maior', group: 'cidade' },
  { term: 'Pedro II', group: 'cidade' },
  { term: 'Barras', group: 'cidade' },
  { term: 'Altos', group: 'cidade' },
  { term: 'José de Freitas', group: 'cidade' },
  { term: 'União', group: 'cidade' },
  { term: 'Piracuruca', group: 'cidade' },
]

/** Termos coletados por padrão (pautas + deputado). Cidades entram sob demanda na UI de comparação se já houver série. */
export function getCampaignTrendsCollectTerms(): string[] {
  return [...CAMPAIGN_TRENDS_PAUTAS, ...CAMPAIGN_TRENDS_DEPUTADO].map((k) => k.term)
}

export function getAllCampaignTrendsKeywords(): CampaignTrendsKeyword[] {
  return [...CAMPAIGN_TRENDS_PAUTAS, ...CAMPAIGN_TRENDS_DEPUTADO, ...CAMPAIGN_TRENDS_CIDADES]
}

export function getCampaignTrendsTermSet(): Set<string> {
  return new Set(getAllCampaignTrendsKeywords().map((k) => k.term))
}

export function isCampaignTrendsTerm(term: string): boolean {
  return getCampaignTrendsTermSet().has(term)
}

export function labelCampaignTrendsGroup(group: CampaignTrendsKeywordGroup): string {
  if (group === 'deputado') return 'Deputado'
  if (group === 'cidade') return 'Cidades foco'
  return 'Pautas da campanha'
}
