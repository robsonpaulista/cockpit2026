import { createClient } from '@/lib/supabase/server'
import { fetchInstagramPostsForThemeStats } from '@/lib/instagram-graph-server'
import { getLatestInstagramPostMetrics } from '@/lib/instagram-snapshot-server'
import {
  formatInstagramPostsReport,
  type InstagramPostReportRow,
  type InstagramPostsMetric,
} from '@/lib/instagram-posts-report'
import {
  isInstagramSinglePostQuery,
  parseInstagramPostsMetric,
} from '@/lib/agent/detect-instagram-posts'

function parseMetricArg(raw?: string): InstagramPostsMetric {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === 'likes' || value === 'curtidas') return 'likes'
  if (value === 'comments' || value === 'comentarios') return 'comments'
  if (value === 'views' || value === 'visualizacoes') return 'views'
  if (value === 'shares' || value === 'compartilhamentos') return 'shares'
  if (value === 'engagement' || value === 'engajamento') return 'engagement'
  return 'engagement'
}

async function loadPostsFromHistory(userId: string): Promise<InstagramPostReportRow[]> {
  const supabase = createClient()
  const records = await getLatestInstagramPostMetrics(supabase, userId)

  return records.map((post) => ({
    id: post.id,
    type: post.type,
    url: post.url,
    caption: post.caption,
    postedAt: post.postedAt,
    metrics: post.metrics,
  }))
}

async function loadPostsFromGraph(credentials?: {
  token?: string
  businessAccountId?: string
}): Promise<{ posts: InstagramPostReportRow[] }> {
  const { posts, error } = await fetchInstagramPostsForThemeStats({
    mediaLimit: 50,
    insightsPostLimit: 25,
    token: credentials?.token,
    businessAccountId: credentials?.businessAccountId,
  })

  if (error || posts.length === 0) {
    return { posts: [] }
  }

  return {
    posts: posts.map((post) => ({
      id: post.id,
      type: 'image',
      url: '',
      caption: post.caption,
      postedAt: post.postedAt,
      metrics: {
        likes: post.metrics.likes,
        comments: post.metrics.comments,
        shares: post.metrics.shares ?? 0,
        saves: post.metrics.saves ?? 0,
        views: post.metrics.views ?? 0,
        engagement: post.metrics.engagement,
      },
    })),
  }
}

export async function toolConsultarInstagramPosts(
  userId: string,
  args: Record<string, string>,
  queryHint?: string,
  credentials?: { token?: string; businessAccountId?: string }
): Promise<string | null> {
  const metric = args.metrica
    ? parseMetricArg(args.metrica)
    : parseInstagramPostsMetric(queryHint ?? '')
  const highlightSingle =
    args.modo === 'destaque' || isInstagramSinglePostQuery(queryHint ?? '')

  let posts: InstagramPostReportRow[] = []

  try {
    posts = await loadPostsFromHistory(userId)
  } catch {
    posts = []
  }

  if (posts.length === 0) {
    const graph = await loadPostsFromGraph(credentials)
    if (graph.posts.length === 0) {
      return null
    }
    posts = graph.posts
  }

  return formatInstagramPostsReport({
    posts,
    metric,
    limit: highlightSingle ? 4 : 5,
    highlightSingle,
  })
}
