import eleitoresData from './eleitores-piaui.json'

interface EleitoradoData {
  municipio: string
  eleitorado: number
}

// Normalizar nome da cidade para comparação (remove acentos, maiúsculas, etc)
function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeCityName(city: string): string[] {
  return normalizeCityName(city)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

// Buscar eleitorado por cidade
export function getEleitoradoByCity(cityName: string): number | null {
  if (!cityName) return null
  
  const normalized = normalizeCityName(cityName)
  const data = eleitoresData as EleitoradoData[]

  // 1) Match exato sempre tem prioridade.
  const exactMatch = data.find((item) => normalizeCityName(item.municipio) === normalized)
  if (exactMatch) return exactMatch.eleitorado

  // 2) Fallback por tokens completos (evita "OEIRAS" casar com "AROEIRAS").
  const queryTokens = tokenizeCityName(cityName)
  if (queryTokens.length === 0) return null

  const candidates = data.filter((item) => {
    const itemTokens = tokenizeCityName(item.municipio)
    if (itemTokens.length === 0) return false

    // Todos os tokens da consulta devem existir como palavras no município.
    return queryTokens.every((queryToken) => itemTokens.includes(queryToken))
  })

  if (candidates.length === 0) return null

  // Critério de desempate: nome mais próximo em quantidade de tokens.
  const best = candidates
    .map((item) => {
      const itemTokens = tokenizeCityName(item.municipio)
      return { item, score: Math.abs(itemTokens.length - queryTokens.length) }
    })
    .sort((a, b) => a.score - b.score)[0]

  return best?.item.eleitorado ?? null
}

// Buscar todos os dados de eleitores
export function getAllEleitores(): EleitoradoData[] {
  return eleitoresData as EleitoradoData[]
}
