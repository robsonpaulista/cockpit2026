import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { buildPanoramaHeatmapActorColumns } from '@/lib/monitoramento-panorama'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { formatDataCurta } from '@/lib/war-room/redes-copiloto'

export type CandidatoEngajamentoLine = {
  slug: string
  name: string
  color: string
  avatarUrl: string | null
  username: string | null
  actorTypeLabel: string
  /** Engajamento (likes+comments) no dia de hoje (UTC). */
  todayEngagement: number
  yesterdayEngagement: number
  /** Total no período do gráfico. */
  periodEngagement: number
  /** Variação % hoje vs ontem (null se ontem = 0 e hoje = 0). */
  deltaPct: number | null
}

export type CandidatosEngajamentoChartModel = {
  lines: CandidatoEngajamentoLine[]
  chartData: Array<{ date: string; label: string } & Record<string, number>>
  empty: boolean
  /** Maior engajamento de hoje entre os candidatos. */
  todayMax: number
  /** Maior engajamento em qualquer dia (escala da timeline). */
  dayMax: number
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

function actorTypeLabel(type: string): string {
  switch (type) {
    case 'own_candidate':
      return 'Candidato'
    case 'competitor':
      return 'Concorrente'
    case 'ally':
      return 'Aliado'
    default:
      return 'Monitorado'
  }
}

function deltaPercent(today: number, yesterday: number): number | null {
  if (yesterday <= 0 && today <= 0) return null
  if (yesterday <= 0) return today > 0 ? 100 : null
  return ((today - yesterday) / yesterday) * 100
}

/**
 * Candidatos · engajamento diário (likes + comments).
 * Ordena pelo engajamento de hoje (maior → menor).
 * Inclui todos os atores ativos (exceto hidden). `topN` opcional limita o ranking.
 */
export function buildTopCandidatosEngajamentoDiario(opts: {
  actors: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  days: number
  /** Se definido, limita aos N com maior engajamento total do período. */
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

  const dates = lastNDays(days)
  const today = dates[dates.length - 1] ?? dayKey(new Date().toISOString())
  const yesterday =
    dates.length >= 2 ? dates[dates.length - 2]! : today

  const lineSlugs = new Set(compareRows.map((r) => r.actor.slug))
  const bySlugDate = new Map<string, number>()

  for (const post of posts) {
    const slug = post.political_actors?.slug
    if (!slug || !lineSlugs.has(slug) || !post.posted_at) continue
    const date = dayKey(post.posted_at)
    const key = `${slug}|${date}`
    const value = (post.likes_count ?? 0) + (post.comments_count ?? 0)
    bySlugDate.set(key, (bySlugDate.get(key) ?? 0) + value)
  }

  const lines: CandidatoEngajamentoLine[] = compareRows.map((row) => {
    const slug = row.actor.slug
    let periodEngagement = 0
    for (const date of dates) {
      periodEngagement += bySlugDate.get(`${slug}|${date}`) ?? 0
    }
    const todayEngagement = bySlugDate.get(`${slug}|${today}`) ?? 0
    const yesterdayEngagement = bySlugDate.get(`${slug}|${yesterday}`) ?? 0

    return {
      slug,
      name: row.actor.name,
      color: colorBySlug.get(slug) ?? '#6F6F6B',
      avatarUrl: row.actor.instagram_avatar_url ?? null,
      username: row.instagramUsername,
      actorTypeLabel: actorTypeLabel(row.actor.actor_type),
      todayEngagement,
      yesterdayEngagement,
      periodEngagement,
      deltaPct: deltaPercent(todayEngagement, yesterdayEngagement),
    }
  })

  lines.sort((a, b) => b.todayEngagement - a.todayEngagement || b.periodEngagement - a.periodEngagement)

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

  const todayMax = lines.reduce((max, line) => Math.max(max, line.todayEngagement), 0)
  let dayMax = 0
  for (const row of chartData) {
    for (const line of lines) {
      dayMax = Math.max(dayMax, Number(row[line.slug] ?? 0) || 0)
    }
  }

  return {
    lines,
    chartData,
    empty: lines.length === 0,
    todayMax,
    dayMax,
  }
}
