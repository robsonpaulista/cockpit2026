/** Janela única do cockpit — 30 dias (valor persistido no Supabase e enviado ao Google Trends). */
export type GoogleTrendsTimeframe = 'today 1-m'

export const DEFAULT_GOOGLE_TRENDS_TIMEFRAME: GoogleTrendsTimeframe = 'today 1-m'

export const PANORAMA_GOOGLE_TRENDS_TIMEFRAME: GoogleTrendsTimeframe = 'today 1-m'

export const GOOGLE_TRENDS_TIMEFRAMES: GoogleTrendsTimeframe[] = ['today 1-m']

export const GOOGLE_TRENDS_WINDOW_LABEL = '30 dias'

/** Chaves legadas lidas do banco até migração completa das coletas antigas. */
export const GOOGLE_TRENDS_LEGACY_READ_KEYS = [
  'today 1-m',
  'today 3-m',
  'now 7-d',
  'today 7-d',
] as const

const LEGACY_TO_CANONICAL: Record<string, GoogleTrendsTimeframe> = {
  'today 1-m': 'today 1-m',
  'today 3-m': 'today 1-m',
  'now 7-d': 'today 1-m',
  'today 7-d': 'today 1-m',
}

/** Normaliza parâmetro vindo da UI/API (inclui aliases legados). */
export function normalizeGoogleTrendsTimeframe(input: string | null | undefined): GoogleTrendsTimeframe | null {
  const raw = input?.trim()
  if (!raw) return null
  return LEGACY_TO_CANONICAL[raw] ?? null
}

export function googleTrendsTimeframeLabel(_timeframe: GoogleTrendsTimeframe = DEFAULT_GOOGLE_TRENDS_TIMEFRAME): string {
  return GOOGLE_TRENDS_WINDOW_LABEL
}

/** String enviada ao Google Trends (explore/interestOverTime). */
export function toGoogleTrendsApiTime(timeframe: GoogleTrendsTimeframe): string {
  return timeframe
}

/** Chaves equivalentes ao consultar dados já salvos (inclui legado, normalizado na leitura). */
export function googleTrendsTimeframeQueryKeys(_timeframe: GoogleTrendsTimeframe): string[] {
  return [...GOOGLE_TRENDS_LEGACY_READ_KEYS]
}
