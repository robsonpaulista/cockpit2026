import {
  APIFY_FREE_MONTHLY_USD,
  estimateInstagramRadarCostUsd,
  getInstagramRadarMaxActors,
  getInstagramRadarMaxChargeUsd,
  getInstagramRadarPostsLimit,
} from '@/lib/instagram-radar-config'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export type InstagramRadarComparePostRow = {
  post_id: string
  caption: string | null
  post_url: string
  post_type: string | null
  posted_at: string | null
  likes_count: number
  comments_count: number
  engagement: number
}

export type InstagramRadarCompareActorRow = {
  actor: PoliticalActorWithTerms
  instagramUsername: string | null
  postCount: number
  postsPerWeek: number
  reelCount: number
  avgLikes: number
  avgComments: number
  avgEngagement: number
  topPost: InstagramRadarComparePostRow | null
  posts: InstagramRadarPostWithActor[]
}

function isReelPost(post: InstagramRadarPostWithActor): boolean {
  const type = post.post_type?.toLowerCase() ?? ''
  if (type.includes('reel')) return true
  return post.post_url.includes('/reel/')
}

function daysInWindow(lookbackDays: number): number {
  return Math.max(1, lookbackDays)
}

export function buildInstagramRadarCompareRows(
  actors: PoliticalActorWithTerms[],
  posts: InstagramRadarPostWithActor[],
  lookbackDays: number
): InstagramRadarCompareActorRow[] {
  const bySlug = new Map<string, InstagramRadarPostWithActor[]>()
  for (const post of posts) {
    const slug = post.political_actors?.slug
    if (!slug) continue
    const arr = bySlug.get(slug) ?? []
    arr.push(post)
    bySlug.set(slug, arr)
  }

  const weeks = daysInWindow(lookbackDays) / 7

  const rows: InstagramRadarCompareActorRow[] = actors
    .filter((a) => a.active)
    .map((actor) => {
      const actorPosts = [...(bySlug.get(actor.slug) ?? [])].sort((a, b) => {
        const da = a.posted_at ?? a.collected_at
        const db = b.posted_at ?? b.collected_at
        return db.localeCompare(da)
      })

      const count = actorPosts.length
      const totalLikes = actorPosts.reduce((s, p) => s + p.likes_count, 0)
      const totalComments = actorPosts.reduce((s, p) => s + p.comments_count, 0)
      const reelCount = actorPosts.filter(isReelPost).length

      const top = [...actorPosts].sort(
        (a, b) => b.likes_count + b.comments_count - (a.likes_count + a.comments_count)
      )[0]

      const topPost: InstagramRadarComparePostRow | null = top
        ? {
            post_id: top.post_id,
            caption: top.caption,
            post_url: top.post_url,
            post_type: top.post_type,
            posted_at: top.posted_at,
            likes_count: top.likes_count,
            comments_count: top.comments_count,
            engagement: top.likes_count + top.comments_count,
          }
        : null

      return {
        actor,
        instagramUsername: actor.instagram_username ?? null,
        postCount: count,
        postsPerWeek: weeks > 0 ? count / weeks : count,
        reelCount,
        avgLikes: count > 0 ? Math.round(totalLikes / count) : 0,
        avgComments: count > 0 ? Math.round(totalComments / count) : 0,
        avgEngagement: count > 0 ? Math.round((totalLikes + totalComments) / count) : 0,
        topPost,
        posts: actorPosts,
      }
    })

  return rows.sort((a, b) => b.postCount - a.postCount)
}

export function getInstagramRadarBudgetSummary() {
  const maxActors = getInstagramRadarMaxActors()
  const postsPerProfile = getInstagramRadarPostsLimit()
  const maxPosts = maxActors * postsPerProfile
  const estimatedCostPerRunUsd = estimateInstagramRadarCostUsd(maxPosts)
  return {
    maxActors,
    postsPerProfile,
    maxChargeUsd: getInstagramRadarMaxChargeUsd(),
    estimatedCostPerRunUsd: Math.round(estimatedCostPerRunUsd * 1000) / 1000,
    estimatedMonthlyUsd: Math.round(estimatedCostPerRunUsd * 4 * 1000) / 1000,
    freeMonthlyUsd: APIFY_FREE_MONTHLY_USD,
  }
}
