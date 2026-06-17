import { extractCityNameFromQuery, isInvalidCityCandidate } from '@/lib/agent/city-extract'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const LIDERANCA_TERM = String.raw`(?:liderancas?|liders?|minhas?\s+liderancas?)`
const CARGO_TERM = String.raw`(?:cargo|cargos|funcao|funcoes|função|funções|papel|papeis|atuacao|atuação)`
const RESUMO_TERM = String.raw`(?:resumo|quadro|tabela|painel|visao|visão|panorama|consolidado|agregado|totais?|contagem|distribuicao|distribuição|agrupad[oa]s?)`

/** Resumo global de lideranças agrupadas por cargo (planilha Território). */
export function isLiderancasResumoPorCargoQuery(query: string): boolean {
  const q = normalize(query)
  if (!q) return false

  if (/\bliderancas?\s+em\b/.test(q) || /\bem\s+.+\s+liderancas?\b/.test(q)) {
    const cidade = extractCityNameFromQuery(query)
    if (cidade && !isInvalidCityCandidate(cidade)) return false
  }

  const temLideranca = new RegExp(`\\b${LIDERANCA_TERM}\\b`).test(q) || /\b(minha|nossa)\s+base\b/.test(q)
  const temCargo = new RegExp(`\\b${CARGO_TERM}\\b`).test(q) || /\bpor\s+cargo\b/.test(q)
  const temResumo = new RegExp(`\\b${RESUMO_TERM}\\b`).test(q) || /\bquantas?\s+liderancas?\b/.test(q)

  if (temLideranca && temCargo) return true
  if (temLideranca && temResumo && /\bpor\s+cargo\b/.test(q)) return true
  if (/\bliderancas?\s+por\s+cargo\b/.test(q)) return true
  if (/\b(quantas?|quantos?)\s+liderancas?\s+(?:tem|ha|há|existem|por)\b/.test(q) && temCargo) return true

  return false
}
