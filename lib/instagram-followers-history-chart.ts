import type { InstagramSnapshot } from '@/lib/instagramApi'
import {
  buildPublishDayEngagementMap,
  toPublishDayKey,
  type InstagramPublishDayEngagement,
} from '@/lib/instagram-engagement-history'

export type PostEngagementInput = {
  postedAt: string
  engagement: number
}

export type FollowersHistoryChartPoint = {
  date: string
  fullDate: string
  /** Diferença de seguidores em relação ao dia anterior. */
  variacao: number
  /** Média de engajamento das publicações feitas naquele dia. */
  engajamentoMedio: number | null
}

/** Média de engajamento por dia de publicação (postedAt) — dados ao vivo. */
export function buildAvgEngagementByPublishDate(
  posts: PostEngagementInput[]
): Map<string, number> {
  const buckets = new Map<string, { sum: number; count: number }>()

  for (const post of posts) {
    if (!post.postedAt) continue
    const dayKey = toPublishDayKey(post.postedAt)
    if (!dayKey) continue

    const bucket = buckets.get(dayKey) ?? { sum: 0, count: 0 }
    bucket.sum += post.engagement || 0
    bucket.count += 1
    buckets.set(dayKey, bucket)
  }

  const averages = new Map<string, number>()
  for (const [dayKey, bucket] of buckets) {
    if (bucket.count === 0) continue
    averages.set(dayKey, Math.round(bucket.sum / bucket.count))
  }

  return averages
}

function mergeEngagementByDay(
  historical: InstagramPublishDayEngagement[] = [],
  livePosts: PostEngagementInput[] = []
): Map<string, number> {
  const engagementByDay = buildPublishDayEngagementMap(historical)

  for (const [dayKey, avg] of buildAvgEngagementByPublishDate(livePosts)) {
    engagementByDay.set(dayKey, avg)
  }

  return engagementByDay
}

export function buildFollowersHistoryChartData(
  history: InstagramSnapshot[],
  posts: PostEngagementInput[] = [],
  publishDayEngagement: InstagramPublishDayEngagement[] = []
): FollowersHistoryChartPoint[] {
  const engagementByDay = mergeEngagementByDay(publishDayEngagement, posts)

  const sorted = [...history].sort(
    (a, b) =>
      new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )

  const points: FollowersHistoryChartPoint[] = []

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    const dayKey = current.snapshot_date.split('T')[0]
    const engagement = engagementByDay.get(dayKey)

    points.push({
      date: new Date(current.snapshot_date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
      }),
      fullDate: current.snapshot_date,
      variacao: current.followers_count - previous.followers_count,
      engajamentoMedio: engagement ?? null,
    })
  }

  return points
}

export const FOLLOWERS_HISTORY_RANGE_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '14d', label: '14 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const

export function formatFollowersDelta(value: number): string {
  if (value > 0) return `+${value.toLocaleString('pt-BR')}`
  return value.toLocaleString('pt-BR')
}

export function formatEngagementValue(value: number): string {
  return Math.round(value).toLocaleString('pt-BR')
}

export function computeOverallAvgEngagement(posts: PostEngagementInput[]): number | undefined {
  if (posts.length === 0) return undefined
  return Math.round(
    posts.reduce((sum, post) => sum + (post.engagement || 0), 0) / posts.length
  )
}
