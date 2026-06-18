import type { ComparisonAverages } from '@/lib/instagram-metric-comparison'
import { computeMetricComparison } from '@/lib/instagram-metric-comparison'

export type ThemeStatsBundle = Record<string, ComparisonAverages>

export function computeThemeComparison(stats: ThemeStatsBundle) {
  return computeMetricComparison(stats)
}
