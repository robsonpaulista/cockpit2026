import type { PoliticalActor } from '@/lib/youtube-radar-types'

/** Termo efetivo no RSS do Google Notícias para o tema Instagram Causa Animal. */
export const GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY = 'pacto pelos animais piaui'

/** Termos de busca no Google News que diferem do rótulo do monitoramento (ex.: tema Instagram). */
const GOOGLE_NEWS_QUERY_OVERRIDES: Readonly<Record<string, string>> = {
  'causa animal': GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY,
  'instagram causa animal': GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY,
  'instagram-causa-animal': GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY,
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ')
}

function isInstagramCausaAnimalTheme(normalized: string): boolean {
  return normalized.includes('instagram') && normalized.includes('causa animal')
}

/** Resolve o termo enviado ao RSS do Google Notícias. */
export function resolveGoogleNewsSearchQuery(termOrActorName: string): string {
  const trimmed = termOrActorName.trim()
  const normalized = normalizeKey(trimmed)
  const override = GOOGLE_NEWS_QUERY_OVERRIDES[normalized]
  if (override) return override
  if (isInstagramCausaAnimalTheme(normalized)) return GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY
  return trimmed
}

export function resolveGoogleNewsSearchQueryForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string {
  if (actor.slug) {
    const bySlug = GOOGLE_NEWS_QUERY_OVERRIDES[normalizeKey(actor.slug)]
    if (bySlug) return bySlug
    if (isInstagramCausaAnimalTheme(normalizeKey(actor.slug))) {
      return GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY
    }
  }
  return resolveGoogleNewsSearchQuery(actor.name)
}

/** Exclui menções gravadas com termo antigo/errado após mudança de override. */
export function googleNewsMentionMatchesActorQuery(
  mention: { search_term: string },
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): boolean {
  return mention.search_term === resolveGoogleNewsSearchQueryForActor(actor)
}
