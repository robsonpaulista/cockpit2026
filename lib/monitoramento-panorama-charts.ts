import { buildGoogleTrendsSeries } from '@/lib/google-trends-aggregate'
import { buildInstagramRadarCompareRows } from '@/lib/instagram-radar-aggregate'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { GoogleTrendsInterestRow } from '@/lib/google-trends-types'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import type { GoogleTrendsSearchContext } from '@/lib/google-trends-types'
import type { PanoramaCandidateColumn, PanoramaHighlight } from '@/lib/monitoramento-panorama'
import {
  PANORAMA_WINDOW_DAYS,
  panoramaWindowSubtitleSuffix,
} from '@/lib/monitoramento-panorama-window'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export type PanoramaPlatformId =
  | 'youtube'
  | 'google-news'
  | 'instagram'
  | 'google-trends'
  | 'meta-ads'

export type PanoramaChartLayoutTier = 'detail' | 'simple'

export type PanoramaChartLine = {
  slug: string
  name: string
  color: string
}

export type PanoramaHeatmapRow = {
  slug: string
  name: string
  color: string
  values: number[]
}

export type PanoramaMetaAdsPeriodTotal = {
  slug: string
  name: string
  color: string
  spendLabel: string
  impressionsLabel: string | null
}

export type PanoramaTrendsSearchHighlight = {
  slug: string
  name: string
  color: string
  context: GoogleTrendsSearchContext
}

export type PanoramaInstagramTableRow = {
  slug: string
  name: string
  color: string
  instagramUsername: string | null
  postCount: number
  postsPerWeek: number
  totalEngagement: number
  avgLikes: number
  avgComments: number
  avgEngagement: number
  highlights: {
    postCount: PanoramaHighlight
    totalEngagement: PanoramaHighlight
    avgEngagement: PanoramaHighlight
  }
}

export type PanoramaPlatformChart = {
  id: PanoramaPlatformId
  layoutTier: PanoramaChartLayoutTier
  title: string
  subtitle: string
  metricLabel: string
  chartType: 'line' | 'heatmap' | 'table'
  lines: PanoramaChartLine[]
  chartData: Array<{ date: string } & Record<string, number | string>>
  heatmapDates?: string[]
  heatmapRows?: PanoramaHeatmapRow[]
  instagramTable?: PanoramaInstagramTableRow[]
  periodTotals?: PanoramaMetaAdsPeriodTotal[]
  searchContexts?: PanoramaTrendsSearchHighlight[]
  empty: boolean
}

const CHART_WINDOW = PANORAMA_WINDOW_DAYS
const windowSuffix = panoramaWindowSubtitleSuffix()

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

function slugFromMention<T extends { political_actors?: { slug?: string } | null }>(
  item: T
): string | null {
  return item.political_actors?.slug ?? null
}

function buildDailyBuckets(
  dates: string[],
  columns: PanoramaCandidateColumn[],
  items: Array<{ slug: string; date: string; value: number }>
): Array<{ date: string } & Record<string, number | string>> {
  const bySlugDate = new Map<string, number>()
  for (const item of items) {
    const key = `${item.slug}|${item.date}`
    bySlugDate.set(key, (bySlugDate.get(key) ?? 0) + item.value)
  }

  return dates.map((date) => {
    const row: { date: string } & Record<string, number | string> = { date }
    for (const col of columns) {
      row[col.slug] = bySlugDate.get(`${col.slug}|${date}`) ?? 0
    }
    return row
  })
}

function chartHasData(
  chartData: Array<Record<string, number | string>>,
  columns: PanoramaCandidateColumn[]
): boolean {
  return chartData.some((row) => columns.some((c) => Number(row[c.slug] ?? 0) > 0))
}

function linesFromColumns(columns: PanoramaCandidateColumn[]): PanoramaChartLine[] {
  return columns.map((c) => ({ slug: c.slug, name: c.name, color: c.accentColor }))
}

function buildYoutubeChart(
  columns: PanoramaCandidateColumn[],
  mentions: YoutubeMentionWithActor[]
): PanoramaPlatformChart {
  const dates = lastNDays(CHART_WINDOW)
  const items: Array<{ slug: string; date: string; value: number }> = []

  for (const m of mentions) {
    if (!m.published_at) continue
    const slug = slugFromMention(m)
    if (!slug) continue
    items.push({ slug, date: dayKey(m.published_at), value: m.views ?? 0 })
  }

  const chartData = buildDailyBuckets(dates, columns, items)

  return {
    id: 'youtube',
    layoutTier: 'simple',
    title: 'YouTube',
    subtitle: `Visualizações por dia de publicação${windowSuffix}`,
    metricLabel: 'Views',
    chartType: 'line',
    lines: linesFromColumns(columns),
    chartData,
    empty: !chartHasData(chartData, columns),
  }
}

function buildGoogleNewsChart(
  columns: PanoramaCandidateColumn[],
  mentions: GoogleNewsMentionWithActor[]
): PanoramaPlatformChart {
  const dates = lastNDays(CHART_WINDOW)
  const items: Array<{ slug: string; date: string; value: number }> = []

  for (const m of mentions) {
    if (!m.published_at) continue
    const slug = slugFromMention(m)
    if (!slug) continue
    items.push({ slug, date: dayKey(m.published_at), value: 1 })
  }

  const chartData = buildDailyBuckets(dates, columns, items)
  const heatmapRows: PanoramaHeatmapRow[] = columns.map((col) => ({
    slug: col.slug,
    name: col.name,
    color: col.accentColor,
    values: dates.map((date) => Number(chartData.find((row) => row.date === date)?.[col.slug] ?? 0)),
  }))

  return {
    id: 'google-news',
    layoutTier: 'detail',
    title: 'Google News',
    subtitle: `Mapa de calor — menções por dia${windowSuffix}`,
    metricLabel: 'Matérias',
    chartType: 'heatmap',
    lines: linesFromColumns(columns),
    chartData,
    heatmapDates: dates,
    heatmapRows,
    empty: !chartHasData(chartData, columns),
  }
}

function rankMetricHighlights(values: number[], higherIsBetter = true): PanoramaHighlight[] {
  if (values.length < 2) return values.map(() => 'none')
  const max = Math.max(...values)
  const min = Math.min(...values)
  if (max === min) return values.map(() => 'none')
  return values.map((v) => {
    if (higherIsBetter && v === max) return 'best'
    if (!higherIsBetter && v === min) return 'best'
    if (higherIsBetter && v === min) return 'worst'
    if (!higherIsBetter && v === max) return 'worst'
    return 'none'
  })
}

function buildInstagramTable(
  columns: PanoramaCandidateColumn[],
  actors: PoliticalActorWithTerms[],
  posts: InstagramRadarPostWithActor[]
): PanoramaPlatformChart {
  const compareRows = buildInstagramRadarCompareRows(actors, posts, CHART_WINDOW)
  const colorBySlug = new Map(columns.map((c) => [c.slug, c.accentColor]))

  const draft = compareRows.map((row) => ({
    slug: row.actor.slug,
    name: row.actor.name,
    color: colorBySlug.get(row.actor.slug) ?? '#6B7280',
    instagramUsername: row.instagramUsername,
    postCount: row.postCount,
    postsPerWeek: row.postsPerWeek,
    totalEngagement: row.posts.reduce((sum, p) => sum + p.likes_count + p.comments_count, 0),
    avgLikes: row.avgLikes,
    avgComments: row.avgComments,
    avgEngagement: row.avgEngagement,
  }))

  const hPosts = rankMetricHighlights(draft.map((r) => r.postCount))
  const hTotal = rankMetricHighlights(draft.map((r) => r.totalEngagement))
  const hAvg = rankMetricHighlights(draft.map((r) => r.avgEngagement))

  const instagramTable: PanoramaInstagramTableRow[] = draft.map((row, i) => ({
    ...row,
    highlights: {
      postCount: hPosts[i],
      totalEngagement: hTotal[i],
      avgEngagement: hAvg[i],
    },
  }))

  const dates = lastNDays(CHART_WINDOW)
  const engagementItems: Array<{ slug: string; date: string; value: number }> = []
  for (const post of posts) {
    if (!post.posted_at) continue
    const slug = slugFromMention(post)
    if (!slug) continue
    engagementItems.push({
      slug,
      date: dayKey(post.posted_at),
      value: (post.likes_count ?? 0) + (post.comments_count ?? 0),
    })
  }
  const chartData = buildDailyBuckets(dates, columns, engagementItems)

  const hasData = instagramTable.some((r) => r.postCount > 0)

  return {
    id: 'instagram',
    layoutTier: 'detail',
    title: 'Instagram',
    subtitle: `Comparativo de posts e engajamento${windowSuffix}`,
    metricLabel: 'Engajamento',
    chartType: 'table',
    lines: [],
    chartData,
    instagramTable,
    empty: !hasData,
  }
}

function buildGoogleTrendsChart(
  columns: PanoramaCandidateColumn[],
  actors: PoliticalActorWithTerms[],
  interestRows: GoogleTrendsInterestRow[]
): PanoramaPlatformChart {
  const series = buildGoogleTrendsSeries(actors, interestRows)
  const slugByName = new Map(columns.map((c) => [c.name, c.slug]))

  const dateSet = new Set<string>()
  for (const s of series) {
    for (const p of s.points) dateSet.add(p.date)
  }

  let dates = [...dateSet].sort()
  if (dates.length > CHART_WINDOW) {
    dates = dates.slice(-CHART_WINDOW)
  }

  const chartData = dates.map((date) => {
    const row: { date: string } & Record<string, number | string> = { date }
    for (const s of series) {
      const slug = s.slug ?? slugByName.get(s.name)
      if (!slug) continue
      const point = s.points.find((p) => p.date === date)
      if (point) row[slug] = point.score
    }
    for (const col of columns) {
      if (row[col.slug] === undefined) row[col.slug] = 0
    }
    return row
  })

  const lines = series
    .map((s) => {
      const col = columns.find((c) => c.slug === s.slug || c.name === s.name)
      if (!col) return null
      return { slug: col.slug, name: col.name, color: col.accentColor }
    })
    .filter((l): l is PanoramaChartLine => l !== null)

  const searchContexts: PanoramaTrendsSearchHighlight[] = columns
    .filter((col) => col.trends?.searchContext)
    .map((col) => ({
      slug: col.slug,
      name: col.name,
      color: col.accentColor,
      context: col.trends!.searchContext!,
    }))
    .filter((entry) => entry.context.hasData)

  return {
    id: 'google-trends',
    layoutTier: 'simple',
    title: 'Google Trends',
    subtitle: `Interesse de busca · índice 0–100${windowSuffix}`,
    metricLabel: 'Interesse',
    chartType: 'line',
    lines: lines.length > 0 ? lines : linesFromColumns(columns),
    chartData,
    searchContexts: searchContexts.length > 0 ? searchContexts : undefined,
    empty: chartData.length === 0 || !chartHasData(chartData, columns),
  }
}

function buildMetaAdsChart(
  columns: PanoramaCandidateColumn[],
  ads: MetaAdsMentionWithActor[]
): PanoramaPlatformChart {
  const dates = lastNDays(CHART_WINDOW)
  const items: Array<{ slug: string; date: string; value: number }> = []

  for (const ad of ads) {
    const slug = slugFromMention(ad)
    if (!slug) continue
    const date = ad.started_running_at
      ? dayKey(ad.started_running_at)
      : ad.collected_at
        ? dayKey(ad.collected_at)
        : null
    if (!date) continue
    const spend = ad.spend_max_brl ?? ad.spend_min_brl ?? 0
    if (spend <= 0) continue
    items.push({ slug, date, value: spend })
  }

  const chartData = buildDailyBuckets(dates, columns, items)
  const adsBySlug = new Map<string, MetaAdsMentionWithActor[]>()
  for (const ad of ads) {
    const slug = slugFromMention(ad)
    if (!slug) continue
    const arr = adsBySlug.get(slug) ?? []
    arr.push(ad)
    adsBySlug.set(slug, arr)
  }

  const periodTotals = columns
    .map((col) => {
      const totals = buildMetaAdsPeriodTotals(adsBySlug.get(col.slug) ?? [])
      if (totals.spendLabel === '—' && !totals.impressionsLabel) {
        return null
      }
      return {
        slug: col.slug,
        name: col.name,
        color: col.accentColor,
        spendLabel: totals.spendLabel,
        impressionsLabel: totals.impressionsLabel,
      }
    })
    .filter((t): t is PanoramaMetaAdsPeriodTotal => t !== null)

  return {
    id: 'meta-ads',
    layoutTier: 'simple',
    title: 'Anúncios',
    subtitle: `Gasto estimado por dia de início${windowSuffix}`,
    metricLabel: 'Gasto (R$)',
    chartType: 'line',
    lines: linesFromColumns(columns),
    chartData,
    periodTotals,
    empty: !chartHasData(chartData, columns),
  }
}

export function buildPanoramaPlatformCharts(input: {
  columns: PanoramaCandidateColumn[]
  actors: PoliticalActorWithTerms[]
  youtubeMentions: YoutubeMentionWithActor[]
  googleNewsMentions: GoogleNewsMentionWithActor[]
  instagramPosts: InstagramRadarPostWithActor[]
  trendsInterestRows: GoogleTrendsInterestRow[]
  metaAdsMentions: MetaAdsMentionWithActor[]
}): PanoramaPlatformChart[] {
  if (input.columns.length === 0) return []

  return [
    buildGoogleNewsChart(input.columns, input.googleNewsMentions),
    buildInstagramTable(input.columns, input.actors, input.instagramPosts),
    buildYoutubeChart(input.columns, input.youtubeMentions),
    buildGoogleTrendsChart(input.columns, input.actors, input.trendsInterestRows),
    buildMetaAdsChart(input.columns, input.metaAdsMentions),
  ]
}
