'use client'

import { Camera, Layers, Video } from 'lucide-react'
import { TseCard, TsePill } from '@/components/tse/tse-ui'
import {
  computeContentTypeComparison,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_METRICS,
  CONTENT_TYPE_ORDER,
  formatMetricValue,
  getMetricRatio,
  type ContentStatsBundle,
  type ContentTypeKey,
} from '@/lib/instagram-content-type-comparison'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<ContentTypeKey, typeof Camera> = {
  image: Camera,
  video: Video,
  carousel: Layers,
}

const rotuloMetrica = (key: string): string => CONTENT_TYPE_METRICS.find((m) => m.key === key)?.label ?? ''

export function InstagramContentTypeComparison({ contentStats }: { contentStats: ContentStatsBundle }) {
  const comparison = computeContentTypeComparison(contentStats)

  return (
    <TseCard titulo="Comparativo por tipo de conteúdo" subtitulo="Média por publicação de imagens, vídeos e carrosséis">
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg bg-[var(--tse-bar)] px-3 py-2 text-[12px]">
        <span className="font-bold uppercase tracking-wide text-[var(--tse-muted)]">Melhor tipo</span>
        {CONTENT_TYPE_METRICS.map((metric) => {
          const winner = comparison.winnersByMetric[metric.key]
          return (
            <span key={metric.key}>
              <span className="text-[var(--tse-muted)]">{metric.label}:</span>{' '}
              <strong>{winner ? CONTENT_TYPE_LABELS[winner] : 'Empate'}</strong>
            </span>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {CONTENT_TYPE_ORDER.map((type) => {
          const stats = contentStats[type]
          const Icone = TYPE_ICONS[type]
          const highlights = comparison.highlightsByKey[type]
          const relativeStrength = comparison.relativeStrengthByKey[type]
          const destaque = comparison.overallLeader === type

          if (stats.posts <= 0) {
            return (
              <div key={type} className="rounded-xl border border-[var(--tse-border)] p-4 opacity-60">
                <div className="flex items-center gap-2">
                  <Icone className="h-4 w-4 text-[var(--tse-muted)]" />
                  <p className="text-[14px] font-bold">{CONTENT_TYPE_LABELS[type]}</p>
                </div>
                <p className="mt-1 text-[12px] text-[var(--tse-muted)]">Sem publicações no período</p>
              </div>
            )
          }

          const forca =
            highlights.length > 0
              ? `Lidera em ${highlights.map(rotuloMetrica).join(', ')}`
              : relativeStrength
                ? `Ponto forte: ${rotuloMetrica(relativeStrength)}`
                : null

          return (
            <div
              key={type}
              className={cn(
                'rounded-xl border p-4',
                destaque ? 'border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)]' : 'border-[var(--tse-border)]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icone className="h-4 w-4 text-[var(--tse-gold-text)]" />
                  <div>
                    <p className="text-[14px] font-bold uppercase">{CONTENT_TYPE_LABELS[type]}</p>
                    <p className="text-[12px] text-[var(--tse-muted)]">
                      {stats.posts} {stats.posts === 1 ? 'publicação' : 'publicações'}
                    </p>
                  </div>
                </div>
                {destaque ? <TsePill tom="amarelo">Destaque</TsePill> : null}
              </div>
              {forca ? <p className="mt-2 text-[12px] text-[var(--tse-muted)]">{forca}</p> : null}

              <div className="mt-3 space-y-2.5">
                {CONTENT_TYPE_METRICS.map((metric) => {
                  const valor = stats[metric.key]
                  const lider = comparison.winnersByMetric[metric.key] === type
                  const ratio = getMetricRatio(valor, comparison.maxByMetric[metric.key])
                  return (
                    <div key={metric.key}>
                      <div className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span>{metric.label}</span>
                        <span className={cn('tabular-nums', lider ? 'font-black' : 'font-semibold')}>
                          {formatMetricValue(metric.key, valor)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#EEEEEE]">
                        <div
                          className={cn('h-full', lider ? 'bg-[var(--tse-yellow)]' : 'bg-[var(--tse-zero)]')}
                          style={{ width: `${Math.max(ratio, valor > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </TseCard>
  )
}
