import {
  detectMunicipioFromInstagramCaption,
  type InstagramCaptionMunicipioMatch,
} from '@/lib/instagram-caption-municipio'

export type InstagramPostForCityStats = {
  id: string
  caption?: string | null
  metrics: {
    likes?: number
    comments?: number
    views?: number
    shares?: number
    saves?: number
    engagement?: number
  }
}

export type InstagramCityCaptionStats = {
  municipio: string
  posts: number
  likes: number
  comments: number
  views: number
  shares: number
  saves: number
  engagement: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgShares: number
  avgSaves: number
  avgEngagement: number
  /** Quantos posts casaram pelo header vs corpo da legenda. */
  matchedFromHeader: number
  matchedFromCaption: number
}

export type InstagramCityCaptionAggregate = {
  cities: InstagramCityCaptionStats[]
  postsWithCity: number
  postsWithoutCity: number
  postsTotal: number
}

function emptyCity(municipio: string): InstagramCityCaptionStats {
  return {
    municipio,
    posts: 0,
    likes: 0,
    comments: 0,
    views: 0,
    shares: 0,
    saves: 0,
    engagement: 0,
    avgLikes: 0,
    avgComments: 0,
    avgViews: 0,
    avgShares: 0,
    avgSaves: 0,
    avgEngagement: 0,
    matchedFromHeader: 0,
    matchedFromCaption: 0,
  }
}

function finalizeCity(stats: InstagramCityCaptionStats): InstagramCityCaptionStats {
  const n = stats.posts
  return {
    ...stats,
    avgLikes: n > 0 ? Math.round(stats.likes / n) : 0,
    avgComments: n > 0 ? Math.round(stats.comments / n) : 0,
    avgViews: n > 0 ? Math.round(stats.views / n) : 0,
    avgShares: n > 0 ? Math.round(stats.shares / n) : 0,
    avgSaves: n > 0 ? Math.round(stats.saves / n) : 0,
    avgEngagement: n > 0 ? Math.round(stats.engagement / n) : 0,
  }
}

/**
 * Agrega curtidas, comentários, views, shares, saves e engajamento
 * por município detectado na legenda (header preferencial).
 */
export function aggregateInstagramMetricsByCaptionCity(
  posts: InstagramPostForCityStats[],
): InstagramCityCaptionAggregate {
  const byCity = new Map<string, InstagramCityCaptionStats>()
  let postsWithCity = 0
  let postsWithoutCity = 0

  for (const post of posts) {
    const match: InstagramCaptionMunicipioMatch | null = detectMunicipioFromInstagramCaption(
      post.caption,
    )
    if (!match) {
      postsWithoutCity += 1
      continue
    }

    postsWithCity += 1
    const key = match.municipio
    const row = byCity.get(key) ?? emptyCity(key)
    row.posts += 1
    row.likes += post.metrics.likes ?? 0
    row.comments += post.metrics.comments ?? 0
    row.views += post.metrics.views ?? 0
    row.shares += post.metrics.shares ?? 0
    row.saves += post.metrics.saves ?? 0
    row.engagement +=
      post.metrics.engagement ??
      (post.metrics.likes ?? 0) +
        (post.metrics.comments ?? 0) * 2 +
        (post.metrics.shares ?? 0) * 3
    if (match.source === 'header') row.matchedFromHeader += 1
    else row.matchedFromCaption += 1
    byCity.set(key, row)
  }

  const cities = [...byCity.values()]
    .map(finalizeCity)
    .sort((a, b) => {
      if (b.engagement !== a.engagement) return b.engagement - a.engagement
      if (b.posts !== a.posts) return b.posts - a.posts
      return a.municipio.localeCompare(b.municipio, 'pt-BR')
    })

  return {
    cities,
    postsWithCity,
    postsWithoutCity,
    postsTotal: posts.length,
  }
}
