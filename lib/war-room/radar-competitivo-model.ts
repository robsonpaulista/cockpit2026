import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import {
  classifyInstagramRadarFormat,
  instagramRadarContentMix,
} from '@/lib/instagram-radar-post-classify'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { buildTopCandidatosEngajamentoDiario } from '@/lib/war-room/instagram-candidatos-engajamento'

export type RadarCommenterStatsInput = {
  politicoId: string
  uniqueCommenters: number
  commentsSampled: number
  postsWithComments: number
}

/** Paleta de séries — família Cockpit (petróleo / azul / coral). */
export const RADAR_COMPETITIVO_COLORS = [
  '#F04B23', // coral accent
  '#005B8F', // azul institucional
  '#022B3A', // petróleo
  '#1A6F97', // azul-petróleo
  '#C95A3C', // coral atenuado
  '#0A4A63', // petróleo profundo
  '#3D8BB0', // azul médio
  '#6B7C86', // aço auxiliar
  '#8E4A38', // terracotta institucional
] as const

const DEFAULT_HIDDEN = new Set(['instagram-causa-animal'])

export type RadarContentMix = {
  image: number
  reels: number
  carousel: number
}

export type RadarFormatKey = 'image' | 'reels' | 'carousel'

export type RadarFormatPerf = {
  count: number
  avgEngagement: number
  totalEngagement: number
}

export type RadarFormatPerfMap = Record<RadarFormatKey, RadarFormatPerf>

export type RadarFormatLeader = {
  format: RadarFormatKey
  label: string
  slug: string
  name: string
  avatarUrl: string | null
  avgEngagement: number
  postCount: number
}

export type RadarCompetitivoCandidate = {
  id: string
  slug: string
  name: string
  username: string | null
  avatarUrl: string | null
  color: string
  rank: number
  audience: number
  avgEngagement: number
  avgReelViews: number
  avgComments: number
  reelsShare: number
  efficiency: number
  contentMix: RadarContentMix
  /** Engajamento médio/post por tipo (mesmos buckets do DNA). */
  formatPerf: RadarFormatPerfMap
  /** % do engajamento total vindo de cada formato (soma 100). */
  formatEngShare: RadarContentMix
  recentPerformance: number[]
  /** Posts no período (todos os formatos). */
  postCount: number
  /** Contas únicas que comentaram (amostra Apify). */
  uniqueCommenters: number
  /** Comentários coletados na amostra. */
  commentsSampled: number
  /**
   * Intensidade de recorrência: comentários amostrados / contas únicas.
   * Alto = mesmas contas comentando mais; baixo = mais diversidade.
   */
  commentsPerUnique: number
}

export type RadarCompetitivoTopPost = {
  id: string
  rank: number
  slug: string
  name: string
  username: string | null
  avatarUrl: string | null
  color: string
  thumbnailUrl: string | null
  postUrl: string
  viewsProxy: number
  engagement: number
  caption: string | null
}

export type RadarCompetitivoModel = {
  candidates: RadarCompetitivoCandidate[]
  pulseDates: string[]
  pulseLabels: string[]
  pulseSeries: Array<{
    slug: string
    name: string
    color: string
    values: number[]
    /** Engajamento médio/post no período (legenda). */
    average: number
  }>
  topPosts: RadarCompetitivoTopPost[]
  /** Máximos de engajamento médio por formato (escala das barras). */
  formatPerfMax: RadarFormatPerfMap
  formatLeaders: RadarFormatLeader[]
  winners: {
    audienceSlug: string | null
    engagementSlug: string | null
    reelsSlug: string | null
    commentsSlug: string | null
    efficiencySlug: string | null
  }
  empty: boolean
}

function dnaFormatBucket(
  post: { post_type?: string | null; post_url?: string | null },
): RadarFormatKey {
  const format = classifyInstagramRadarFormat(post)
  if (format === 'carousel') return 'carousel'
  if (format === 'reel' || format === 'video') return 'reels'
  return 'image'
}

function buildFormatPerf(
  posts: Array<{
    post_type?: string | null
    post_url?: string | null
    likes_count: number
    comments_count: number
  }>,
): RadarFormatPerfMap {
  const buckets: Record<RadarFormatKey, { n: number; eng: number }> = {
    image: { n: 0, eng: 0 },
    reels: { n: 0, eng: 0 },
    carousel: { n: 0, eng: 0 },
  }
  for (const p of posts) {
    const key = dnaFormatBucket(p)
    buckets[key].n += 1
    buckets[key].eng += p.likes_count + p.comments_count
  }
  const toPerf = (b: { n: number; eng: number }): RadarFormatPerf => ({
    count: b.n,
    avgEngagement: b.n > 0 ? Math.round(b.eng / b.n) : 0,
    totalEngagement: b.eng,
  })
  return {
    image: toPerf(buckets.image),
    reels: toPerf(buckets.reels),
    carousel: toPerf(buckets.carousel),
  }
}

/** Distribui % inteiros que somam 100 a partir do engajamento total por formato. */
function buildFormatEngShare(perf: RadarFormatPerfMap): RadarContentMix {
  const totals = [
    { key: 'image' as const, n: perf.image.totalEngagement },
    { key: 'reels' as const, n: perf.reels.totalEngagement },
    { key: 'carousel' as const, n: perf.carousel.totalEngagement },
  ]
  const sum = totals.reduce((s, t) => s + t.n, 0)
  if (sum <= 0) return { image: 0, reels: 0, carousel: 0 }

  const floors = totals.map((t) => ({
    key: t.key,
    pct: Math.floor((t.n / sum) * 100),
    frac: (t.n / sum) * 100 - Math.floor((t.n / sum) * 100),
  }))
  let rest = 100 - floors.reduce((s, f) => s + f.pct, 0)
  floors
    .slice()
    .sort((a, b) => b.frac - a.frac)
    .forEach((f) => {
      if (rest <= 0) return
      f.pct += 1
      rest -= 1
    })
  return {
    image: floors.find((f) => f.key === 'image')!.pct,
    reels: floors.find((f) => f.key === 'reels')!.pct,
    carousel: floors.find((f) => f.key === 'carousel')!.pct,
  }
}

const FORMAT_LABELS: Record<RadarFormatKey, string> = {
  image: 'Imagem',
  reels: 'Reels',
  carousel: 'Carrossel',
}

function emptyFormatPerf(): RadarFormatPerfMap {
  return {
    image: { count: 0, avgEngagement: 0, totalEngagement: 0 },
    reels: { count: 0, avgEngagement: 0, totalEngagement: 0 },
    carousel: { count: 0, avgEngagement: 0, totalEngagement: 0 },
  }
}

function argMax<T>(items: T[], score: (item: T) => number): T | null {
  if (items.length === 0) return null
  let best = items[0]!
  let bestScore = score(best)
  for (let i = 1; i < items.length; i++) {
    const item = items[i]!
    const s = score(item)
    if (s > bestScore) {
      best = item
      bestScore = s
    }
  }
  return best
}

/**
 * Radar Competitivo — Jadyel (Graph) + concorrentes (Apify) na mesma tabela.
 */
export function buildRadarCompetitivoModel(opts: {
  actors: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  days: number
  maxCandidates?: number
  hiddenSlugs?: Set<string>
  commenterStats?: RadarCommenterStatsInput[]
}): RadarCompetitivoModel {
  const {
    actors,
    posts,
    days,
    maxCandidates = 9,
    hiddenSlugs = DEFAULT_HIDDEN,
    commenterStats = [],
  } = opts

  const statsByPolitico = new Map(
    commenterStats.map((s) => [s.politicoId, s] as const),
  )

  const active = actors.filter((a) => a.active && !hiddenSlugs.has(a.slug))
  const compareRows = buildInstagramRadarCompareRows(active, posts, days)
    .map((row) => {
      const engagementTotal = row.posts.reduce(
        (s, p) => s + p.likes_count + p.comments_count,
        0,
      )
      return { row, engagementTotal }
    })
    .sort((a, b) => b.engagementTotal - a.engagementTotal)
    .slice(0, maxCandidates)

  if (compareRows.length === 0) {
    return {
      candidates: [],
      pulseDates: [],
      pulseLabels: [],
      pulseSeries: [],
      topPosts: [],
      formatPerfMax: emptyFormatPerf(),
      formatLeaders: [],
      winners: {
        audienceSlug: null,
        engagementSlug: null,
        reelsSlug: null,
        commentsSlug: null,
        efficiencySlug: null,
      },
      empty: true,
    }
  }

  const engajoDiario = buildTopCandidatosEngajamentoDiario({
    actors: active,
    posts,
    days,
    hiddenSlugs,
  })

  const dates = engajoDiario.chartData.map((d) => d.date)
  const labels = engajoDiario.chartData.map((d) => d.label)
  const maxAudience = Math.max(...compareRows.map((c) => c.engagementTotal), 1)

  const candidates: RadarCompetitivoCandidate[] = compareRows.map((entry, index) => {
    const { row, engagementTotal } = entry
    const color =
      RADAR_COMPETITIVO_COLORS[index % RADAR_COMPETITIVO_COLORS.length] ?? '#005B8F'
    const mix = instagramRadarContentMix(row.posts)
    const formatPerf = buildFormatPerf(row.posts)
    const formatEngShare = buildFormatEngShare(formatPerf)
    const stats = statsByPolitico.get(row.actor.id)
    const uniqueCommenters = stats?.uniqueCommenters ?? 0
    const commentsSampled = stats?.commentsSampled ?? 0
    const reelsShare =
      row.postCount > 0 ? Math.round((row.reelCount / row.postCount) * 100) : 0
    const efficiency =
      maxAudience > 0 ? (row.avgEngagement / maxAudience) * 100 * 10 : 0

    const series = dates.map((date) => {
      const point = engajoDiario.chartData.find((d) => d.date === date)
      const v = point?.[row.actor.slug]
      return typeof v === 'number' ? v : 0
    })

    return {
      id: row.actor.id,
      slug: row.actor.slug,
      name: row.actor.name,
      username: row.instagramUsername,
      avatarUrl: row.actor.instagram_avatar_url ?? null,
      color,
      rank: index + 1,
      audience: engagementTotal,
      avgEngagement: row.avgEngagement,
      avgReelViews: row.avgReelViews,
      avgComments: row.avgComments,
      reelsShare: mix.reels > 0 ? mix.reels : reelsShare,
      efficiency: Math.round(efficiency * 100) / 100,
      contentMix: mix,
      formatPerf,
      formatEngShare,
      recentPerformance: series,
      postCount: row.postCount,
      uniqueCommenters,
      commentsSampled,
      commentsPerUnique:
        uniqueCommenters > 0
          ? Math.round((commentsSampled / uniqueCommenters) * 10) / 10
          : 0,
    }
  })

  const formatPerfMax: RadarFormatPerfMap = {
    image: {
      count: 0,
      avgEngagement: Math.max(...candidates.map((c) => c.formatPerf.image.avgEngagement), 1),
      totalEngagement: 0,
    },
    reels: {
      count: 0,
      avgEngagement: Math.max(...candidates.map((c) => c.formatPerf.reels.avgEngagement), 1),
      totalEngagement: 0,
    },
    carousel: {
      count: 0,
      avgEngagement: Math.max(...candidates.map((c) => c.formatPerf.carousel.avgEngagement), 1),
      totalEngagement: 0,
    },
  }

  const formatLeaders: RadarFormatLeader[] = (['image', 'reels', 'carousel'] as const).map(
    (format) => {
      const best = argMax(candidates, (c) => c.formatPerf[format].avgEngagement)
      return {
        format,
        label: FORMAT_LABELS[format],
        slug: best?.slug ?? '',
        name: best?.name ?? '—',
        avatarUrl: best?.avatarUrl ?? null,
        avgEngagement: best?.formatPerf[format].avgEngagement ?? 0,
        postCount: best?.formatPerf[format].count ?? 0,
      }
    },
  )

  const slugSet = new Set(candidates.map((c) => c.slug))
  const pulseSeries = candidates.map((c) => ({
    slug: c.slug,
    name: c.name,
    color: c.color,
    values: c.recentPerformance,
    average: c.avgEngagement,
  }))

  const scoredPosts = posts
    .filter((p) => {
      const slug = p.political_actors?.slug
      return slug != null && slugSet.has(slug)
    })
    .map((p) => {
      const slug = p.political_actors!.slug
      const cand = candidates.find((c) => c.slug === slug)!
      const views = Number(p.views_count ?? 0) || 0
      return {
        post: p,
        engagement: p.likes_count + p.comments_count,
        viewsProxy: views > 0 ? views : p.likes_count,
        cand,
      }
    })
    .sort((a, b) => b.engagement - a.engagement)

  /** Rodízio: melhor post de cada candidato, depois 2º melhor, até 8 — confronto entre todos. */
  const universePosts: typeof scoredPosts = []
  const usedIds = new Set<string>()
  let round = 0
  while (universePosts.length < 8 && round < 6) {
    const bySlug = new Map<string, (typeof scoredPosts)[number]>()
    for (const entry of scoredPosts) {
      if (usedIds.has(entry.post.post_id)) continue
      const prev = bySlug.get(entry.cand.slug)
      if (!prev || entry.engagement > prev.engagement) {
        bySlug.set(entry.cand.slug, entry)
      }
    }
    const roundPick = [...bySlug.values()].sort((a, b) => b.engagement - a.engagement)
    if (roundPick.length === 0) break
    for (const entry of roundPick) {
      if (universePosts.length >= 8) break
      universePosts.push(entry)
      usedIds.add(entry.post.post_id)
    }
    round += 1
  }

  const topPosts: RadarCompetitivoTopPost[] = universePosts.map((entry, i) => ({
    id: entry.post.post_id,
    rank: i + 1,
    slug: entry.cand.slug,
    name: entry.cand.name,
    username: entry.cand.username,
    avatarUrl: entry.cand.avatarUrl,
    color: entry.cand.color,
    thumbnailUrl: entry.post.thumbnail_url,
    postUrl: entry.post.post_url,
    viewsProxy: entry.viewsProxy,
    engagement: entry.engagement,
    caption: entry.post.caption,
  }))

  const winAudience = argMax(candidates, (c) => c.audience)
  const winEngagement = argMax(candidates, (c) => c.avgEngagement)
  const winReels = argMax(candidates, (c) => c.reelsShare)
  const winComments = argMax(candidates, (c) => c.avgComments)
  const winEfficiency = argMax(candidates, (c) => c.efficiency)

  return {
    candidates,
    pulseDates: dates,
    pulseLabels: labels,
    pulseSeries,
    topPosts,
    formatPerfMax,
    formatLeaders,
    winners: {
      audienceSlug: winAudience?.slug ?? null,
      engagementSlug: winEngagement?.slug ?? null,
      reelsSlug: winReels?.slug ?? null,
      commentsSlug: winComments?.slug ?? null,
      efficiencySlug: winEfficiency?.slug ?? null,
    },
    empty: false,
  }
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })} mi`
  }
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })} mil`
  }
  return n.toLocaleString('pt-BR')
}
