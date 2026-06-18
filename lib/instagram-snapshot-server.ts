import type { SupabaseClient } from '@supabase/supabase-js'
import {
  aggregatePostsToPublishDays,
  latestPostMetricsByPostId,
  toPublishDayKey,
  type InstagramDayPostRecord,
  type InstagramPostSnapshotInput,
} from '@/lib/instagram-engagement-history'

type PostMetricsRow = {
  post_id: string
  posted_at: string
  engagement: number
  snapshot_date: string
  post_type?: string | null
  post_url?: string | null
  thumbnail_url?: string | null
  caption?: string | null
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  views?: number
}

export async function saveInstagramPostSnapshots(
  supabase: SupabaseClient,
  userId: string,
  posts: InstagramPostSnapshotInput[]
): Promise<void> {
  if (posts.length === 0) return

  const snapshotDate = new Date().toISOString().split('T')[0]

  const rows = posts.map((post) => ({
    user_id: userId,
    post_id: post.id,
    snapshot_date: snapshotDate,
    posted_at: post.posted_at,
    post_type: post.type ?? null,
    post_url: post.post_url ?? null,
    thumbnail_url: post.thumbnail_url ?? null,
    caption: post.caption ?? null,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    shares: post.shares ?? 0,
    saves: post.saves ?? 0,
    views: post.views ?? 0,
    engagement: post.engagement ?? 0,
  }))

  const { error } = await supabase
    .from('instagram_post_metrics_history')
    .upsert(rows, { onConflict: 'user_id,post_id,snapshot_date' })

  if (error) {
    throw new Error(error.message)
  }
}

export async function recomputeInstagramPublishDayEngagement(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('instagram_post_metrics_history')
    .select('post_id, posted_at, engagement, snapshot_date')
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const latestByPost = latestPostMetricsByPostId((data ?? []) as PostMetricsRow[])
  const publishDays = aggregatePostsToPublishDays([...latestByPost.values()])

  if (publishDays.size === 0) return

  const upsertRows = [...publishDays.entries()].map(([publish_date, bucket]) => ({
    user_id: userId,
    publish_date,
    post_count: bucket.post_count,
    total_engagement: bucket.total_engagement,
    avg_engagement: bucket.avg_engagement,
    updated_at: new Date().toISOString(),
  }))

  const { error: upsertError } = await supabase
    .from('instagram_publish_day_engagement')
    .upsert(upsertRows, { onConflict: 'user_id,publish_date' })

  if (upsertError) {
    throw new Error(upsertError.message)
  }
}

export async function getInstagramPostsByPublishDate(
  supabase: SupabaseClient,
  userId: string,
  publishDate: string
): Promise<InstagramDayPostRecord[]> {
  const { data, error } = await supabase
    .from('instagram_post_metrics_history')
    .select(
      'post_id, posted_at, engagement, snapshot_date, post_type, post_url, thumbnail_url, caption, likes, comments, shares, saves, views'
    )
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const latestByPost = latestPostMetricsByPostId((data ?? []) as PostMetricsRow[])

  return [...latestByPost.values()]
    .filter((row) => toPublishDayKey(row.posted_at) === publishDate)
    .map((row) => ({
      id: row.post_id,
      type: row.post_type ?? 'image',
      url: row.post_url ?? '',
      thumbnail: row.thumbnail_url ?? undefined,
      caption: row.caption ?? undefined,
      postedAt: row.posted_at,
      metrics: {
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        shares: row.shares ?? 0,
        saves: row.saves ?? 0,
        views: row.views ?? 0,
        engagement: row.engagement ?? 0,
      },
    }))
    .sort((a, b) => b.metrics.engagement - a.metrics.engagement)
}

export async function getLatestInstagramPostMetrics(
  supabase: SupabaseClient,
  userId: string
): Promise<InstagramDayPostRecord[]> {
  const { data, error } = await supabase
    .from('instagram_post_metrics_history')
    .select(
      'post_id, posted_at, engagement, snapshot_date, post_type, post_url, thumbnail_url, caption, likes, comments, shares, saves, views'
    )
    .eq('user_id', userId)
    .order('snapshot_date', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const latestByPost = latestPostMetricsByPostId((data ?? []) as PostMetricsRow[])

  return [...latestByPost.values()]
    .map((row) => ({
      id: row.post_id,
      type: row.post_type ?? 'image',
      url: row.post_url ?? '',
      thumbnail: row.thumbnail_url ?? undefined,
      caption: row.caption ?? undefined,
      postedAt: row.posted_at,
      metrics: {
        likes: row.likes ?? 0,
        comments: row.comments ?? 0,
        shares: row.shares ?? 0,
        saves: row.saves ?? 0,
        views: row.views ?? 0,
        engagement: row.engagement ?? 0,
      },
    }))
    .sort((a, b) => b.metrics.engagement - a.metrics.engagement)
}
