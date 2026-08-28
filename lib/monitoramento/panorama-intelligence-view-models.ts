import type { PanoramaCandidateColumn } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'

export function resolvePanoramaFocusSlug(
  columns: PanoramaCandidateColumn[],
): string | null {
  return columns.find((c) => c.actorType === 'own_candidate')?.slug ?? null
}

function sumSeries(chart: PanoramaPlatformChart, slug: string): number {
  return chart.chartData.reduce((acc, row) => acc + Number(row[slug] ?? 0), 0)
}

function seriesValues(chart: PanoramaPlatformChart, slug: string): number[] {
  return chart.chartData.map((row) => Number(row[slug] ?? 0))
}

function rankByField<T extends { slug: string }>(
  items: T[],
  valueOf: (item: T) => number,
): Array<T & { rank: number }> {
  return [...items]
    .filter((item) => valueOf(item) > 0)
    .sort((a, b) => valueOf(b) - valueOf(a))
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function rankDeltaInHalves(
  chart: PanoramaPlatformChart,
  slug: string,
): number | null {
  const rows = chart.chartData
  const mid = Math.floor(rows.length / 2)
  if (mid <= 0 || rows.length < 2) return null

  const rankIn = (slice: typeof rows) => {
    const totals = chart.lines
      .map((line) => ({
        slug: line.slug,
        total: slice.reduce((acc, row) => acc + Number(row[line.slug] ?? 0), 0),
      }))
      .filter((t) => t.total > 0)
      .sort((a, b) => b.total - a.total)
    return totals.findIndex((t) => t.slug === slug)
  }

  const first = rankIn(rows.slice(0, mid))
  const second = rankIn(rows.slice(mid))
  if (first < 0 || second < 0 || first === second) return null
  return first - second
}

function deltaPct(first: number, last: number): number | null {
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null
  if (first === 0 && last === 0) return null
  if (first === 0) return null
  return Math.round(((last - first) / first) * 1000) / 10
}

export type YoutubeIntelRow = {
  rank: number
  slug: string
  name: string
  total: number
  barPct: number
}

export type YoutubeIntelModel = {
  hasData: boolean
  top5: YoutubeIntelRow[]
  focus: { rank: number; name: string; total: number } | null
  focusInTop5: boolean
  focusRankDelta: number | null
}

export function buildYoutubeIntelModel(
  chart: PanoramaPlatformChart,
  focusSlug: string | null,
): YoutubeIntelModel {
  if (chart.empty) {
    return { hasData: false, top5: [], focus: null, focusInTop5: false, focusRankDelta: null }
  }

  const ranked = rankByField(
    chart.lines.map((line) => ({
      slug: line.slug,
      name: line.name,
      total: sumSeries(chart, line.slug),
    })),
    (row) => row.total,
  )

  if (ranked.length === 0) {
    return { hasData: false, top5: [], focus: null, focusInTop5: false, focusRankDelta: null }
  }

  const max = ranked[0]?.total ?? 1
  const top5 = ranked.slice(0, 5).map((row) => ({
    ...row,
    barPct: max > 0 ? Math.round((row.total / max) * 100) : 0,
  }))

  let focus: YoutubeIntelModel['focus'] = null
  let focusInTop5 = false
  let focusRankDelta: number | null = null

  if (focusSlug) {
    const match = ranked.find((row) => row.slug === focusSlug)
    if (match) {
      focus = { rank: match.rank, name: match.name, total: match.total }
      focusInTop5 = match.rank <= 5
      focusRankDelta = rankDeltaInHalves(chart, focusSlug)
    }
  }

  return { hasData: true, top5, focus, focusInTop5, focusRankDelta }
}

export type TrendsPulseRow = {
  rank: number
  slug: string
  name: string
  current: number
  spark: number[]
  deltaPct: number | null
  deltaTone: 'up' | 'down' | 'flat'
}

export type TrendsIntelModel = {
  hasData: boolean
  top5: TrendsPulseRow[]
  focus: { rank: number; current: number; peak: number } | null
  movementLabel: 'Crescendo' | 'Caindo' | 'Estável' | null
}

export function buildTrendsIntelModel(
  chart: PanoramaPlatformChart,
  focusSlug: string | null,
): TrendsIntelModel {
  if (chart.empty || chart.chartData.length === 0) {
    return { hasData: false, top5: [], focus: null, movementLabel: null }
  }

  const rows = chart.lines.map((line) => {
    const spark = seriesValues(chart, line.slug)
    const first = spark[0] ?? 0
    const last = spark[spark.length - 1] ?? 0
    const pct = deltaPct(first, last)
    const deltaTone: TrendsPulseRow['deltaTone'] =
      pct == null || pct === 0 ? 'flat' : pct > 0 ? 'up' : 'down'
    return {
      slug: line.slug,
      name: line.name,
      current: last,
      spark,
      deltaPct: pct,
      deltaTone,
    }
  })

  const ranked = rankByField(rows, (row) => row.current)
  if (ranked.length === 0) {
    return { hasData: false, top5: [], focus: null, movementLabel: null }
  }

  const top5 = ranked.slice(0, 5)

  let focus: TrendsIntelModel['focus'] = null
  let movementLabel: TrendsIntelModel['movementLabel'] = null

  if (focusSlug) {
    const match = ranked.find((row) => row.slug === focusSlug)
    if (match) {
      const peak = Math.max(...match.spark, 0)
      focus = { rank: match.rank, current: match.current, peak }
      if (match.deltaPct != null) {
        if (match.deltaPct > 0) movementLabel = 'Crescendo'
        else if (match.deltaPct < 0) movementLabel = 'Caindo'
        else movementLabel = 'Estável'
      }
    }
  }

  return { hasData: true, top5, focus, movementLabel }
}

export type MetaAdsActiveRow = {
  slug: string
  name: string
  active: boolean
  activeCount: number
}

export type MetaAdsTimelineCell = 'empty' | 'dot' | 'soft' | 'strong'

export type MetaAdsTimelineRow = {
  slug: string
  name: string
  cells: MetaAdsTimelineCell[]
}

export type MetaAdsRecentEvent = {
  date: string
  dateLabel: string
  name: string
  count: number
}

export type MetaAdsIntelModel = {
  hasData: boolean
  activeNow: MetaAdsActiveRow[]
  timeline: MetaAdsTimelineRow[]
  dateLabels: string[]
  recentEvents: MetaAdsRecentEvent[]
  focusPresence: { activeCount: number; daysSinceLast: number | null } | null
}

function intensityCell(value: number): MetaAdsTimelineCell {
  if (value <= 0) return 'empty'
  if (value === 1) return 'dot'
  if (value === 2) return 'soft'
  return 'strong'
}

function formatShortDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso.slice(5)
  return d.toLocaleDateString('pt-BR', { day: '2-digit' })
}

function formatEventDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .toUpperCase()
}

export function buildMetaAdsIntelModel(
  chart: PanoramaPlatformChart,
  focusSlug: string | null,
): MetaAdsIntelModel {
  if (chart.empty || chart.chartData.length === 0) {
    return {
      hasData: false,
      activeNow: [],
      timeline: [],
      dateLabels: [],
      recentEvents: [],
      focusPresence: null,
    }
  }

  const totalsBySlug = new Map(
    (chart.periodTotals ?? []).map((row) => [row.slug, row.activeCount]),
  )

  const activeNow = chart.lines
    .map((line) => {
      const activeCount = totalsBySlug.get(line.slug) ?? 0
      return {
        slug: line.slug,
        name: line.name,
        active: activeCount > 0,
        activeCount,
      }
    })
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, 'pt-BR'))
    .slice(0, 5)

  const dateLabels = chart.chartData.map((row) => formatShortDay(String(row.date)))

  const rankedSlugs = rankByField(
    chart.lines.map((line) => ({
      slug: line.slug,
      name: line.name,
      total: sumSeries(chart, line.slug),
    })),
    (row) => row.total,
  ).slice(0, 4)

  const timeline: MetaAdsTimelineRow[] = rankedSlugs.map((row) => ({
    slug: row.slug,
    name: row.name,
    cells: chart.chartData.map((day) =>
      intensityCell(Number(day[row.slug] ?? 0)),
    ),
  }))

  const events: MetaAdsRecentEvent[] = []
  for (const day of chart.chartData) {
    const date = String(day.date)
    for (const line of chart.lines) {
      const count = Number(day[line.slug] ?? 0)
      if (count <= 0) continue
      events.push({
        date,
        dateLabel: formatEventDay(date),
        name: line.name,
        count,
      })
    }
  }
  events.sort((a, b) => b.date.localeCompare(a.date) || b.count - a.count)

  let focusPresence: MetaAdsIntelModel['focusPresence'] = null
  if (focusSlug) {
    const activeCount = totalsBySlug.get(focusSlug) ?? 0
    let lastDate: string | null = null
    for (let i = chart.chartData.length - 1; i >= 0; i--) {
      const row = chart.chartData[i]!
      if (Number(row[focusSlug] ?? 0) > 0) {
        lastDate = String(row.date)
        break
      }
    }
    let daysSinceLast: number | null = null
    if (lastDate) {
      const end = chart.chartData[chart.chartData.length - 1]?.date
      if (end) {
        const endMs = new Date(`${String(end)}T12:00:00`).getTime()
        const lastMs = new Date(`${lastDate}T12:00:00`).getTime()
        if (Number.isFinite(endMs) && Number.isFinite(lastMs)) {
          daysSinceLast = Math.max(
            0,
            Math.round((endMs - lastMs) / (24 * 60 * 60 * 1000)),
          )
        }
      }
    }
    if (activeCount > 0 || daysSinceLast != null) {
      focusPresence = { activeCount, daysSinceLast }
    }
  }

  return {
    hasData: activeNow.some((r) => r.active) || timeline.some((r) => r.cells.some((c) => c !== 'empty')),
    activeNow,
    timeline,
    dateLabels,
    recentEvents: events.slice(0, 3),
    focusPresence,
  }
}

export function formatIntelCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 2 : value >= 100_000 ? 1 : 0,
  })
    .format(value)
    .replace(/\s/g, ' ')
}

export function formatIntelDelta(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  if (pct === 0) return '0%'
  const sign = pct > 0 ? '↑ ' : '↓ '
  return `${sign}${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
