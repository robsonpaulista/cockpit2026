'use client'

import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import {
  COMPARISON_METRICS,
  formatMetricValue,
  getMetricRatio,
  type MetricKey,
} from '@/lib/instagram-metric-comparison'
import { computeThemeComparison, type ThemeStatsBundle } from '@/lib/instagram-theme-comparison'
import { cn } from '@/lib/utils'

type InstagramThemeComparisonTableProps = {
  themeStats: ThemeStatsBundle
  sectionClassName?: string
  panelClassName?: string
}

function MetricCell({
  metricKey,
  value,
  max,
  isLeader,
}: {
  metricKey: MetricKey
  value: number
  max: number
  isLeader: boolean
}) {
  const ratio = getMetricRatio(value, max)

  return (
    <div className="min-w-[6.5rem]">
      <p
        className={cn(
          'text-right text-[13px] tabular-nums',
          isLeader ? 'font-semibold text-[#1c1917]' : 'font-medium text-[#1c1917]'
        )}
      >
        {formatMetricValue(metricKey, value)}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#f3f1ec]">
        <div
          className={cn(
            'ml-auto h-full rounded-full',
            isLeader ? 'bg-[#ff9800]' : 'bg-[#d6d3d1]'
          )}
          style={{ width: `${Math.max(ratio, value > 0 ? 6 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export function InstagramThemeComparisonTable({
  themeStats,
  sectionClassName = '',
  panelClassName = 'overflow-hidden rounded-[18px] border border-[#ebe8e4] bg-white shadow-[0_1px_2px_rgba(28,25,23,0.03)]',
}: InstagramThemeComparisonTableProps) {
  const comparison = computeThemeComparison(themeStats)

  const sortedThemes = Object.entries(themeStats).sort(([keyA, a], [keyB, b]) => {
    const winsA = comparison.highlightsByKey[keyA]?.length ?? 0
    const winsB = comparison.highlightsByKey[keyB]?.length ?? 0
    if (winsB !== winsA) return winsB - winsA
    return b.avgEngagement - a.avgEngagement
  })

  return (
    <div className={sectionClassName}>
      <PremiumSectionHeader
        title="Comparativo por tema"
        description="Médias por postagem em cada tema classificado"
      />

      <div className="mb-5 rounded-[14px] border border-[#ebe8e4] bg-[#fafaf8] px-4 py-3">
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
          Melhor tema por indicador
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {COMPARISON_METRICS.map((metric) => {
            const winner = comparison.winnersByMetric[metric.key]
            return (
              <p key={metric.key} className="text-[13px] text-[#57534e]">
                <span className="text-[#a8a29e]">{metric.label}</span>
                <span className="mx-1.5 text-[#d6d3d1]">·</span>
                <span className="font-medium text-[#1c1917]">{winner ?? 'Empate'}</span>
              </p>
            )
          })}
        </div>
      </div>

      <div className={panelClassName}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe8e4]">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Tema
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
                  Posts
                </th>
                {COMPARISON_METRICS.map((metric) => (
                  <th
                    key={metric.key}
                    className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]"
                  >
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedThemes.map(([theme, stats]) => {
                const highlights = comparison.highlightsByKey[theme] ?? []
                const relativeStrength = comparison.relativeStrengthByKey[theme]
                const isOverallLeader = comparison.overallLeader === theme

                const strengthLabel =
                  highlights.length > 0
                    ? `Lidera em ${highlights.length} indicador${highlights.length > 1 ? 'es' : ''}`
                    : relativeStrength
                      ? `Ponto forte: ${
                          COMPARISON_METRICS.find((metric) => metric.key === relativeStrength)
                            ?.label ?? ''
                        }`
                      : null

                return (
                  <tr
                    key={theme}
                    className={cn(
                      'border-b border-[#f3f1ec] last:border-0',
                      isOverallLeader ? 'bg-[#fffdf8]' : 'hover:bg-[#fafaf8]'
                    )}
                  >
                    <td className="px-4 py-3.5 align-top">
                      <div className="min-w-[9rem] space-y-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              'text-[13px] font-medium text-[#1c1917]',
                              isOverallLeader && 'font-semibold'
                            )}
                          >
                            {theme}
                          </span>
                          {isOverallLeader ? (
                            <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-[#c27803]">
                              Destaque
                            </span>
                          ) : null}
                        </div>
                        {strengthLabel ? (
                          <p className="text-[12px] text-[#78716c]">{strengthLabel}</p>
                        ) : null}
                        {highlights.length > 0 ? (
                          <p className="text-[12px] text-[#a8a29e]">
                            {highlights
                              .map(
                                (metricKey) =>
                                  COMPARISON_METRICS.find((item) => item.key === metricKey)?.label
                              )
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top text-[13px] tabular-nums text-[#57534e]">
                      {stats.posts}
                    </td>
                    {COMPARISON_METRICS.map((metric) => (
                      <td key={metric.key} className="px-4 py-3.5 text-right align-top">
                        <MetricCell
                          metricKey={metric.key}
                          value={stats[metric.key]}
                          max={comparison.maxByMetric[metric.key]}
                          isLeader={comparison.winnersByMetric[metric.key] === theme}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
