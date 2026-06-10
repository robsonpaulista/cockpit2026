import { stripAssistantMention } from '@/lib/agent/greeting-reply'

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
  'jarvis', 'cockpit', 'assistente', 'copilot', 'oi', 'ola', 'hey', 'bom', 'boa', 'tarde', 'noite', 'dia',
])

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
    /\b(?:em|de|para)\s+([a-z][a-z\s]*?)(?:\?|$|,|\.|!|;)/,
    /\bcidade\s+(?:de\s+)?([a-z][a-z\s]*?)(?:\?|$|,|\.|!|;)/,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match?.[1]) continue

    const candidata = match[1].trim()
    if (candidata.length < 3 || candidata.length > 30) continue
    if (STOP_CITY_TOKENS.has(candidata)) continue

    const cidadeEncontrada = CIDADES_PIAUI.find(
      (c) => normalizeText(c).includes(candidata) || candidata.includes(normalizeText(c))
    )
    if (cidadeEncontrada) return cidadeEncontrada

    return candidata
  }

  return null
}
