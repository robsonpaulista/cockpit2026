'use client'

import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import {
  Crown,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import {
  COMPARISON_METRICS,
  formatMetricValue,
  getMetricRatio,
  type MetricKey,
} from '@/lib/instagram-metric-comparison'
import { computeThemeComparison, type ThemeStatsBundle } from '@/lib/instagram-theme-comparison'
import { cn } from '@/lib/utils'
import {
  conteudoRedesAmberBorderTintClass,
  conteudoRedesAmberTextClass,
  conteudoRedesTextClass,
} from '@/lib/conteudo-redes-styles'

const METRIC_ICONS = {
  avgLikes: Heart,
  avgComments: MessageCircle,
  avgViews: Eye,
  avgShares: Share2,
  avgSaves: Download,
  avgEngagement: TrendingUp,
} as const

const METRIC_ICON_CLASS = {
  avgLikes: 'text-red-500',
  avgComments: conteudoRedesAmberTextClass,
  avgViews: conteudoRedesAmberTextClass,
  avgShares: 'text-green-500',
  avgSaves: 'text-orange-500',
  avgEngagement: conteudoRedesAmberTextClass,
} as const

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
  const Icon = METRIC_ICONS[metricKey]
  const ratio = getMetricRatio(value, max)

  return (
    <div
      className={cn(
        'min-w-[7.5rem] rounded-lg px-2 py-1.5',
        isLeader ? 'border border-status-success/25 bg-status-success/8' : ''
      )}
    >
      <div className="flex items-center justify-end gap-1.5">
        <Icon className={cn('h-3 w-3 shrink-0', METRIC_ICON_CLASS[metricKey])} />
        <span
          className={cn(
            'font-semibold tabular-nums',
            isLeader ? 'text-status-success' : conteudoRedesTextClass
          )}
        >
          {formatMetricValue(metricKey, value)}
        </span>
        {isLeader && <Trophy className="h-3 w-3 shrink-0 text-status-success" />}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background">
        <div
          className={cn('h-full rounded-full', isLeader ? 'bg-status-success' : 'bg-[#C8900A]/55')}
          style={{ width: `${Math.max(ratio, value > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export function InstagramThemeComparisonTable({
  themeStats,
  sectionClassName = '',
  panelClassName = 'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-background/50 overflow-hidden',
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
        title="Tabela Comparativa Detalhada por tema"
        description="Métricas completas de cada tema classificado"
      />

      <div className="mb-5 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app/60 p-4">
        <p className={cn('mb-3 text-xs font-semibold uppercase tracking-wide', conteudoRedesTextClass)}>
          Melhor tema por indicador
        </p>
        <div className="flex flex-wrap gap-2">
          {COMPARISON_METRICS.map((metric) => {
            const winner = comparison.winnersByMetric[metric.key]
            const MetricIcon = METRIC_ICONS[metric.key]

            return (
              <div
                key={metric.key}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
                  winner
                    ? cn('text-black', conteudoRedesAmberBorderTintClass)
                    : cn('border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface', conteudoRedesTextClass)
                )}
              >
                <MetricIcon className={cn('h-3.5 w-3.5', METRIC_ICON_CLASS[metric.key])} />
                <span className="font-medium">{metric.label}</span>
                <span className={conteudoRedesTextClass}>→</span>
                <span className="font-semibold">{winner ?? 'Empate / sem dados'}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={panelClassName}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card bg-surface-secondary">
                <th className={cn('p-4 text-left font-semibold', conteudoRedesTextClass)}>Tema</th>
                <th className={cn('p-4 text-right font-semibold', conteudoRedesTextClass)}>Postagens</th>
                {COMPARISON_METRICS.map((metric) => (
                  <th key={metric.key} className={cn('p-4 text-right font-semibold', conteudoRedesTextClass)}>
                    {metric.label} (média)
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
                      'border-b border-card transition-colors hover:bg-surface-secondary',
                      isOverallLeader && 'bg-[#C8900A]/12'
                    )}
                  >
                    <td className="p-4 align-top">
                      <div className="min-w-[10rem] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              conteudoRedesTextClass,
                              isOverallLeader && cn('font-semibold', conteudoRedesAmberTextClass)
                            )}
                          >
                            {theme}
                          </span>
                          {isOverallLeader && (
                            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', conteudoRedesAmberBorderTintClass, conteudoRedesAmberTextClass)}>
                              <Crown className="h-3 w-3" />
                              Destaque
                            </span>
                          )}
                        </div>
                        {strengthLabel && (
                          <p className={cn('text-xs font-medium', conteudoRedesTextClass)}>{strengthLabel}</p>
                        )}
                        {highlights.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {highlights.map((metricKey) => {
                              const metric = COMPARISON_METRICS.find(
                                (item) => item.key === metricKey
                              )
                              if (!metric) return null
                              return (
                                <span
                                  key={metricKey}
                                  className="rounded-full border border-status-success/20 bg-status-success/10 px-2 py-0.5 text-[10px] font-semibold text-status-success"
                                >
                                  {metric.label}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={cn('p-4 text-right align-top', conteudoRedesTextClass)}>{stats.posts}</td>
                    {COMPARISON_METRICS.map((metric) => (
                      <td key={metric.key} className="p-4 text-right align-top">
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
