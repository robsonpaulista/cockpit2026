import type { PoliticalActorType } from '@/lib/youtube-radar-types'
import type {
  PanoramaCandidateColumn,
  PanoramaModel,
} from '@/lib/monitoramento-panorama'
import type {
  PanoramaPlatformChart,
  PanoramaPlatformId,
  PanoramaInstagramTableRow,
} from '@/lib/monitoramento-panorama-charts'

export type PanoramaKpiBadge = 'leader' | 'growth' | 'outsider'

export type PanoramaKpiInsight = {
  badge: PanoramaKpiBadge
  badgeLabel: string
  name: string
  color: string
  text: string
}

export type PanoramaPlatformKpiCard = {
  platformId: PanoramaPlatformId
  platformLabel: string
  metricLabel: string
  insights: PanoramaKpiInsight[]
  empty: boolean
}

type MetricRow = {
  slug: string
  name: string
  color: string
  actorType: PoliticalActorType
  total: number
  recent: number
  prior: number
}

const RECENT_DAYS = 7

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n}%`
}

function growthPct(recent: number, prior: number): number | null {
  if (recent === 0 && prior === 0) return null
  if (prior === 0) return recent > 0 ? 100 : null
  return Math.round(((recent - prior) / prior) * 100)
}

function sharePct(value: number, total: number): number | null {
  if (total <= 0 || value <= 0) return null
  return Math.round((value / total) * 100)
}

function sumChartSlices(
  chart: PanoramaPlatformChart | undefined,
  slug: string,
  fromEnd: number,
  count: number
): number {
  if (!chart?.chartData.length) return 0
  const rows = chart.chartData.slice(-fromEnd).slice(-count)
  return rows.reduce((sum, row) => sum + Number(row[slug] ?? 0), 0)
}

function metricsFromTotals(
  columns: PanoramaCandidateColumn[],
  pickTotal: (col: PanoramaCandidateColumn) => number,
  chart?: PanoramaPlatformChart
): MetricRow[] {
  return columns.map((col) => {
    const total = pickTotal(col)
    const recent = sumChartSlices(chart, col.slug, RECENT_DAYS, RECENT_DAYS)
    const prior = sumChartSlices(chart, col.slug, RECENT_DAYS * 2, RECENT_DAYS)
    return {
      slug: col.slug,
      name: col.name,
      color: col.accentColor,
      actorType: col.actorType,
      total,
      recent: chart?.chartData.length ? recent : total,
      prior: chart?.chartData.length ? prior : 0,
    }
  })
}

function leaderInsight(
  rows: MetricRow[],
  buildText: (leader: MetricRow, share: number | null) => string
): PanoramaKpiInsight | null {
  const active = rows.filter((r) => r.total > 0)
  if (active.length === 0) return null
  const leader = [...active].sort((a, b) => b.total - a.total)[0]
  const sum = active.reduce((s, r) => s + r.total, 0)
  const share = sharePct(leader.total, sum)
  return {
    badge: 'leader',
    badgeLabel: 'Maior volume',
    name: leader.name,
    color: leader.color,
    text: buildText(leader, share),
  }
}

function growthInsight(
  rows: MetricRow[],
  buildText: (row: MetricRow, pct: number) => string,
  minPct = 15
): PanoramaKpiInsight | null {
  let best: { row: MetricRow; pct: number } | null = null
  for (const row of rows) {
    const pct = growthPct(row.recent, row.prior)
    if (pct === null || pct < minPct) continue
    if (!best || pct > best.pct) best = { row, pct }
  }
  if (!best) return null
  return {
    badge: 'growth',
    badgeLabel: 'Em alta',
    name: best.row.name,
    color: best.row.color,
    text: buildText(best.row, best.pct),
  }
}

function outsiderInsight(
  rows: MetricRow[],
  leader: PanoramaKpiInsight | null,
  buildText: (row: MetricRow, pct: number) => string,
  minPct = 25
): PanoramaKpiInsight | null {
  const leaderSlug = leader?.name
    ? rows.find((r) => r.name === leader.name)?.slug
    : undefined

  let candidate: { row: MetricRow; pct: number } | null = null
  for (const row of rows) {
    if (row.slug === leaderSlug) continue
    const pct = growthPct(row.recent, row.prior)
    if (pct === null || pct < minPct) continue
    if (row.total === 0 && row.recent === 0) continue
    if (!candidate || pct > candidate.pct) candidate = { row, pct }
  }

  if (!candidate) return null
  if (leader && candidate.row.slug === leaderSlug) return null

  return {
    badge: 'outsider',
    badgeLabel: 'Aceleração',
    name: candidate.row.name,
    color: candidate.row.color,
    text: buildText(candidate.row, candidate.pct),
  }
}

function buildCard(
  platformId: PanoramaPlatformId,
  platformLabel: string,
  metricLabel: string,
  rows: MetricRow[],
  windowLabel: string,
  leaderText: (leader: MetricRow, share: number | null) => string,
  growthText: (row: MetricRow, pct: number) => string,
  outsiderText: (row: MetricRow, pct: number) => string
): PanoramaPlatformKpiCard {
  const hasData = rows.some((r) => r.total > 0 || r.recent > 0)
  if (!hasData) {
    return { platformId, platformLabel, metricLabel, insights: [], empty: true }
  }

  const leader = leaderInsight(rows, leaderText)
  const growth = growthInsight(rows, growthText)
  const outsider = outsiderInsight(rows, leader, outsiderText)

  const insights = [leader, growth, outsider].filter((i): i is PanoramaKpiInsight => Boolean(i))

  return {
    platformId,
    platformLabel,
    metricLabel,
    insights,
    empty: insights.length === 0,
  }
}

function chartById(charts: PanoramaPlatformChart[], id: PanoramaPlatformId): PanoramaPlatformChart | undefined {
  return charts.find((c) => c.id === id)
}

function buildInstagramKpis(
  table: PanoramaInstagramTableRow[],
  windowLabel: string
): PanoramaPlatformKpiCard {
  const active = table.filter((r) => r.postCount > 0 || r.avgEngagement > 0)
  if (active.length === 0) {
    return {
      platformId: 'instagram',
      platformLabel: 'Instagram',
      metricLabel: 'Engajamento médio',
      insights: [],
      empty: true,
    }
  }

  const byAvg = [...active].sort((a, b) => b.avgEngagement - a.avgEngagement)[0]
  const byTotal = [...active].sort((a, b) => b.totalEngagement - a.totalEngagement)[0]
  const byPosts = [...active].sort((a, b) => b.postCount - a.postCount)[0]

  const insights: PanoramaKpiInsight[] = [
    {
      badge: 'leader',
      badgeLabel: 'Maior engajamento',
      name: byAvg.name,
      color: byAvg.color,
      text: `${byAvg.name} apresentou o maior engajamento médio do período (${formatInt(byAvg.avgEngagement)} por post).`,
    },
  ]

  if (byTotal.slug !== byAvg.slug && byTotal.totalEngagement > 0) {
    insights.push({
      badge: 'leader',
      badgeLabel: 'Maior volume',
      name: byTotal.name,
      color: byTotal.color,
      text: `${byTotal.name} acumulou o maior engajamento total no Instagram nos ${windowLabel} (${formatInt(byTotal.totalEngagement)} interações).`,
    })
  }

  if (byPosts.postCount >= 2 && byPosts.slug !== byAvg.slug) {
    insights.push({
      badge: 'outsider',
      badgeLabel: 'Mais posts',
      name: byPosts.name,
      color: byPosts.color,
      text: `${byPosts.name} publicou com mais frequência no recorte (${formatInt(byPosts.postCount)} posts), abaixo do maior engajamento médio.`,
    })
  }

  return {
    platformId: 'instagram',
    platformLabel: 'Instagram',
    metricLabel: 'Engajamento médio',
    insights,
    empty: false,
  }
}

function buildTrendsGrowthInsight(columns: PanoramaCandidateColumn[]): PanoramaKpiInsight | null {
  let best: { name: string; color: string; pct: number } | null = null
  for (const col of columns) {
    const pct = col.trends?.weekChangePct
    if (pct === null || pct === undefined || pct <= 0) continue
    if (!best || pct > best.pct) {
      best = { name: col.name, color: col.accentColor, pct }
    }
  }
  if (!best || best.pct < 10) return null
  return {
    badge: 'growth',
    badgeLabel: 'Em alta',
    name: best.name,
    color: best.color,
    text: `As buscas por ${best.name} atingiram o maior nível dos últimos 30 dias (alta de ${formatPct(best.pct)} na semana).`,
  }
}

function buildTrendsCard(
  columns: PanoramaCandidateColumn[],
  trendsChart: PanoramaPlatformChart | undefined,
  windowLabel: string
): PanoramaPlatformKpiCard {
  const trendsRows: MetricRow[] = columns.map((col) => {
    const current = col.trends?.currentIndex ?? 0
    const peak = col.trends?.peak3m ?? 0
    const recent = sumChartSlices(trendsChart, col.slug, RECENT_DAYS, RECENT_DAYS)
    const prior = sumChartSlices(trendsChart, col.slug, RECENT_DAYS * 2, RECENT_DAYS)
    const chartAvg =
      trendsChart && trendsChart.chartData.length > 0
        ? Math.round(
            sumChartSlices(trendsChart, col.slug, trendsChart.chartData.length, trendsChart.chartData.length) /
              trendsChart.chartData.length
          )
        : 0

    return {
      slug: col.slug,
      name: col.name,
      color: col.accentColor,
      actorType: col.actorType,
      total: Math.max(current, peak, chartAvg),
      recent: recent > 0 ? recent : current,
      prior,
    }
  })

  const hasTrendsColumn = columns.some((c) => c.trends !== null)
  const hasChart = Boolean(trendsChart && !trendsChart.empty)
  const hasValues = trendsRows.some((r) => r.total > 0 || r.recent > 0)

  if (!hasTrendsColumn && !hasChart) {
    return {
      platformId: 'google-trends',
      platformLabel: 'Google Trends',
      metricLabel: 'Interesse de busca',
      insights: [],
      empty: true,
    }
  }

  if (!hasValues) {
    return {
      platformId: 'google-trends',
      platformLabel: 'Google Trends',
      metricLabel: 'Interesse de busca',
      insights: [],
      empty: true,
    }
  }

  const leaderRow = [...trendsRows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total)[0]
  const leaderCol = leaderRow ? columns.find((c) => c.slug === leaderRow.slug) : null
  const usesPeak =
    leaderCol &&
    (leaderCol.trends?.currentIndex ?? 0) === 0 &&
    (leaderCol.trends?.peak3m ?? 0) > 0

  const insights: PanoramaKpiInsight[] = []

  if (leaderRow) {
    insights.push({
      badge: 'leader',
      badgeLabel: 'Maior volume',
      name: leaderRow.name,
      color: leaderRow.color,
      text: usesPeak
        ? `As buscas por ${leaderRow.name} registraram pico de ${leaderRow.total}/100 no recorte de ${windowLabel}.`
        : `As buscas por ${leaderRow.name} registram o maior índice de interesse no recorte (${leaderRow.total}/100).`,
    })
  }

  const trendsGrowth = buildTrendsGrowthInsight(columns)
  if (trendsGrowth) {
    insights.push(trendsGrowth)
  } else {
    const chartGrowth = growthInsight(
      trendsRows,
      (row, pct) =>
        `As buscas por ${row.name} apresentaram alta de ${formatPct(pct)} nos últimos ${RECENT_DAYS} dias.`,
      10
    )
    if (chartGrowth) insights.push(chartGrowth)
  }

  const leaderInsightRow = insights.find((i) => i.badge === 'leader')
  const outsider = outsiderInsight(
    trendsRows,
    leaderInsightRow ?? null,
    (row, pct) =>
      `As buscas por ${row.name} aceleraram ${formatPct(pct)} no curto prazo, abaixo do maior índice do período.`,
    15
  )
  if (outsider) insights.push(outsider)

  return {
    platformId: 'google-trends',
    platformLabel: 'Google Trends',
    metricLabel: 'Interesse de busca',
    insights,
    empty: insights.length === 0,
  }
}

export function buildPanoramaPlatformKpis(panorama: Pick<PanoramaModel, 'columns' | 'charts' | 'windowLabel'>): PanoramaPlatformKpiCard[] {
  const { columns, charts, windowLabel } = panorama
  if (columns.length === 0) return []

  const newsChart = chartById(charts, 'google-news')
  const ytChart = chartById(charts, 'youtube')
  const trendsChart = chartById(charts, 'google-trends')
  const metaChart = chartById(charts, 'meta-ads')
  const igChart = chartById(charts, 'instagram')

  const newsRows = metricsFromTotals(
    columns,
    (c) => c.googleNews?.mentions7d ?? 0,
    newsChart
  )

  const igTable = igChart?.instagramTable ?? []
  const igLeader = buildInstagramKpis(igTable, windowLabel)

  const ytRows = metricsFromTotals(
    columns,
    (c) => c.youtube?.views7d ?? 0,
    ytChart
  )

  const metaRows = metricsFromTotals(
    columns,
    (c) => c.metaAds?.activeAds ?? 0,
    metaChart
  )

  return [
    buildCard(
      'google-news',
      'Google News',
      'Menções na imprensa',
      newsRows,
      windowLabel,
      (leader, share) =>
        share !== null && share >= 20
          ? `${leader.name} concentrou ${share}% das menções da imprensa nos ${windowLabel}.`
          : `${leader.name} registrou o maior volume de menções na imprensa nos ${windowLabel} (${formatInt(leader.total)} matérias).`,
      (row, pct) =>
        `${row.name} apresentou aumento de ${formatPct(pct)} nas menções nos últimos ${RECENT_DAYS} dias, em relação à semana anterior.`,
      (row, pct) =>
        `${row.name} registrou aceleração de ${formatPct(pct)} nas menções recentes, sem liderar o volume do período.`
    ),
    igLeader,
    buildCard(
      'youtube',
      'YouTube',
      'Visualizações',
      ytRows,
      windowLabel,
      (leader, share) =>
        share !== null && share >= 25
          ? `${leader.name} concentrou ${share}% das visualizações monitoradas no YouTube nos ${windowLabel}.`
          : `${leader.name} acumulou o maior volume de visualizações no YouTube nos ${windowLabel} (${formatInt(leader.total)} views).`,
      (row, pct) =>
        `${row.name} registrou alta de ${formatPct(pct)} nas visualizações nos últimos ${RECENT_DAYS} dias.`,
      (row, pct) =>
        `${row.name} apresentou aceleração de ${formatPct(pct)} em views recentes, sem liderar o período completo.`
    ),
    buildTrendsCard(columns, trendsChart, windowLabel),
    buildCard(
      'meta-ads',
      'Meta Ads',
      'Anúncios ativos',
      metaRows,
      windowLabel,
      (leader) =>
        `${leader.name} concentrou o maior número de anúncios ativos na biblioteca da Meta (${formatInt(leader.total)}).`,
      (row, pct) =>
        `${row.name} registrou aumento de ${formatPct(pct)} em anúncios ativos nos últimos ${RECENT_DAYS} dias.`,
      (row, pct) =>
        `${row.name} apresentou aceleração de ${formatPct(pct)} em anúncios recentes, sem liderar o período.`
    ),
  ]
}
