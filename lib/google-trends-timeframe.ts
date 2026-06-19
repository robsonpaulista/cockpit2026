/** Janelas aceitas no cockpit (valor persistido no Supabase). */
export type GoogleTrendsTimeframe = 'today 3-m' | 'today 1-m' | 'now 7-d'

export const GOOGLE_TRENDS_TIMEFRAMES: GoogleTrendsTimeframe[] = ['now 7-d', 'today 1-m', 'today 3-m']

const LEGACY_ALIASES: Record<string, GoogleTrendsTimeframe> = {
  'today 7-d': 'now 7-d',
}

/** Normaliza parâmetro vindo da UI/API (inclui alias legado). */
export function normalizeGoogleTrendsTimeframe(input: string | null | undefined): GoogleTrendsTimeframe | null {
  const raw = input?.trim()
  if (!raw) return null
  if (LEGACY_ALIASES[raw]) return LEGACY_ALIASES[raw]
  if ((GOOGLE_TRENDS_TIMEFRAMES as string[]).includes(raw)) return raw as GoogleTrendsTimeframe
  return null
}

/** String enviada ao Google Trends (explore/interestOverTime). */
export function toGoogleTrendsApiTime(timeframe: GoogleTrendsTimeframe): string {
  return timeframe
}

/** Chaves equivalentes ao consultar dados já salvos (ex.: migração today 7-d → now 7-d). */
export function googleTrendsTimeframeQueryKeys(timeframe: GoogleTrendsTimeframe): string[] {
  if (timeframe === 'now 7-d') return ['now 7-d', 'today 7-d']
  return [timeframe]
}
