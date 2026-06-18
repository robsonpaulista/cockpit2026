export type MetricKey =
  | 'avgLikes'
  | 'avgComments'
  | 'avgViews'
  | 'avgShares'
  | 'avgSaves'
  | 'avgEngagement'

export type ComparisonAverages = {
  posts: number
  avgLikes: number
  avgComments: number
  avgViews: number
  avgShares: number
  avgSaves: number
  avgEngagement: number
}

export const COMPARISON_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'avgLikes', label: 'Curtidas' },
  { key: 'avgComments', label: 'Comentários' },
  { key: 'avgViews', label: 'Visualizações' },
  { key: 'avgShares', label: 'Compartilhamentos' },
  { key: 'avgSaves', label: 'Salvamentos' },
  { key: 'avgEngagement', label: 'Engajamento' },
]

export type MetricComparisonResult<TKey extends string> = {
  winnersByMetric: Record<MetricKey, TKey | null>
  maxByMetric: Record<MetricKey, number>
  highlightsByKey: Record<TKey, MetricKey[]>
  relativeStrengthByKey: Record<TKey, MetricKey | null>
  overallLeader: TKey | null
}

function getMetricValue(stats: ComparisonAverages, key: MetricKey): number {
  return stats[key]
}

function pickWinner<TKey extends string>(
  entries: [TKey, ComparisonAverages][],
  key: MetricKey
): { winner: TKey | null; max: number } {
  let winner: TKey | null = null
  let max = 0

  for (const [entryKey, stats] of entries) {
    if (stats.posts <= 0) continue
    const value = getMetricValue(stats, key)
    if (value > max) {
      max = value
      winner = entryKey
    }
  }

  if (max <= 0) {
    return { winner: null, max: 0 }
  }

  const leaders = entries.filter(
    ([, stats]) => stats.posts > 0 && getMetricValue(stats, key) === max
  )

  return { winner: leaders.length === 1 ? leaders[0][0] : null, max }
}

export function computeMetricComparison<TKey extends string>(
  stats: Record<TKey, ComparisonAverages>
): MetricComparisonResult<TKey> {
  const entries = Object.entries(stats) as [TKey, ComparisonAverages][]
  const keys = entries.map(([key]) => key)

  const winnersByMetric = {} as Record<MetricKey, TKey | null>
  const maxByMetric = {} as Record<MetricKey, number>

  for (const metric of COMPARISON_METRICS) {
    const { winner, max } = pickWinner(entries, metric.key)
    winnersByMetric[metric.key] = winner
    maxByMetric[metric.key] = max
  }

  const highlightsByKey = {} as Record<TKey, MetricKey[]>
  const relativeStrengthByKey = {} as Record<TKey, MetricKey | null>

  for (const key of keys) {
    highlightsByKey[key] = []
    relativeStrengthByKey[key] = null
  }

  for (const metric of COMPARISON_METRICS) {
    const winner = winnersByMetric[metric.key]
    if (winner) {
      highlightsByKey[winner].push(metric.key)
    }
  }

  for (const [key, itemStats] of entries) {
    if (itemStats.posts <= 0) continue

    let bestKey: MetricKey | null = null
    let bestRatio = -1

    for (const metric of COMPARISON_METRICS) {
      const max = maxByMetric[metric.key]
      if (max <= 0) continue
      const ratio = getMetricValue(itemStats, metric.key) / max
      if (ratio > bestRatio) {
        bestRatio = ratio
        bestKey = metric.key
      }
    }

    relativeStrengthByKey[key] = bestKey
  }

  const winsCount = entries
    .filter(([, itemStats]) => itemStats.posts > 0)
    .map(([key, itemStats]) => ({
      key,
      wins: highlightsByKey[key].length,
      engagement: itemStats.avgEngagement,
    }))
    .sort((a, b) => b.wins - a.wins || b.engagement - a.engagement)

  const overallLeader =
    winsCount.length > 0 && winsCount[0].wins > 0 ? winsCount[0].key : null

  return {
    winnersByMetric,
    maxByMetric,
    highlightsByKey,
    relativeStrengthByKey,
    overallLeader,
  }
}

export function formatMetricValue(key: MetricKey, value: number): string {
  if (value <= 0 && key !== 'avgLikes' && key !== 'avgComments' && key !== 'avgEngagement') {
    return 'N/A'
  }
  return value.toLocaleString('pt-BR')
}

export function getMetricRatio(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.round((value / max) * 100)
}
