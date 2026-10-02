import { isExcludedPoliticalActorSlug } from '@/lib/political-actors-exclude'
import type { PoliticalActor } from '@/lib/youtube-radar-types'

/** Resolve o termo enviado ao RSS do Google Notícias. */
export function resolveGoogleNewsSearchQuery(termOrActorName: string): string {
  return termOrActorName.trim()
}

/** Todos os termos RSS para um ator (vazio se excluído das coletas). */
export function resolveGoogleNewsSearchQueriesForActor(
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): string[] {
  if (isExcludedPoliticalActorSlug(actor.slug) || isExcludedPoliticalActorSlug(actor.name)) {
    return []
  }
  const name = actor.name.trim()
  return name ? [name] : []
}

/**
 * Termos para Google Vídeos — desativado (tema causa animal removido das coletas).
 */
export function resolveGoogleVideosSearchQueriesForActor(
  _actor: Pick<PoliticalActor, 'name' | 'slug'>
): string[] {
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
  return resolveGoogleNewsSearchQueriesForActor(actor)[0] ?? ''
}

/** Exclui menções gravadas com termo antigo/errado após mudança de override. */
export function googleNewsMentionMatchesActorQuery(
  mention: { search_term: string; collect_channel?: string | null },
  actor: Pick<PoliticalActor, 'name' | 'slug'>
): boolean {
  if (isExcludedPoliticalActorSlug(actor.slug) || isExcludedPoliticalActorSlug(actor.name)) {
    return false
  }
  if (mention.collect_channel === 'google_web') {
    return resolveGoogleWebSearchQueriesForActor(actor).includes(mention.search_term)
  }
  if (mention.collect_channel === 'google_videos') {
    return resolveGoogleVideosSearchQueriesForActor(actor).includes(mention.search_term)
  }
  return resolveGoogleNewsSearchQueriesForActor(actor).includes(mention.search_term)
}

/** @deprecated tema causa animal removido das coletas */
export const GOOGLE_NEWS_CAUSA_ANIMAL_QUERIES: readonly string[] = []
/** @deprecated */
export const GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES: readonly string[] = []
/** @deprecated */
export const GOOGLE_NEWS_PACTO_ANIMAIS_PIAUI_QUERY = ''
