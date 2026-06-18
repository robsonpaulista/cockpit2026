import type { InstagramDayPostRecord } from '@/lib/instagram-engagement-history'
import { toPublishDayKey } from '@/lib/instagram-engagement-history'

export function filterLivePostsByPublishDate(
  posts: InstagramDayPostRecord[],
  publishDate: string
): InstagramDayPostRecord[] {
  return posts
    .filter((post) => toPublishDayKey(post.postedAt) === publishDate)
    .sort((a, b) => b.metrics.engagement - a.metrics.engagement)
}

export function mergeInstagramDayPosts(
  livePosts: InstagramDayPostRecord[],
  historicalPosts: InstagramDayPostRecord[]
): InstagramDayPostRecord[] {
  const merged = new Map<string, InstagramDayPostRecord>()

  for (const post of historicalPosts) {
    merged.set(post.id, post)
  }

  for (const post of livePosts) {
    merged.set(post.id, post)
  }

  return [...merged.values()].sort((a, b) => b.metrics.engagement - a.metrics.engagement)
}

export function mapMetricsPostsToDayRecords(
  posts: Array<{
    id: string
    type: 'image' | 'video' | 'carousel' | string
    url: string
    thumbnail: string
    caption: string
    postedAt: string
    metrics: {
      likes: number
      comments: number
      shares: number
      saves: number
      views?: number
      engagement: number
    }
  }>
): InstagramDayPostRecord[] {
  return posts.map((post) => ({
    id: post.id,
    type: post.type,
    url: post.url,
    thumbnail: post.thumbnail,
    caption: post.caption,
    postedAt: post.postedAt,
    metrics: {
      likes: post.metrics.likes,
      comments: post.metrics.comments,
      shares: post.metrics.shares,
      saves: post.metrics.saves,
      views: post.metrics.views ?? 0,
      engagement: post.metrics.engagement,
    },
  }))
}
