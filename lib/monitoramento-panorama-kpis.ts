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
const MOMENTUM_MIN_PCT = 8
const MOMENTUM_MIN_DELTA = 1
const MOMENTUM_BADGE = 'Maior avanço recente'
const MOMENTUM_GROWTH_BADGE = 'Maior crescimento recente'
const PERIOD_LABEL = '30 dias'

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

function spendMidpoint(min: number, max: number): number {
  if (min > 0 && max > 0) return (min + max) / 2
  return Math.max(min, max, 0)
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

function chartSum(chart: PanoramaPlatformChart | undefined, slug: string): number {
  if (!chart?.chartData.length) return 0
  return chart.chartData.reduce((acc, row) => acc + Number(row[slug] ?? 0), 0)
}

function chartActiveDays(chart: PanoramaPlatformChart | undefined, slug: string): number {
  if (!chart?.chartData.length) return 0
  return chart.chartData.reduce((acc, row) => acc + (Number(row[slug] ?? 0) > 0 ? 1 : 0), 0)
}

function chartAccumulated(
  chart: PanoramaPlatformChart | undefined,
  slug: string
): { sum: number; activeDays: number } {
  return { sum: chartSum(chart, slug), activeDays: chartActiveDays(chart, slug) }
}

function trendsLeaderTotal(
  col: PanoramaCandidateColumn,
  trendsChart: PanoramaPlatformChart | undefined
): number {
  const fromChart = chartSum(trendsChart, col.slug)
  if (fromChart > 0) return fromChart

  const points = col.trends?.points ?? []
  if (points.length > 0) {
    return points.reduce((acc, p) => acc + p.score, 0)
  }

  return col.trends?.currentIndex ?? 0
}

function buildTrendsLeaderInsight(
  rows: MetricRow[],
  trendsChart: PanoramaPlatformChart | undefined
): PanoramaKpiInsight | null {
  const active = rows.filter((row) => {
    const { sum, activeDays } = chartAccumulated(trendsChart, row.slug)
    return sum > 0 || activeDays > 0
  })
  if (active.length === 0) return null

  const leader = [...active].sort((a, b) => {
    const aa = chartAccumulated(trendsChart, a.slug)
    const bb = chartAccumulated(trendsChart, b.slug)
    if (bb.activeDays !== aa.activeDays) return bb.activeDays - aa.activeDays
    return bb.sum - aa.sum
  })[0]

  const { sum, activeDays } = chartAccumulated(trendsChart, leader.slug)
  const totalSum = active.reduce((acc, row) => acc + chartAccumulated(trendsChart, row.slug).sum, 0)
  const share = sharePct(sum, totalSum)

  const text =
    share !== null && share >= 15
      ? `${share}% do acumulado`
      : activeDays > 1
        ? `${activeDays} dias · ${formatInt(sum)} pts`
        : `${formatInt(sum)} pts acumulados`

  return {
    badge: 'leader',
    badgeLabel: 'Líder',
    name: leader.name,
    color: leader.color,
    text,
  }
}

function columnPeriodTotal(
  chart: PanoramaPlatformChart | undefined,
  slug: string,
  fallback: number
): number {
  const fromChart = chartSum(chart, slug)
  return fromChart > 0 ? fromChart : fallback
}

function metricsFromTotals(
  columns: PanoramaCandidateColumn[],
  pickTotal: (col: PanoramaCandidateColumn) => number,
  chart?: PanoramaPlatformChart
): MetricRow[] {
  const hasChart = Boolean(chart?.chartData.length)
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
      recent: hasChart ? recent : 0,
      prior: hasChart ? prior : 0,
    }
  })
}

function resolveLeaderSlug(leader: PanoramaKpiInsight | null, rows: MetricRow[]): string | undefined {
  if (!leader) return undefined
  return rows.find((r) => r.name === leader.name)?.slug
}

function leaderInsight(
  rows: MetricRow[],
  buildText: (leader: MetricRow, share: number | null) => string,
  badgeLabel = 'Líder'
): PanoramaKpiInsight | null {
  const active = rows.filter((r) => r.total > 0)
  if (active.length === 0) return null
  const leader = [...active].sort((a, b) => b.total - a.total)[0]
  const sum = active.reduce((s, r) => s + r.total, 0)
  const share = sharePct(leader.total, sum)
  return {
    badge: 'leader',
    badgeLabel,
    name: leader.name,
    color: leader.color,
    text: buildText(leader, share),
  }
}

function recentActivityInsight(
  rows: MetricRow[],
  leaderSlug: string | undefined
): PanoramaKpiInsight | null {
  const withRecent = rows.filter((r) => r.recent > 0)
  if (withRecent.length < 2) return null

  const nonLeaders = withRecent.filter((r) => r.slug !== leaderSlug)
  if (nonLeaders.length === 0) return null

  const totalRecent = withRecent.reduce((sum, row) => sum + row.recent, 0)
  const best = [...nonLeaders].sort((a, b) => b.recent - a.recent)[0]
  const share = sharePct(best.recent, totalRecent)
  if (!share || share < 15) return null

  return {
    badge: 'growth',
    badgeLabel: MOMENTUM_BADGE,
    name: best.name,
    color: best.color,
    text: `${share}% da atividade recente`,
  }
}

function momentumInsight(
  rows: MetricRow[],
  leader: PanoramaKpiInsight | null
): PanoramaKpiInsight | null {
  const leaderSlug = resolveLeaderSlug(leader, rows)

  type Scored = {
    row: MetricRow
    pct: number
    delta: number
    isLeader: boolean
    score: number
  }

  const scored: Scored[] = []

  for (const row of rows) {
    const pct = growthPct(row.recent, row.prior)
    const delta = row.recent - row.prior

    if (row.recent <= 0 && delta <= 0) continue

    const qualifies =
      (row.prior === 0 && row.recent > 0) ||
      (pct !== null && pct >= MOMENTUM_MIN_PCT && delta >= MOMENTUM_MIN_DELTA) ||
      (delta >= 2 && row.recent >= 2)

    if (!qualifies) continue

    const isLeader = row.slug === leaderSlug
    const score = (isLeader ? 0 : 1_000) + (pct ?? 50) * 10 + delta
    scored.push({
      row,
      pct: pct ?? (row.prior === 0 ? 100 : 0),
      delta,
      isLeader,
      score,
    })
  }

  if (scored.length === 0) {
    return recentActivityInsight(rows, leaderSlug)
  }

  const pick = [...scored].sort((a, b) => b.score - a.score)[0]

  if (pick.isLeader) {
    return {
      badge: 'growth',
      badgeLabel: MOMENTUM_GROWTH_BADGE,
      name: pick.row.name,
      color: pick.row.color,
      text: `${formatPct(pick.pct)}`,
    }
  }

  if (pick.row.prior === 0) {
    return {
      badge: 'growth',
      badgeLabel: MOMENTUM_BADGE,
      name: pick.row.name,
      color: pick.row.color,
      text: `${formatInt(pick.row.recent)} (novo)`,
    }
  }

  return {
    badge: 'growth',
    badgeLabel: MOMENTUM_BADGE,
    name: pick.row.name,
    color: pick.row.color,
    text: `${formatPct(pick.pct)}`,
  }
}

function stableMomentumInsight(): PanoramaKpiInsight {
  return {
    badge: 'growth',
    badgeLabel: 'Estável',
    name: '',
    color: '#6B7280',
    text: 'Sem aceleração recente',
  }
}

function pairLeaderAndMomentum(
  leader: PanoramaKpiInsight | null,
  momentum: PanoramaKpiInsight | null
): PanoramaKpiInsight[] {
  if (!leader) return []
  return [leader, momentum ?? stableMomentumInsight()]
}

function buildCard(
  platformId: PanoramaPlatformId,
  platformLabel: string,
  metricLabel: string,
  rows: MetricRow[],
  leaderText: (leader: MetricRow, share: number | null) => string
): PanoramaPlatformKpiCard {
  const hasData = rows.some((r) => r.total > 0 || r.recent > 0)
  if (!hasData) {
    return { platformId, platformLabel, metricLabel, insights: [], empty: true }
  }

  const leader = leaderInsight(rows, leaderText, 'Líder')
  const momentum = momentumInsight(rows, leader)

  return {
    platformId,
    platformLabel,
    metricLabel,
    insights: pairLeaderAndMomentum(leader, momentum),
    empty: false,
  }
}

function chartById(charts: PanoramaPlatformChart[], id: PanoramaPlatformId): PanoramaPlatformChart | undefined {
  return charts.find((c) => c.id === id)
}

function rankByMetric(items: Array<{ slug: string; value: number }>): Map<string, number> {
  const total = items.length
  if (total === 0) return new Map()

  const sorted = [...items].sort((a, b) => b.value - a.value)
  const ranks = new Map<string, number>()

  let rank = 0
  let prevValue: number | null = null
  for (let i = 0; i < sorted.length; i++) {
    const { slug, value } = sorted[i]
    if (value <= 0) {
      ranks.set(slug, total)
      continue
    }
    if (prevValue !== value) rank = i + 1
    ranks.set(slug, rank)
    prevValue = value
  }

  for (const item of items) {
    if (!ranks.has(item.slug)) ranks.set(item.slug, total)
  }

  return ranks
}

function formatRankPosition(rank: number): string {
  return `${rank}º`
}

function instagramMomentumInsight(
  table: PanoramaInstagramTableRow[],
  leader: PanoramaKpiInsight
): PanoramaKpiInsight | null {
  const ranked = table.filter(
    (row) => row.recent7dPostCount > 0 || row.prior7dPostCount > 0 || row.avgEngagement > 0
  )
  if (ranked.length < 2) return null

  const tableOrder = [...ranked].sort((a, b) => b.avgEngagement - a.avgEngagement)
  const lastInTableSlug = tableOrder.at(-1)?.slug
  const leaderSlug = ranked.find((row) => row.name === leader.name)?.slug
  const rankInputs = ranked.map((row) => ({
    slug: row.slug,
    recent: row.recent7dAvgEngagement,
    prior: row.prior7dAvgEngagement,
  }))

  const recentRank = rankByMetric(rankInputs.map((row) => ({ slug: row.slug, value: row.recent })))
  const priorRank = rankByMetric(rankInputs.map((row) => ({ slug: row.slug, value: row.prior })))

  type Climber = {
    row: PanoramaInstagramTableRow
    positions: number
    priorPosition: number
    recentPosition: number
    pct: number | null
    score: number
  }

  const climbers: Climber[] = []

  for (const row of ranked) {
    const priorPosition = priorRank.get(row.slug) ?? ranked.length
    const recentPosition = recentRank.get(row.slug) ?? ranked.length
    const positions = priorPosition - recentPosition
    if (positions <= 0) continue

    // Ainda último na tabela do período ou no ranking recente → não é destaque.
    if (row.slug === lastInTableSlug) continue
    if (recentPosition >= ranked.length) continue

    const pct = growthPct(row.recent7dAvgEngagement, row.prior7dAvgEngagement)
    const isLeader = row.slug === leaderSlug
    const score =
      positions * 100 +
      (pct ?? 0) +
      (row.prior7dPostCount === 0 && row.recent7dPostCount > 0 ? 25 : 0) +
      (isLeader ? -500 : 0)

    climbers.push({ row, positions, priorPosition, recentPosition, pct, score })
  }

  if (climbers.length > 0) {
    const best = [...climbers].sort((a, b) => b.score - a.score)[0]
    const pctSuffix =
      best.pct !== null && best.pct >= MOMENTUM_MIN_PCT ? ` · ${formatPct(best.pct)}` : ''

    return {
      badge: 'growth',
      badgeLabel: MOMENTUM_BADGE,
      name: best.row.name,
      color: best.row.color,
      text: `${formatRankPosition(best.priorPosition)} → ${formatRankPosition(best.recentPosition)}${pctSuffix}`,
    }
  }

  let bestGrowth: { row: PanoramaInstagramTableRow; pct: number } | null = null
  for (const row of ranked) {
    if (row.slug === leaderSlug) continue
    if (row.slug === lastInTableSlug) continue
    if (row.recent7dPostCount <= 0) continue
    const pct = growthPct(row.recent7dAvgEngagement, row.prior7dAvgEngagement)
    if (pct === null || pct < MOMENTUM_MIN_PCT) continue
    if (!bestGrowth || pct > bestGrowth.pct) bestGrowth = { row, pct }
  }

  if (bestGrowth) {
    return {
      badge: 'growth',
      badgeLabel: MOMENTUM_BADGE,
      name: bestGrowth.row.name,
      color: bestGrowth.row.color,
      text: `${formatPct(bestGrowth.pct)}`,
    }
  }

  return null
}

function buildInstagramKpis(table: PanoramaInstagramTableRow[]): PanoramaPlatformKpiCard {
  const active = table.filter((r) => r.postCount > 0 || r.avgEngagement > 0)
  if (active.length === 0) {
    return {
      platformId: 'instagram',
      platformLabel: 'Instagram',
      metricLabel: `${PERIOD_LABEL} · engajamento médio`,
      insights: [],
      empty: true,
    }
  }

  const leaderRow = [...active].sort((a, b) => b.avgEngagement - a.avgEngagement)[0]
  const leader: PanoramaKpiInsight = {
    badge: 'leader',
    badgeLabel: 'Líder',
    name: leaderRow.name,
    color: leaderRow.color,
    text: `${formatInt(leaderRow.avgEngagement)} eng./post`,
  }

  const momentum = instagramMomentumInsight(table, leader)

  return {
    platformId: 'instagram',
    platformLabel: 'Instagram',
    metricLabel: `${PERIOD_LABEL} · engajamento médio`,
    insights: pairLeaderAndMomentum(leader, momentum),
    empty: false,
  }
}

function buildTrendsCard(
  columns: PanoramaCandidateColumn[],
  trendsChart: PanoramaPlatformChart | undefined
): PanoramaPlatformKpiCard {
  const trendsRows = metricsFromTotals(
    columns,
    (col) => trendsLeaderTotal(col, trendsChart),
    trendsChart
  )

  const hasTrendsColumn = columns.some(
    (c) =>
      c.trends !== null &&
      ((c.trends.currentIndex ?? 0) > 0 ||
        (c.trends.peak3m ?? 0) > 0 ||
        (c.trends.points?.length ?? 0) > 0)
  )
  const hasChart = Boolean(trendsChart && !trendsChart.empty)
  const hasValues = trendsRows.some((r) => r.total > 0 || r.recent > 0)

  if (!hasTrendsColumn && !hasChart && !hasValues) {
    return {
      platformId: 'google-trends',
      platformLabel: 'Buscas pelo nome dos candidatos',
      metricLabel: `${PERIOD_LABEL} · acumulado`,
      insights: [],
      empty: true,
    }
  }

  if (!hasValues) {
    return {
      platformId: 'google-trends',
      platformLabel: 'Buscas pelo nome dos candidatos',
      metricLabel: `${PERIOD_LABEL} · acumulado`,
      insights: [],
      empty: true,
    }
  }

  const leader = buildTrendsLeaderInsight(trendsRows, trendsChart)

  let momentum: PanoramaKpiInsight | null = null

  let bestTrendsWeek: { name: string; color: string; pct: number } | null = null
  for (const col of columns) {
    const pct = col.trends?.weekChangePct
    if (pct === null || pct === undefined || pct <= 0) continue
    if (!bestTrendsWeek || pct > bestTrendsWeek.pct) {
      bestTrendsWeek = { name: col.name, color: col.accentColor, pct }
    }
  }

  if (bestTrendsWeek && bestTrendsWeek.pct >= 8) {
    const isLeader = bestTrendsWeek.name === leader?.name
    momentum = {
      badge: 'growth',
      badgeLabel: isLeader ? MOMENTUM_GROWTH_BADGE : MOMENTUM_BADGE,
      name: bestTrendsWeek.name,
      color: bestTrendsWeek.color,
      text: `${formatPct(bestTrendsWeek.pct)}`,
    }
  } else {
    momentum = momentumInsight(trendsRows, leader)
  }

  return {
    platformId: 'google-trends',
    platformLabel: 'Buscas pelo nome dos candidatos',
    metricLabel: `${PERIOD_LABEL} · acumulado`,
    insights: pairLeaderAndMomentum(leader, momentum),
    empty: !leader,
  }
}

function compactSpendLabel(label: string | null): string | null {
  if (!label) return null
  const match = label.match(/R\$\s*[\d.,]+/)
  return match ? match[0] : label
}

function buildMetaAdsCard(
  columns: PanoramaCandidateColumn[],
  metaChart: PanoramaPlatformChart | undefined
): PanoramaPlatformKpiCard {
  type MetaRow = {
    slug: string
    name: string
    color: string
    actorType: PoliticalActorType
    totalAds: number
    spendMid: number
    spendLabel: string | null
  }

  const baseRows: MetaRow[] = columns
    .filter((col) => col.metaAds)
    .map((col) => ({
      slug: col.slug,
      name: col.name,
      color: col.accentColor,
      actorType: col.actorType,
      totalAds: col.metaAds?.totalAds ?? 0,
      spendMid: spendMidpoint(col.metaAds?.spendMinBrl ?? 0, col.metaAds?.spendMaxBrl ?? 0),
      spendLabel: col.metaAds?.spendLabel ?? null,
    }))

  const hasData = baseRows.some((r) => r.totalAds > 0 || r.spendMid > 0)
  if (!hasData) {
    return {
      platformId: 'meta-ads',
      platformLabel: 'Meta Ads',
      metricLabel: `${PERIOD_LABEL} · anúncios`,
      insights: [],
      empty: true,
    }
  }

  const adsLeader = [...baseRows].filter((r) => r.totalAds > 0).sort((a, b) => b.totalAds - a.totalAds)[0]
  const totalAdsSum = baseRows.reduce((sum, row) => sum + row.totalAds, 0)

  const leader: PanoramaKpiInsight | null = adsLeader
    ? (() => {
        const adsShare = sharePct(adsLeader.totalAds, totalAdsSum)
        const adsPart =
          adsShare !== null ? `${adsShare}% anúncios` : `${formatInt(adsLeader.totalAds)} anúncios`
        const spendCompact = compactSpendLabel(adsLeader.spendLabel)

        return {
          badge: 'leader' as const,
          badgeLabel: 'Líder',
          name: adsLeader.name,
          color: adsLeader.color,
          text: spendCompact ? `${adsPart} · ${spendCompact}` : adsPart,
        }
      })()
    : null

  const spendMetricRows: MetricRow[] = baseRows.map((row) => {
    const recent = sumChartSlices(metaChart, row.slug, RECENT_DAYS, RECENT_DAYS)
    const prior = sumChartSlices(metaChart, row.slug, RECENT_DAYS * 2, RECENT_DAYS)
    return {
      slug: row.slug,
      name: row.name,
      color: row.color,
      actorType: row.actorType,
      total: row.spendMid,
      recent: metaChart?.chartData.length ? recent : 0,
      prior: metaChart?.chartData.length ? prior : 0,
    }
  })

  const momentum = momentumInsight(spendMetricRows, leader)

  return {
    platformId: 'meta-ads',
    platformLabel: 'Meta Ads',
    metricLabel: `${PERIOD_LABEL} · anúncios`,
    insights: pairLeaderAndMomentum(leader, momentum),
    empty: !leader,
  }
}

export function buildPanoramaPlatformKpis(panorama: Pick<PanoramaModel, 'columns' | 'charts' | 'windowLabel'>): PanoramaPlatformKpiCard[] {
  const { columns, charts } = panorama
  if (columns.length === 0) return []

  const newsChart = chartById(charts, 'google-news')
  const ytChart = chartById(charts, 'youtube')
  const trendsChart = chartById(charts, 'google-trends')
  const metaChart = chartById(charts, 'meta-ads')
  const igChart = chartById(charts, 'instagram')

  const newsRows = metricsFromTotals(
    columns,
    (c) => columnPeriodTotal(newsChart, c.slug, c.googleNews?.mentions7d ?? 0),
    newsChart
  )

  const igTable = igChart?.instagramTable ?? []

  const ytRows = metricsFromTotals(
    columns,
    (c) => columnPeriodTotal(ytChart, c.slug, c.youtube?.views7d ?? 0),
    ytChart
  )

  return [
    buildCard(
      'google-news',
      'Notícias relacionadas',
      `${PERIOD_LABEL} · menções`,
      newsRows,
      (leader, share) =>
        share !== null && share >= 20
          ? `${share}% das menções`
          : `${formatInt(leader.total)} matérias`
    ),
    buildInstagramKpis(igTable),
    buildCard(
      'youtube',
      'YouTube',
      `${PERIOD_LABEL} · visualizações`,
      ytRows,
      (leader, share) =>
        share !== null && share >= 25
          ? `${share}% das views`
          : `${formatInt(leader.total)} views`
    ),
    buildTrendsCard(columns, trendsChart),
    buildMetaAdsCard(columns, metaChart),
  ]
}
