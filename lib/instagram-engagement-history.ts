/** Utilitários compartilhados — histórico de engajamento por dia de publicação. */

export type InstagramPostSnapshotInput = {
  id: string
  type?: string
  posted_at: string
  post_url?: string
  thumbnail_url?: string
  caption?: string
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  views?: number
  engagement: number
}

export type InstagramDayPostRecord = {
  id: string
  type: 'image' | 'video' | 'carousel' | string
  url: string
  thumbnail?: string
  caption?: string
  postedAt: string
  metrics: {
    likes: number
    comments: number
    shares: number
    saves: number
    views: number
    engagement: number
  }
}

export type InstagramPublishDayEngagement = {
  publish_date: string
  avg_engagement: number
  post_count: number
  total_engagement: number
}

export function toPublishDayKey(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const isoDate = value.split('T')[0]
    return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type PublishDayBucket = {
  post_count: number
  total_engagement: number
  avg_engagement: number
}

export function aggregatePostsToPublishDays(
  posts: Array<{ posted_at: string; engagement: number }>
): Map<string, PublishDayBucket> {
  const buckets = new Map<string, { post_count: number; total_engagement: number }>()

  for (const post of posts) {
    const publishDate = toPublishDayKey(post.posted_at)
    if (!publishDate) continue

    const bucket = buckets.get(publishDate) ?? { post_count: 0, total_engagement: 0 }
    bucket.post_count += 1
    bucket.total_engagement += post.engagement || 0
    buckets.set(publishDate, bucket)
  }

  const result = new Map<string, PublishDayBucket>()
  for (const [publishDate, bucket] of buckets) {
    result.set(publishDate, {
      post_count: bucket.post_count,
      total_engagement: bucket.total_engagement,
      avg_engagement:
        bucket.post_count > 0 ? Math.round(bucket.total_engagement / bucket.post_count) : 0,
    })
  }

  return result
}

export function latestPostMetricsByPostId<
  T extends { post_id: string; posted_at: string; engagement: number; snapshot_date: string },
>(rows: T[]): Map<string, T> {
  const latest = new Map<string, T>()

  for (const row of rows) {
    const existing = latest.get(row.post_id)
    if (!existing || row.snapshot_date > existing.snapshot_date) {
      latest.set(row.post_id, row)
    }
  }

  return latest
}

export function buildPublishDayEngagementMap(
  rows: InstagramPublishDayEngagement[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const dayKey = row.publish_date.split('T')[0]
    map.set(dayKey, row.avg_engagement)
  }
  return map
}
