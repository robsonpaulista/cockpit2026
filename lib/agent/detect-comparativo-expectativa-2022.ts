import type { AgentClassifiedIntent } from '@/lib/agent/types'
import type { CenarioExpectativaComparativo } from '@/lib/comparativo-expectativa-2022'

export type FiltroComparativoExpectativa2022 = 'caiu' | 'cresceu' | 'manteve' | 'todos'

export type ModoComparativoExpectativa2022 = 'resumo' | 'lista'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Comparativo expectativa 2026 × votos federais 2022 (Jadyel) — lista/mapa territorial. */
export function isComparativoExpectativa2022Query(query: string): boolean {
  const q = norm(query)

  const temExpectativa = /\b(expectativa|projecao|projecao|2026)\b/.test(q)
  const tem2022 = /\b(2022|federal|jadyel|jagiel|jadyel)\b/.test(q)
  const temComparativo =
    /\b(menor|maior|acima|abaixo|caiu|cair|queda|quedas|cresceu|crescer|comparar|comparativo|versus|vs)\b/.test(
      q
    ) || /\bexpectativa\b.*\b(2022|federal)\b/.test(q) || /\b(2022|federal)\b.*\bexpectativa\b/.test(q)
  const temLista = /\b(quais|lista|listar|municipios?|cidades?|onde)\b/.test(q)

  if (temExpectativa && tem2022 && (temComparativo || temLista)) return true

  if (/\b(municipios?|cidades?).*\b(caiu|cair|queda|menor|abaixo|perdeu)\b/.test(q)) return true
  if (/\b(caiu|queda|menor).*\b(municipios?|cidades?|territorio)\b/.test(q)) return true
  if (/\bmapa\b.*\b(2026|2022|comparativo)\b/.test(q)) return true

  return false
}

export function parseFiltroComparativoExpectativa2022(query: string): FiltroComparativoExpectativa2022 {
  const q = norm(query)
  if (/\b(cresceu|crescer|maior|acima|subiu|ganhou|superou)\b/.test(q)) return 'cresceu'
  if (/\b(manteve|estavel|estável|igual|estagnou)\b/.test(q)) return 'manteve'
  if (/\b(menor|abaixo|caiu|cair|queda|perdeu|pior|reduziu)\b/.test(q)) return 'caiu'
  if (/\b(todos|todas|completo|geral)\b/.test(q)) return 'todos'
  return 'caiu'
}

export function parseCenarioComparativoExpectativa2022(query: string): CenarioExpectativaComparativo {
  const q = norm(query)
  if (/\b(aferid[oa]|jadyel)\b/.test(q) && !/\b(anterior|legado)\b/.test(q)) return 'aferido'
  if (/\b(promessa)\b/.test(q)) return 'promessa'
  if (/\b(anterior|legado)\b/.test(q)) return 'legado'
  return 'legado'
}

/** Lista de cidades só quando o usuário pede explicitamente; caso contrário, totais gerais. */
export function parseModoComparativoExpectativa2022(query: string): ModoComparativoExpectativa2022 {
  const q = norm(query)
  if (
    /\b(quais|lista|listar|listagem|municipios?|cidades?|onde|ranking|top\s*\d*|piores|melhores|nomes?)\b/.test(
      q
    )
  ) {
    return 'lista'
  }
  return 'resumo'
}

export function detectComparativoExpectativa2022Intent(message: string): AgentClassifiedIntent | null {
  if (!isComparativoExpectativa2022Query(message)) return null

  return {
    intent: 'consultar_comparativo_expectativa_2022',
    args: {
      filtro: parseFiltroComparativoExpectativa2022(message),
      cenario: parseCenarioComparativoExpectativa2022(message),
      modo: parseModoComparativoExpectativa2022(message),
      termo: message.slice(0, 120),
    },
  }
}
