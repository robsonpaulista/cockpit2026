/** Espelho de lib/political-actors-exclude.ts para scripts Node. */
export const EXCLUDED_POLITICAL_ACTOR_SLUGS = ['instagram-causa-animal']

const EXCLUDED = new Set(EXCLUDED_POLITICAL_ACTOR_SLUGS)

function normalizeSlug(slug) {
  return String(slug ?? '')
    .trim()
    .toLowerCase()
}

export function isExcludedPoliticalActorSlug(slug) {
  const s = normalizeSlug(slug)
  if (!s) return false
  if (EXCLUDED.has(s)) return true
  return s.includes('instagram') && s.includes('causa') && s.includes('animal')
}

export function filterOutExcludedPoliticalActors(actors) {
  return (actors ?? []).filter((a) => !isExcludedPoliticalActorSlug(a?.slug))
}
