import type { PoliticalActor } from '@/lib/youtube-radar-types'

/** Termos efetivos no RSS do Google Notícias para o tema Instagram Causa Animal. */
export const GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES: readonly string[] = [
  'pacto pelos animais piaui',
  'busão da castração',
  'ônibus da castração',
  'castração piauí',
] as const

/**
 * Termos na aba Vídeos do Google (Playwright) — foco Teresina/Piauí.
 * Separados do RSS.
 */
export const GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES: readonly string[] = [
  'busão da castração teresina',
  'ônibus da castração teresina',
  'castração teresina piauí',
  'pacto pelos animais piaui teresina',
] as const

/** @deprecated use GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES[0] */
export const GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY = GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES[0]

/** Chaves (nome/slug normalizado) que usam múltiplos termos no Google News. */
const GOOGLE_NEWS_MULTI_QUERY_THEMES: Readonly<Record<string, readonly string[]>> = {
  'causa animal': GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES,
  'instagram causa animal': GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES,
  'instagram-causa-animal': GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES,
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ')
}

function isInstagramCausaAnimalTheme(normalized: string): boolean {
  return normalized.includes('instagram') && normalized.includes('causa animal')
}

function resolveMultiQueryTheme(normalized: string): readonly string[] | null {
  const override = GOOGLE_NEWS_MULTI_QUERY_THEMES[normalized]
  if (override) return override
  if (isInstagramCausaAnimalTheme(normalized)) return GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES
  return null
}

/** Resolve o termo enviado ao RSS do Google Notícias (primeiro termo quando há vários). */
export function resolveGoogleNewsSearchQuery(termOrActorName: string): string {
  const trimmed = termOrActorName.trim()
  const multi = resolveMultiQueryTheme(normalizeKey(trimmed))
  if (multi) return multi[0]
  return trimmed
}

/** Todos os termos RSS para um ator ou rótulo (vários quando o tema exige). */
export function resolveGoogleNewsSearchQueriesForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string[] {
  const keys = [normalizeKey(actor.slug ?? ''), normalizeKey(actor.name)].filter(Boolean)
  for (const key of keys) {
    const multi = resolveMultiQueryTheme(key)
    if (multi) return [...multi]
  }
  return [resolveGoogleNewsSearchQuery(actor.name)]
}

/**
 * Termos para Google Vídeos (Playwright) — piloto: só tema castração / causa animal.
 * Retorna vazio para demais atores até expandirmos o monitoramento.
 */
export function resolveGoogleVideosSearchQueriesForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string[] {
  const keys = [normalizeKey(actor.slug ?? ''), normalizeKey(actor.name)].filter(Boolean)
  for (const key of keys) {
    if (resolveMultiQueryTheme(key)) return [...GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES]
  }
  return []
}

/** Termos para busca web (Google.com via Programmable Search): geral + Instagram indexado. */
export function resolveGoogleWebSearchQueriesForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string[] {
  const terms = resolveGoogleNewsSearchQueriesForActor(actor)
  if (terms.length === 0) return []
  if (terms.length === 1) {
    return [terms[0], `site:instagram.com ${terms[0]}`]
  }
  const orGroup = terms.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ')
  return [orGroup, `site:instagram.com (${orGroup})`]
}

/** @deprecated use resolveGoogleNewsSearchQueriesForActor */
export function resolveGoogleNewsSearchQueryForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string {
  return resolveGoogleNewsSearchQueriesForActor(actor)[0]
}

/** Exclui menções gravadas com termo antigo/errado após mudança de override. */
export function googleNewsMentionMatchesActorQuery(
  mention: { search_term: string; collect_channel?: string | null },
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): boolean {
  if (mention.collect_channel === 'google_web') {
    return resolveGoogleWebSearchQueriesForActor(actor).includes(mention.search_term)
  }
  if (mention.collect_channel === 'google_videos') {
    return resolveGoogleVideosSearchQueriesForActor(actor).includes(mention.search_term)
  }
  return resolveGoogleNewsSearchQueriesForActor(actor).includes(mention.search_term)
}
