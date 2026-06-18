import {
  computeMetricComparison,
  type ComparisonAverages,
  type MetricKey,
} from '@/lib/instagram-metric-comparison'

export type ContentTypeKey = 'image' | 'video' | 'carousel'

export type {
  ComparisonAverages,
  MetricKey,
} from '@/lib/instagram-metric-comparison'

export {
  COMPARISON_METRICS as CONTENT_TYPE_METRICS,
  formatMetricValue,
  getMetricRatio,
} from '@/lib/instagram-metric-comparison'

export type ContentTypeAverages = ComparisonAverages
export type ContentStatsBundle = Record<ContentTypeKey, ContentTypeAverages>

export type ContentTypeComparison = ReturnType<typeof computeContentTypeComparison>

export const CONTENT_TYPE_ORDER: ContentTypeKey[] = ['image', 'video', 'carousel']

export const CONTENT_TYPE_LABELS: Record<ContentTypeKey, string> = {
  image: 'Imagens',
  video: 'Vídeos',
  carousel: 'Carrosséis',
}

export function computeContentTypeComparison(stats: ContentStatsBundle) {
  return computeMetricComparison(stats)
}
