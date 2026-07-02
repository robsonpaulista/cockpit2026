import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { googleNewsMentionMatchesActorQuery } from '@/lib/google-news-search-term'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export type GoogleNewsCompareSourceRow = {
  source_name: string
  count: number
}

export type GoogleNewsCompareActorRow = {
  actor: PoliticalActorWithTerms
  articleCount: number
  topSources: GoogleNewsCompareSourceRow[]
  mentions: GoogleNewsMentionWithActor[]
}

function effectiveMentionDate(m: GoogleNewsMentionWithActor): string {
  if (m.published_at) return m.published_at
  if (m.collect_channel === 'google_videos') return ''
  return m.collected_at ?? ''
}

const ACTOR_TYPE_ORDER: Record<string, number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

function topSourcesFromMentions(
  mentions: GoogleNewsMentionWithActor[],
  max = 4
): GoogleNewsCompareSourceRow[] {
  const counts = new Map<string, number>()
  for (const m of mentions) {
    const src = m.source_name?.trim() || 'Fonte desconhecida'
    counts.set(src, (counts.get(src) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([source_name, count]) => ({ source_name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
}

export function buildGoogleNewsCompareRows(
  actors: PoliticalActorWithTerms[],
  mentions: GoogleNewsMentionWithActor[]
): GoogleNewsCompareActorRow[] {
  const bySlug = new Map<string, GoogleNewsMentionWithActor[]>()
  for (const m of mentions) {
    const slug = m.political_actors?.slug
    if (!slug) continue
    const arr = bySlug.get(slug) ?? []
    arr.push(m)
    bySlug.set(slug, arr)
  }

  const rows: GoogleNewsCompareActorRow[] = actors
    .filter((a) => a.active)
    .map((actor) => {
      const actorMentions = [...(bySlug.get(actor.slug) ?? [])]
        .filter((m) => googleNewsMentionMatchesActorQuery(m, actor))
        .sort((a, b) => effectiveMentionDate(b).localeCompare(effectiveMentionDate(a)))
      return {
        actor,
        articleCount: actorMentions.length,
        topSources: topSourcesFromMentions(actorMentions),
        mentions: actorMentions,
      }
    })

  return rows.sort((a, b) => {
    const ta = ACTOR_TYPE_ORDER[a.actor.actor_type] ?? 9
    const tb = ACTOR_TYPE_ORDER[b.actor.actor_type] ?? 9
    if (ta !== tb) return ta - tb
    return b.articleCount - a.articleCount || a.actor.name.localeCompare(b.actor.name, 'pt-BR')
  })
}
