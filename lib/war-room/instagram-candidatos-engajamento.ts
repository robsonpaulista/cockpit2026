import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { buildPanoramaHeatmapActorColumns } from '@/lib/monitoramento-panorama'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { formatDataCurta } from '@/lib/war-room/redes-copiloto'

export type CandidatoEngajamentoLine = {
  slug: string
  name: string
  color: string
}

export type CandidatosEngajamentoChartModel = {
  lines: CandidatoEngajamentoLine[]
  chartData: Array<{ date: string; label: string } & Record<string, number>>
  empty: boolean
}

const DEFAULT_HIDDEN = new Set(['instagram-causa-animal'])

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function lastNDays(n: number): string[] {
  const dates: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setUTCHours(12, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

/**
 * Candidatos · engajamento diário (likes + comments).
 * Ordena pelo engajamento total do período (maior → menor).
 * Inclui todos os atores ativos (exceto hidden). `topN` opcional limita o ranking.
 */
export function buildTopCandidatosEngajamentoDiario(opts: {
  actors: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  days: number
  /** Se definido, limita aos N com maior engajamento total. */
  topN?: number
  hiddenSlugs?: Set<string>
}): CandidatosEngajamentoChartModel {
  const {
    actors,
    posts,
    days,
    topN,
    hiddenSlugs = DEFAULT_HIDDEN,
  } = opts

  const activeActors = actors.filter((a) => a.active && !hiddenSlugs.has(a.slug))
  const colorBySlug = new Map(
    buildPanoramaHeatmapActorColumns(activeActors).map((c) => [c.slug, c.accentColor]),
  )

  let compareRows = buildInstagramRadarCompareRows(activeActors, posts, days).sort((a, b) => {
    const totalA = a.posts.reduce((sum, p) => sum + p.likes_count + p.comments_count, 0)
    const totalB = b.posts.reduce((sum, p) => sum + p.likes_count + p.comments_count, 0)
    return totalB - totalA
  })
  if (typeof topN === 'number' && topN > 0) {
    compareRows = compareRows.slice(0, topN)
  }

  const lines: CandidatoEngajamentoLine[] = compareRows.map((row) => ({
    slug: row.actor.slug,
    name: row.actor.name,
    color: colorBySlug.get(row.actor.slug) ?? '#6B7280',
  }))

  const dates = lastNDays(days)
  const lineSlugs = new Set(lines.map((l) => l.slug))
  const bySlugDate = new Map<string, number>()

  for (const post of posts) {
    const slug = post.political_actors?.slug
    if (!slug || !lineSlugs.has(slug) || !post.posted_at) continue
    const date = dayKey(post.posted_at)
    const key = `${slug}|${date}`
    const value = (post.likes_count ?? 0) + (post.comments_count ?? 0)
    bySlugDate.set(key, (bySlugDate.get(key) ?? 0) + value)
  }

  const chartData = dates.map((date) => {
    const row = {
      date,
      label: formatDataCurta(`${date}T12:00:00`),
    } as { date: string; label: string } & Record<string, number>
    for (const line of lines) {
      row[line.slug] = bySlugDate.get(`${line.slug}|${date}`) ?? 0
    }
    return row
  })

  return {
    lines,
    chartData,
    empty: lines.length === 0,
  }
}
