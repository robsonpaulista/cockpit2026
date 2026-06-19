import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export type YoutubeCompareChannelRow = {
  channel_title: string
  count: number
}

export type YoutubeCompareActorRow = {
  actor: PoliticalActorWithTerms
  videoCount: number
  totalViews: number
  topChannels: YoutubeCompareChannelRow[]
  mentions: YoutubeMentionWithActor[]
}

function topChannelsFromMentions(
  mentions: YoutubeMentionWithActor[],
  max = 4
): YoutubeCompareChannelRow[] {
  const counts = new Map<string, number>()
  for (const m of mentions) {
    const ch = m.channel_title?.trim() || 'Canal desconhecido'
    counts.set(ch, (counts.get(ch) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([channel_title, count]) => ({ channel_title, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
}

const ACTOR_TYPE_ORDER: Record<string, number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

/** Agrupa menções por candidato e monta linhas do quadro comparativo. */
export function buildYoutubeCompareRows(
  actors: PoliticalActorWithTerms[],
  mentions: YoutubeMentionWithActor[]
): YoutubeCompareActorRow[] {
  const bySlug = new Map<string, YoutubeMentionWithActor[]>()
  for (const m of mentions) {
    const slug = m.political_actors?.slug
    if (!slug) continue
    const arr = bySlug.get(slug) ?? []
    arr.push(m)
    bySlug.set(slug, arr)
  }

  const rows: YoutubeCompareActorRow[] = actors
    .filter((a) => a.active)
    .map((actor) => {
      const actorMentions = [...(bySlug.get(actor.slug) ?? [])].sort((a, b) => b.views - a.views)
      const totalViews = actorMentions.reduce((acc, m) => acc + (m.views ?? 0), 0)
      return {
        actor,
        videoCount: actorMentions.length,
        totalViews,
        topChannels: topChannelsFromMentions(actorMentions),
        mentions: actorMentions,
      }
    })

  return rows.sort((a, b) => {
    const ta = ACTOR_TYPE_ORDER[a.actor.actor_type] ?? 9
    const tb = ACTOR_TYPE_ORDER[b.actor.actor_type] ?? 9
    if (ta !== tb) return ta - tb
    return b.videoCount - a.videoCount || a.actor.name.localeCompare(b.actor.name, 'pt-BR')
  })
}
