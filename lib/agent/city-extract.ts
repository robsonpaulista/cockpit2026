import { stripAssistantMention } from '@/lib/agent/greeting-reply'
import { isMonthName } from '@/lib/agent/parse-visitas-mes'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const CIDADES_PIAUI = [
  'teresina', 'picos', 'parnaiba', 'floriano', 'piripiri', 'campo maior', 'oeiras',
  'barras', 'pedro ii', 'paes landim', 'jose de freitas', 'uruçui', 'bom jesus',
  'corrente', 'agua branca', 'altos', 'amarante', 'angical', 'batalha', 'canto do buriti',
  'castelo', 'cocal', 'demerval lobao', 'elesbao veloso', 'esperantina', 'fronteiras',
  'guadalupe', 'ilha grande', 'inhuma', 'itainopolis', 'jaicos', 'joaquim pires',
  'lagoa do piaui', 'luzilandia', 'miguel alves', 'miguel leao', 'monsenhor gil',
  'nazare', 'nossa senhora', 'palmeirais', 'paulistana', 'pimenteiras', 'pio ix',
  'piracuruca', 'regeneracao', 'ribeiro goncalves', 'santa cruz', 'santa filomena',
  'santana', 'santo antonio', 'sao felix', 'sao goncalo', 'sao joao', 'sao jose',
  'sao miguel', 'sao pedro', 'sao raimundo', 'simoes', 'simplicio', 'socorro', 'uniao',
  'valenca', 'varzea', 'luzilândia', 'são joão do piauí', 'são raimundo nonato',
] as const

const STOP_CITY_TOKENS = new Set([
  'jarvis',
  'cockpit',
  'assistente',
  'copilot',
  'oi',
  'ola',
  'hey',
  'bom',
  'boa',
  'tarde',
  'noite',
  'dia',
  'jogos',
])

const INVALID_CITY_PREFIX =
  /^(que|eu|foi|a|o|as|os|da|do|das|dos|de|em|para|ultima|ultimo|ultimas|ultimos|qual|foi a)\b/

/** Frases que o regex de cidade captura por engano — ex.: «cidade que eu visitei». */
export function isInvalidCityCandidate(candidata: string): boolean {
  const c = normalizeText(candidata)
  if (!c || c.length < 3) return true
  if (STOP_CITY_TOKENS.has(c)) return true
  if (INVALID_CITY_PREFIX.test(c)) return true
  if (/\b(visitei|visita|visitas|viagem|viagens|campo|agenda|municipio|município)\b/.test(c)) {
    return true
  }
  if (/^que\s+eu\b/.test(c) || /\beu\s+visitei\b/.test(c)) return true
  if (isMonthName(c)) return true
  if (/\b(expectativa|federal|comparativo|piau[ií])\b/.test(c) && /\b20(22|26)\b/.test(c)) return true
  if (/\b(territorio|território|base|jadyel|votos)\b/.test(c) && c.length > 18) return true
  return false
}

/** Extrai município da pergunta — evita falso positivo em "boa tarde jarvis". */
export function extractCityNameFromQuery(query: string): string | null {
  const cleaned = stripAssistantMention(query)
  const normalized = normalizeText(cleaned)

  for (const cidade of CIDADES_PIAUI) {
    const cidadeNorm = normalizeText(cidade)
    if (normalized.includes(cidadeNorm)) {
      return cidade
    }
  }

  const patterns = [
    /\b(?:em|para|na|no)\s+(?!que\b|eu\b|foi\b|jadyel\b|o\s+jadyel\b)([a-z][a-z\s]*?)(?:\?|$|,|\.|!|;)/,
    /\bde\s+(?!que\b|eu\b|foi\b|a\b|jadyel\b)([a-z][a-z\s]*?)(?:\?|$|,|\.|!|;)/,
    /\bcidade\s+de\s+(?!que\b|eu\b)([a-z][a-z\s]*?)(?:\?|$|,|\.|!|;)/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match?.[1]) continue

    const matchIndex = match.index ?? 0
    const beforeDe = normalized.slice(Math.max(0, matchIndex - 5), matchIndex)
    if (/\bmes\s*$/.test(beforeDe)) continue

    const candidata = match[1].trim()
    if (candidata.length < 3 || candidata.length > 30) continue
    if (isInvalidCityCandidate(candidata)) continue

    const cidadeEncontrada = CIDADES_PIAUI.find(
      (c) => normalizeText(c).includes(candidata) || candidata.includes(normalizeText(c))
    )
    if (cidadeEncontrada) return cidadeEncontrada

    return candidata
  }

  return null
}
