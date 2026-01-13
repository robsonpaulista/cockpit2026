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
    .trim()
}

// Buscar eleitorado por cidade
export function getEleitoradoByCity(cityName: string): number | null {
  if (!cityName) return null
  
  const normalized = normalizeCityName(cityName)
  
  const found = (eleitoresData as EleitoradoData[]).find((item) => {
    const itemNormalized = normalizeCityName(item.municipio)
    return itemNormalized === normalized || itemNormalized.includes(normalized) || normalized.includes(itemNormalized)
  })
  
  return found ? found.eleitorado : null
}

// Buscar todos os dados de eleitores
export function getAllEleitores(): EleitoradoData[] {
  return eleitoresData as EleitoradoData[]
}
