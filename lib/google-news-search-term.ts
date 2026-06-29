import type { PoliticalActor } from '@/lib/youtube-radar-types'

/** Termos de busca no Google News que diferem do rótulo do monitoramento (ex.: tema Instagram). */
const GOOGLE_NEWS_QUERY_OVERRIDES: Readonly<Record<string, string>> = {
  'causa animal': 'pacto pelos animais piaui',
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ')
}

/** Resolve o termo enviado ao RSS do Google Notícias. */
export function resolveGoogleNewsSearchQuery(termOrActorName: string): string {
  const trimmed = termOrActorName.trim()
  const override = GOOGLE_NEWS_QUERY_OVERRIDES[normalizeKey(trimmed)]
  return override ?? trimmed
}

export function resolveGoogleNewsSearchQueryForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string {
  const bySlug = actor.slug ? GOOGLE_NEWS_QUERY_OVERRIDES[normalizeKey(actor.slug)] : undefined
  if (bySlug) return bySlug
  return resolveGoogleNewsSearchQuery(actor.name)
}
