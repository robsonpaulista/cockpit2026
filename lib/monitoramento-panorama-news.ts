import type { GoogleNewsCollectChannel } from '@/lib/google-news-platform'
import { effectiveGoogleVideosPublishedAt } from '@/lib/google-videos-date'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'

/** Canais que alimentam o card «Notícias relacionadas» (exclui Google Vídeos). */
export const PANORAMA_NEWS_COLLECT_CHANNELS: readonly GoogleNewsCollectChannel[] = [
  'google_news_rss',
  'google_web',
]

export function isPanoramaNewsCollectChannel(
  channel: string | null | undefined,
): channel is (typeof PANORAMA_NEWS_COLLECT_CHANNELS)[number] {
  return (
    channel === 'google_news_rss' ||
    channel === 'google_web'
  )
}

export function isPanoramaNewsMention(m: GoogleNewsMentionWithActor): boolean {
  return PANORAMA_NEWS_COLLECT_CHANNELS.includes(
    (m.collect_channel ?? 'google_news_rss') as GoogleNewsCollectChannel,
  )
}

/** Dia efetivo da menção para heatmap/modal (publicação ou coleta). */
export function panoramaNewsMentionDayKey(m: GoogleNewsMentionWithActor): string | null {
  if (m.collect_channel === 'google_videos') {
    const iso = effectiveGoogleVideosPublishedAt(m)
    return iso ? iso.slice(0, 10) : null
  }
  const iso = m.published_at ?? m.collected_at ?? null
  return iso ? iso.slice(0, 10) : null
}

export function filterPanoramaNewsMentions(
  mentions: GoogleNewsMentionWithActor[],
): GoogleNewsMentionWithActor[] {
  return mentions.filter(isPanoramaNewsMention)
}

export function mentionMatchesPanoramaNewsDay(
  m: GoogleNewsMentionWithActor,
  date: string,
): boolean {
  const day = panoramaNewsMentionDayKey(m)
  return day === date
}
