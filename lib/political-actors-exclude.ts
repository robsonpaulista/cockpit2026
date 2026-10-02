/**
 * Atores excluídos das coletas (Instagram Apify, Meta Ads, Google News, Trends)
 * e das UIs de radar / War Room.
 */
export const EXCLUDED_POLITICAL_ACTOR_SLUGS = ['instagram-causa-animal'] as const

const EXCLUDED = new Set<string>(EXCLUDED_POLITICAL_ACTOR_SLUGS)

function normalizeSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().toLowerCase()
}

export function isExcludedPoliticalActorSlug(slug: string | null | undefined): boolean {
  const s = normalizeSlug(slug)
  if (!s) return false
  if (EXCLUDED.has(s)) return true
  // Nome legado / variações
  return s.includes('instagram') && s.includes('causa') && s.includes('animal')
}

export function filterOutExcludedPoliticalActors<T extends { slug?: string | null }>(
  actors: readonly T[],
): T[] {
  return actors.filter((a) => !isExcludedPoliticalActorSlug(a.slug))
}
