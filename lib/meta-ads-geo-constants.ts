/** UFs e nomes comuns usados para filtrar ruído demográfico da Meta Ads Library. */
export const BR_STATE_NAMES = new Set([
  'acre',
  'alagoas',
  'amapá',
  'amapa',
  'amazonas',
  'bahia',
  'ceará',
  'ceara',
  'distrito federal',
  'espírito santo',
  'espirito santo',
  'goiás',
  'goias',
  'maranhão',
  'maranhao',
  'mato grosso',
  'mato grosso do sul',
  'minas gerais',
  'pará',
  'para',
  'paraíba',
  'paraiba',
  'paraná',
  'parana',
  'pernambuco',
  'piauí',
  'piaui',
  'rio de janeiro',
  'rio grande do norte',
  'rio grande do sul',
  'rondônia',
  'rondonia',
  'roraima',
  'santa catarina',
  'são paulo',
  'sao paulo',
  'sergipe',
  'tocantins',
])

const GEO_NOISE =
  /^(male|female|homem|mulher|unknown|desconhecido|brasil|brazil|todos|all|women|men|masculino|feminino|idade|gender|gênero|genero)$/i

export function normalizeGeoName(name: string): string {
  return name.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "Piauí, Brasil" → "Piauí" (formato comum na Meta Ads Library). */
export function cleanGeoLocationName(name: string): string {
  return normalizeGeoName(name)
    .replace(/,\s*brasil\s*$/i, '')
    .replace(/,\s*brazil\s*$/i, '')
    .trim()
}

export function isLikelyCityOrState(name: string): boolean {
  const n = cleanGeoLocationName(name)
  if (n.length < 2 || n.length > 48) return false
  if (GEO_NOISE.test(n)) return false
  if (/^\d+([.,]\d+)?\s*%?$/.test(n)) return false
  if (/^\d+\s*[-–]\s*\d+/.test(n)) return false
  if (/^(de|da|do|dos|das|e|a|o)$/i.test(n)) return false
  return /^[\p{L}\s.,'-]+$/u.test(n)
}

export function isBrazilianStateName(name: string): boolean {
  return BR_STATE_NAMES.has(normalizeGeoName(name).toLowerCase())
}
