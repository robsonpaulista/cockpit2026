import type { PostComMetricas } from '@/lib/conteudo-redes-theme-stats'
import { resolveInstagramBusinessAccount } from '@/lib/instagram-graph'

type RawMediaPost = {  id: string
  caption?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
  media_type?: string
}

export function getInstagramEnvCredentials(): { token: string; businessAccountId: string } | null {
  const token = process.env.INSTAGRAM_TOKEN?.trim() ?? ''
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ID?.trim() ?? ''
  if (!token || !businessAccountId) return null
  return { token, businessAccountId }
}

function resolveCredentials(opts?: {
  token?: string
  businessAccountId?: string
}): { token: string; businessAccountId: string } | null {
  const token = opts?.token?.trim() || process.env.INSTAGRAM_TOKEN?.trim() || ''
  const businessAccountId =
    opts?.businessAccountId?.trim() || process.env.INSTAGRAM_BUSINESS_ID?.trim() || ''
  if (!token || !businessAccountId) return null
  return { token, businessAccountId }
}
async function fetchMediaList(
  igAccountId: string,
  token: string,
  limit: number
): Promise<RawMediaPost[]> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}/media?fields=id,caption,timestamp,like_count,comments_count,media_type&limit=${limit}&access_token=${token}`
  )
  if (!mediaResponse.ok) {
    const err = await mediaResponse.json().catch(() => ({}))
    console.error('[instagram-graph-server] media', err)
    return []
  }
  const mediaData = (await mediaResponse.json()) as { data?: RawMediaPost[] }
  return mediaData.data ?? []
}

async function fetchPostViews(
  postId: string,
  token: string,
  mediaType?: string
): Promise<number> {
  const metricsToTry =
    mediaType === 'VIDEO' ? ['video_views', 'impressions', 'reach'] : ['impressions', 'reach']
  for (const metric of metricsToTry) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/insights?metric=${metric}&access_token=${token}`
      )
      if (!res.ok) continue
      const data = (await res.json()) as {
        data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>
      }
      const row = data.data?.find((m) => m.name === metric)
      const raw = row?.values?.[0]?.value ?? row?.value
      const n = raw != null ? Number(raw) : 0
      if (n > 0) return n
    } catch {
      // próxima métrica
    }
  }
  return 0
}

async function fetchPostSavesShares(
  postId: string,
  token: string
): Promise<{ saves: number; shares: number }> {
  let saves = 0
  let shares = 0
  try {
    const savesRes = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=saved&access_token=${token}`
    )
    if (savesRes.ok) {
      const data = (await savesRes.json()) as {
        data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>
      }
      const row = data.data?.find((m) => m.name === 'saved')
      const raw = row?.values?.[0]?.value ?? row?.value
      saves = raw != null ? Number(raw) || 0 : 0
    }
  } catch {
    /* ignore */
  }
  try {
    const sharesRes = await fetch(
      `https://graph.facebook.com/v18.0/${postId}/insights?metric=shares&access_token=${token}`
    )
    if (sharesRes.ok) {
      const data = (await sharesRes.json()) as {
        data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }>
      }
      const row = data.data?.find((m) => m.name === 'shares')
      const raw = row?.values?.[0]?.value ?? row?.value
      shares = raw != null ? Number(raw) || 0 : 0
    }
  } catch {
    /* ignore */
  }
  return { saves, shares }
}

/** Busca posts para estatísticas por tema (mesma base da página Redes & Instagram). */
export async function fetchInstagramPostsForThemeStats(opts?: {
  mediaLimit?: number
  insightsPostLimit?: number
  token?: string
  businessAccountId?: string
}): Promise<{ posts: PostComMetricas[]; error?: string }> {
  const creds = resolveCredentials(opts)
  if (!creds) {
    return {
      posts: [],
      error:
        'Credenciais do Instagram ausentes — configure em Redes & Instagram ou defina INSTAGRAM_TOKEN e INSTAGRAM_BUSINESS_ID no servidor',
    }
  }

  const mediaLimit = opts?.mediaLimit ?? 50
  const insightsPostLimit = opts?.insightsPostLimit ?? 20

  let igId: string
  try {
    const resolved = await resolveInstagramBusinessAccount(
      creds.businessAccountId,
      creds.token
    )
    igId = resolved.instagramBusinessId
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao resolver conta Instagram'
    return { posts: [], error: msg }
  }
  const rawPosts = await fetchMediaList(igId, creds.token, mediaLimit)
  if (rawPosts.length === 0) {
    return { posts: [], error: 'Nenhuma publicação retornada pela API do Instagram' }
  }

  const postsForInsights = rawPosts.slice(0, insightsPostLimit)

  const insightsMap = new Map<string, { views: number; saves: number; shares: number }>()

  const BATCH = 5
  for (let i = 0; i < postsForInsights.length; i += BATCH) {
    const chunk = postsForInsights.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (post) => {
        const [views, extra] = await Promise.all([
          fetchPostViews(post.id, creds.token, post.media_type),
          fetchPostSavesShares(post.id, creds.token),
        ])
        insightsMap.set(post.id, { views, ...extra })
      })
    )
  }

  const posts: PostComMetricas[] = rawPosts.map((post) => {
    const likes = post.like_count ?? 0
    const comments = post.comments_count ?? 0
    const extra = insightsMap.get(post.id)
    return {
      id: post.id,
      postedAt: post.timestamp ?? '',
      caption: post.caption ?? '',
      metrics: {
        likes,
        comments,
        views: extra?.views ?? 0,
        shares: extra?.shares ?? 0,
        saves: extra?.saves ?? 0,
        engagement: likes + comments,
      },
    }
  })

  return { posts }
}
