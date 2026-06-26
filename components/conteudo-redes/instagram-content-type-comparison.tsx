'use client'

import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import {
  Camera,
  Crown,
  Download,
  Eye,
  Heart,
  Layers,
  MessageCircle,
  Share2,
  TrendingUp,
  Trophy,
  Video,
} from 'lucide-react'
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
import {
  conteudoRedesAmberBorderTintClass,
  conteudoRedesAmberRingClass,
  conteudoRedesAmberTextClass,
  conteudoRedesTextClass,
} from '@/lib/conteudo-redes-styles'

const TYPE_CONFIG: Record<
  ContentTypeKey,
  { icon: typeof Camera; iconClass: string; accentClass: string }
> = {
  image: {
    icon: Camera,
    iconClass: conteudoRedesAmberTextClass,
    accentClass: 'border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface',
  },
  video: {
    icon: Video,
    iconClass: conteudoRedesAmberTextClass,
    accentClass: 'border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface',
  },
  carousel: {
    icon: Layers,
    iconClass: conteudoRedesAmberTextClass,
    accentClass: 'border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface',
  },
}

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

type InstagramContentTypeComparisonProps = {
  contentStats: ContentStatsBundle
  sectionClassName?: string
  panelClassName?: string
}

function MetricRow({
  metricKey,
  label,
  value,
  max,
  isLeader,
}: {
  metricKey: MetricKey
  label: string
  value: number
  max: number
  isLeader: boolean
}) {
  const Icon = METRIC_ICONS[metricKey]
  const ratio = getMetricRatio(value, max)

  return (
    <div
      className={cn(
        'rounded-lg px-2.5 py-2 transition-colors',
        isLeader ? 'border border-status-success/25 bg-status-success/8' : 'border border-transparent'
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={cn('flex min-w-0 items-center gap-1.5 text-sm', conteudoRedesTextClass)}>
          <Icon className={cn('h-3.5 w-3.5 shrink-0', METRIC_ICON_CLASS[metricKey])} />
          <span className="truncate">{label}</span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {isLeader && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-status-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success">
              <Trophy className="h-3 w-3" />
              Líder
            </span>
          )}
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              isLeader ? 'text-status-success' : conteudoRedesTextClass
            )}
          >
            {formatMetricValue(metricKey, value)}
          </span>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isLeader ? 'bg-status-success' : 'bg-[#C8900A]/55'
          )}
          style={{ width: `${Math.max(ratio, value > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export function InstagramContentTypeComparison({
  contentStats,
  sectionClassName = '',
  panelClassName = 'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-background/50 p-3',
}: InstagramContentTypeComparisonProps) {
  const comparison = computeContentTypeComparison(contentStats)

  return (
    <div className={sectionClassName}>
      <PremiumSectionHeader
        title="Comparativo de Aceitação por Tipo de Conteúdo"
        description="Análise comparativa de desempenho entre Imagens, Vídeos e Carrosséis"
      />

      <div className="mb-5 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app/60 p-4">
        <p className={cn('mb-3 text-xs font-semibold uppercase tracking-wide', conteudoRedesTextClass)}>
          Melhor tipo por indicador
        </p>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPE_METRICS.map((metric) => {
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
                <span className="font-semibold">
                  {winner ? CONTENT_TYPE_LABELS[winner] : 'Empate / sem dados'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CONTENT_TYPE_ORDER.map((type) => {
          const stats = contentStats[type]
          const config = TYPE_CONFIG[type]
          const TypeIcon = config.icon
          const highlights = comparison.highlightsByKey[type]
          const relativeStrength = comparison.relativeStrengthByKey[type]
          const isOverallLeader = comparison.overallLeader === type

          if (stats.posts <= 0) {
            return (
              <div key={type} className={cn(panelClassName, 'opacity-70')}>
                <div className="mb-4 flex items-center gap-2">
                  <TypeIcon className={cn('h-5 w-5', config.iconClass)} />
                  <div>
                    <h3 className={cn('text-lg font-semibold', conteudoRedesTextClass)}>
                      {CONTENT_TYPE_LABELS[type]}
                    </h3>
                    <p className={cn('text-sm', conteudoRedesTextClass)}>Sem postagens no período</p>
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
                isOverallLeader && conteudoRedesAmberRingClass,
                config.accentClass
              )}
            >
              <div className="mb-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className={cn('flex items-center gap-2 text-lg font-semibold', conteudoRedesTextClass)}>
                    <TypeIcon className={cn('h-5 w-5', config.iconClass)} />
                    {CONTENT_TYPE_LABELS[type]}
                  </h3>
                  {isOverallLeader && (
                    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide', conteudoRedesAmberBorderTintClass, conteudoRedesAmberTextClass)}>
                      <Crown className="h-3 w-3" />
                      Destaque geral
                    </span>
                  )}
                </div>
                <p className={cn('text-sm', conteudoRedesTextClass)}>{stats.posts} postagens</p>
                {strengthLabel && (
                  <p className={cn('mt-2 text-xs font-medium', conteudoRedesTextClass)}>{strengthLabel}</p>
                )}
                {highlights.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {highlights.map((metricKey: MetricKey) => {
                      const metric = CONTENT_TYPE_METRICS.find((item) => item.key === metricKey)
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

              <div>
                <p className={cn('mb-2 text-xs', conteudoRedesTextClass)}>Média por postagem</p>
                <div className="space-y-1.5">
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
