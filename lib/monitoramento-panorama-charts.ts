import { buildGoogleTrendsSeries } from '@/lib/google-trends-aggregate'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { GoogleTrendsInterestRow } from '@/lib/google-trends-types'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import type { GoogleTrendsSearchContext } from '@/lib/google-trends-types'
import type { PanoramaCandidateColumn } from '@/lib/monitoramento-panorama'
import {
  PANORAMA_WINDOW_DAYS,
  panoramaWindowSubtitleSuffix,
} from '@/lib/monitoramento-panorama-window'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export type PanoramaPlatformId = 'youtube' | 'google-news' | 'google-trends' | 'meta-ads'

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

export type PanoramaPlatformChart = {
  id: PanoramaPlatformId
  title: string
  subtitle: string
  metricLabel: string
  chartType: 'line' | 'heatmap'
  lines: PanoramaChartLine[]
  chartData: Array<{ date: string } & Record<string, number | string>>
  heatmapDates?: string[]
  heatmapRows?: PanoramaHeatmapRow[]
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
    title: 'Meta Ads Library',
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
  trendsInterestRows: GoogleTrendsInterestRow[]
  metaAdsMentions: MetaAdsMentionWithActor[]
}): PanoramaPlatformChart[] {
  if (input.columns.length === 0) return []

  return [
    buildYoutubeChart(input.columns, input.youtubeMentions),
    buildGoogleNewsChart(input.columns, input.googleNewsMentions),
    buildGoogleTrendsChart(input.columns, input.actors, input.trendsInterestRows),
    buildMetaAdsChart(input.columns, input.metaAdsMentions),
  ]
}
