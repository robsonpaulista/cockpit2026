import {
  detectMunicipioFromInstagramCaption,
  type InstagramCaptionMunicipioMatch,
} from '@/lib/instagram-caption-municipio'

export type InstagramPostForCityStats = {
  id: string
  caption?: string | null
  postedAt?: string | null
  metrics: {
    likes?: number
    comments?: number
    views?: number
    shares?: number
    saves?: number
    engagement?: number
  }
}

export type InstagramCityCaptionPostPoint = {
  postId: string
  postedAt: string
  engagement: number
  likes: number
  comments: number
  views: number
  saves: number
  /** Posts acumulados neste dia (após agregação). */
  postsInDay?: number
}

function localDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function aggregateSeriesByLocalDay(
  series: InstagramCityCaptionPostPoint[],
): InstagramCityCaptionPostPoint[] {
  const byDay = new Map<string, InstagramCityCaptionPostPoint>()
  for (const point of series) {
    const day = localDayKey(point.postedAt)
    const current = byDay.get(day)
    if (!current) {
      byDay.set(day, {
        ...point,
        postedAt: `${day}T12:00:00`,
        postsInDay: 1,
      })
      continue
    }
    current.engagement += point.engagement
    current.likes += point.likes
    current.comments += point.comments
    current.views += point.views
    current.saves += point.saves
    current.postsInDay = (current.postsInDay ?? 1) + 1
    current.postId = `${current.postId},${point.postId}`
  }
  return [...byDay.values()].sort(
    (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
  )
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
  /** Posts no tempo (mais antigo → mais recente) para o gráfico de linha. */
  series: InstagramCityCaptionPostPoint[]
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
    series: [],
  }
}

function finalizeCity(stats: InstagramCityCaptionStats): InstagramCityCaptionStats {
  const n = stats.posts
  const series = aggregateSeriesByLocalDay(stats.series)
  return {
    ...stats,
    series,
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
    const likes = post.metrics.likes ?? 0
    const comments = post.metrics.comments ?? 0
    const views = post.metrics.views ?? 0
    const shares = post.metrics.shares ?? 0
    const saves = post.metrics.saves ?? 0
    const engagement =
      post.metrics.engagement ?? likes + comments * 2 + shares * 3
    row.posts += 1
    row.likes += likes
    row.comments += comments
    row.views += views
    row.shares += shares
    row.saves += saves
    row.engagement += engagement
    const postedAt = post.postedAt?.trim()
    if (postedAt) {
      row.series.push({
        postId: post.id,
        postedAt,
        engagement,
        likes,
        comments,
        views,
        saves,
      })
    }
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
