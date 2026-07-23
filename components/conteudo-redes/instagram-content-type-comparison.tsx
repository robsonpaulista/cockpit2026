'use client'

import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import { Camera, Layers, Video } from 'lucide-react'
import {
  computeContentTypeComparison,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_METRICS,
  CONTENT_TYPE_ORDER,
  formatMetricValue,
  getMetricRatio,
  type ContentStatsBundle,
  type ContentTypeKey,
  type MetricKey,
} from '@/lib/instagram-content-type-comparison'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<ContentTypeKey, typeof Camera> = {
  image: Camera,
  video: Video,
  carousel: Layers,
}

type InstagramContentTypeComparisonProps = {
  contentStats: ContentStatsBundle
  sectionClassName?: string
  panelClassName?: string
}

function MetricRow({
  label,
  value,
  max,
  metricKey,
  isLeader,
}: {
  label: string
  value: number
  max: number
  metricKey: MetricKey
  isLeader: boolean
}) {
  const ratio = getMetricRatio(value, max)

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-[13px] text-[#57534e]">{label}</span>
        <span
          className={cn(
            'shrink-0 text-[13px] tabular-nums',
            isLeader ? 'font-semibold text-[#1c1917]' : 'font-medium text-[#1c1917]'
          )}
        >
          {formatMetricValue(metricKey, value)}
          {isLeader ? (
            <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-[#a8a29e]">
              líder
            </span>
          ) : null}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[#f3f1ec]">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isLeader ? 'bg-[#ff9800]' : 'bg-[#d6d3d1]'
          )}
          style={{ width: `${Math.max(ratio, value > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export function InstagramContentTypeComparison({
  contentStats,
  sectionClassName = '',
  panelClassName = 'rounded-[18px] border border-[#ebe8e4] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.03)]',
}: InstagramContentTypeComparisonProps) {
  const comparison = computeContentTypeComparison(contentStats)

  return (
    <div className={sectionClassName}>
      <PremiumSectionHeader
        title="Comparativo por tipo de conteúdo"
        description="Desempenho médio de imagens, vídeos e carrosséis no período"
      />

      <div className="mb-5 rounded-[14px] border border-[#ebe8e4] bg-[#fafaf8] px-4 py-3">
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
          Melhor tipo por indicador
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {CONTENT_TYPE_METRICS.map((metric) => {
            const winner = comparison.winnersByMetric[metric.key]
            return (
              <p key={metric.key} className="text-[13px] text-[#57534e]">
                <span className="text-[#a8a29e]">{metric.label}</span>
                <span className="mx-1.5 text-[#d6d3d1]">·</span>
                <span className="font-medium text-[#1c1917]">
                  {winner ? CONTENT_TYPE_LABELS[winner] : 'Empate'}
                </span>
              </p>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CONTENT_TYPE_ORDER.map((type) => {
          const stats = contentStats[type]
          const TypeIcon = TYPE_ICONS[type]
          const highlights = comparison.highlightsByKey[type]
          const relativeStrength = comparison.relativeStrengthByKey[type]
          const isOverallLeader = comparison.overallLeader === type

          if (stats.posts <= 0) {
            return (
              <div key={type} className={cn(panelClassName, 'opacity-60')}>
                <div className="flex items-center gap-2.5">
                  <TypeIcon className="h-4 w-4 text-[#a8a29e]" strokeWidth={1.75} />
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1917]">
                      {CONTENT_TYPE_LABELS[type]}
                    </h3>
                    <p className="text-[12px] text-[#a8a29e]">Sem postagens no período</p>
                  </div>
                </div>
              </div>
            )
          }

          const strengthLabel =
            highlights.length > 0
              ? `Lidera em ${highlights.length} indicador${highlights.length > 1 ? 'es' : ''}`
              : relativeStrength
                ? `Ponto forte: ${
                    CONTENT_TYPE_METRICS.find((metric) => metric.key === relativeStrength)?.label ??
                    ''
                  }`
                : null

          return (
            <div
              key={type}
              className={cn(
                panelClassName,
                isOverallLeader && 'border-[#ffd59a] bg-[#fffdf8]'
              )}
            >
              <div className="mb-3 border-b border-[#ebe8e4] pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TypeIcon className="h-4 w-4 shrink-0 text-[#78716c]" strokeWidth={1.75} />
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold tracking-tight text-[#1c1917]">
                        {CONTENT_TYPE_LABELS[type]}
                      </h3>
                      <p className="text-[12px] text-[#78716c]">
                        {stats.posts} {stats.posts === 1 ? 'postagem' : 'postagens'}
                      </p>
                    </div>
                  </div>
                  {isOverallLeader ? (
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.04em] text-[#c27803]">
                      Destaque
                    </span>
                  ) : null}
                </div>
                {strengthLabel ? (
                  <p className="mt-2 text-[12px] text-[#78716c]">{strengthLabel}</p>
                ) : null}
                {highlights.length > 0 ? (
                  <p className="mt-1 text-[12px] text-[#a8a29e]">
                    {highlights
                      .map(
                        (metricKey) =>
                          CONTENT_TYPE_METRICS.find((item) => item.key === metricKey)?.label
                      )
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </div>

              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                Média por postagem
              </p>
              <div className="divide-y divide-[#f3f1ec]">
                {CONTENT_TYPE_METRICS.map((metric) => (
                  <MetricRow
                    key={metric.key}
                    metricKey={metric.key}
                    label={metric.label}
                    value={stats[metric.key]}
                    max={comparison.maxByMetric[metric.key]}
                    isLeader={comparison.winnersByMetric[metric.key] === type}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
