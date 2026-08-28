'use client'

import { ArrowRight, LineChart as LineChartIcon, Megaphone, X, Youtube } from 'lucide-react'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import {
  MetaAdsPanoramaLineChart,
  PanoramaTrendsLegacyLineChart,
} from '@/components/monitoramento/panorama-platform-chart'
import { PanoramaYoutubeChart } from '@/components/monitoramento/panorama-youtube-chart'
import type { PanoramaCandidateColumn } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'
import {
  buildMetaAdsIntelModel,
  buildTrendsIntelModel,
  buildYoutubeIntelModel,
  formatIntelCompact,
  formatIntelDelta,
  resolvePanoramaFocusSlug,
  type MetaAdsTimelineCell,
} from '@/lib/monitoramento/panorama-intelligence-view-models'
import { cn } from '@/lib/utils'
import '@/app/dashboard/war-room/panorama-intelligence.css'

type ExpandTarget = 'youtube' | 'google-trends' | 'meta-ads'

const CARD_META: Record<
  ExpandTarget,
  { icon: typeof Youtube; title: string; expandLabel: string; modalTitle: string }
> = {
  youtube: {
    icon: Youtube,
    title: 'Força no YouTube',
    expandLabel: 'Ver evolução',
    modalTitle: 'YouTube · evolução temporal',
  },
  'google-trends': {
    icon: LineChartIcon,
    title: 'Pulso de interesse',
    expandLabel: 'Ver evolução',
    modalTitle: 'Interesse de busca · evolução temporal',
  },
  'meta-ads': {
    icon: Megaphone,
    title: 'Radar de mídia',
    expandLabel: 'Ver todos',
    modalTitle: 'Anúncios · evolução temporal',
  },
}

type Props = {
  charts: PanoramaPlatformChart[]
  columns: PanoramaCandidateColumn[]
  animationEpoch?: number
}

function periodSuffix(subtitle: string): string {
  const parts = subtitle.split('·')
  return parts[parts.length - 1]?.trim() ?? 'período'
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <svg className="wr-pi-spark" viewBox="0 0 64 24" aria-hidden />
  }
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const w = 64
  const h = 24
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * w
      const y = h - ((value - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="wr-pi-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={points} fill="none" stroke="#25272B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IntelCardShell({
  chartId,
  subtitle,
  children,
  footer,
  expandLabel,
  onExpand,
  staggerIndex = 0,
}: {
  chartId: ExpandTarget
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  expandLabel: string
  onExpand: () => void
  staggerIndex?: number
}) {
  const meta = CARD_META[chartId]
  const Icon = meta.icon

  return (
    <article
      className="wr-pi-card"
      style={{ ['--wr-pi-i' as string]: staggerIndex }}
      aria-label={meta.title}
    >
      <header className="wr-pi-card__head">
        <div className="wr-pi-card__head-main">
          <span className="wr-pi-card__icon" aria-hidden>
            <Icon size={14} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h3 className="wr-pi-card__title">{meta.title}</h3>
            <p className="wr-pi-card__sub">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="wr-pi-card__body">{children}</div>

      {footer ? <footer className="wr-pi-card__foot">{footer}</footer> : null}

      <button type="button" className="wr-pi-card__expand" onClick={onExpand}>
        {expandLabel}
        <ArrowRight size={12} strokeWidth={2.2} aria-hidden />
      </button>
    </article>
  )
}

function IntelEmpty({ message }: { message: string }) {
  return <p className="wr-pi-empty">{message}</p>
}

function TimelineCell({ kind }: { kind: MetaAdsTimelineCell }) {
  return (
    <span className={cn('wr-pi-timeline__cell', `wr-pi-timeline__cell--${kind}`)} aria-hidden>
      {kind === 'dot' ? '·' : kind === 'soft' ? '▪' : kind === 'strong' ? '█' : '·'}
    </span>
  )
}

function PanoramaIntelligenceExpandModal({
  chart,
  onClose,
}: {
  chart: PanoramaPlatformChart
  onClose: () => void
}) {
  const titleId = useId()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  const meta = CARD_META[chart.id as ExpandTarget]

  return createPortal(
    <div className="wr-visita-modal" role="presentation">
      <button type="button" className="wr-visita-modal__backdrop" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="wr-visita-modal__panel wr-pi-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <p className="wr-visita-modal__eyebrow">Radar · série histórica</p>
            <h2 id={titleId} className="wr-visita-modal__title truncate">
              {meta?.modalTitle ?? chart.title}
            </h2>
          </div>
          <button type="button" className="wr-visita-modal__close" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>
        <div className="wr-pi-modal__body">
          {chart.id === 'youtube' ? (
            <PanoramaYoutubeChart chart={chart} className="min-h-[420px] flex-1" />
          ) : chart.id === 'google-trends' ? (
            <PanoramaTrendsLegacyLineChart chart={chart} />
          ) : chart.id === 'meta-ads' ? (
            <MetaAdsPanoramaLineChart chart={chart} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function YoutubeIntelCard({
  chart,
  focusSlug,
  onExpand,
  staggerIndex,
}: {
  chart: PanoramaPlatformChart
  focusSlug: string | null
  onExpand: () => void
  staggerIndex: number
}) {
  const model = useMemo(() => buildYoutubeIntelModel(chart, focusSlug), [chart, focusSlug])

  return (
    <IntelCardShell
      chartId="youtube"
      subtitle={`Quem concentra mais visualizações · ${periodSuffix(chart.subtitle)}`}
      expandLabel={CARD_META.youtube.expandLabel}
      onExpand={onExpand}
      staggerIndex={staggerIndex}
      footer={
        model.focus && !model.focusInTop5 ? (
          <div className="wr-pi-context">
            <span className="wr-pi-context__label">Nossa posição</span>
            <strong>
              {model.focus.name} · {model.focus.rank}º · {formatIntelCompact(model.focus.total)}
            </strong>
            {model.focusRankDelta != null ? (
              <span className="wr-pi-context__meta">
                {model.focusRankDelta > 0
                  ? `↑ ${model.focusRankDelta} posição no período`
                  : model.focusRankDelta < 0
                    ? `↓ ${Math.abs(model.focusRankDelta)} posição no período`
                    : 'Estável no período'}
              </span>
            ) : null}
          </div>
        ) : model.focus && model.focusInTop5 && model.focusRankDelta != null ? (
          <div className="wr-pi-context">
            <span className="wr-pi-context__label">Nossa posição</span>
            <strong>
              {model.focus.rank}º lugar
            </strong>
            <span className="wr-pi-context__meta">
              {model.focusRankDelta > 0
                ? `↑ ${model.focusRankDelta} posição no período`
                : model.focusRankDelta < 0
                  ? `↓ ${Math.abs(model.focusRankDelta)} posição no período`
                  : 'Estável no período'}
            </span>
          </div>
        ) : null
      }
    >
      {!model.hasData ? (
        <IntelEmpty message="Dados insuficientes para este período." />
      ) : (
        <ol className="wr-pi-rank">
          {model.top5.map((row, index) => (
            <li
              key={row.slug}
              className="wr-pi-rank__row"
              style={{ ['--wr-pi-row-i' as string]: index }}
            >
              <span className="wr-pi-rank__pos tabular-nums">{String(row.rank).padStart(2, '0')}</span>
              <div className="wr-pi-rank__main min-w-0">
                <div className="wr-pi-rank__head">
                  <span className="wr-pi-rank__name truncate" title={row.name}>
                    {row.name}
                  </span>
                  <span className="wr-pi-rank__val tabular-nums">{formatIntelCompact(row.total)}</span>
                  {row.rank === 1 ? (
                    <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                  ) : null}
                </div>
                <span className="wr-pi-rank__bar" aria-hidden>
                  <i style={{ ['--wr-pi-bar' as string]: `${row.barPct}%` }} />
                </span>
              </div>
            </li>
          ))}
          {model.focus && !model.focusInTop5 ? (
            <li className="wr-pi-rank__row wr-pi-rank__row--focus">
              <span className="wr-pi-rank__pos tabular-nums">{String(model.focus.rank).padStart(2, '0')}</span>
              <div className="wr-pi-rank__main min-w-0">
                <div className="wr-pi-rank__head">
                  <span className="wr-pi-rank__name truncate" title={model.focus.name}>
                    {model.focus.name}
                  </span>
                  <span className="wr-pi-rank__val tabular-nums">
                    {formatIntelCompact(model.focus.total)}
                  </span>
                </div>
                <span className="wr-pi-rank__bar" aria-hidden>
                  <i
                    style={{
                      ['--wr-pi-bar' as string]: `${Math.max(
                        8,
                        Math.round(
                          (model.focus.total / Math.max(model.top5[0]?.total ?? model.focus.total, 1)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </span>
              </div>
            </li>
          ) : null}
        </ol>
      )}
    </IntelCardShell>
  )
}

function TrendsIntelCard({
  chart,
  focusSlug,
  onExpand,
  staggerIndex,
}: {
  chart: PanoramaPlatformChart
  focusSlug: string | null
  onExpand: () => void
  staggerIndex: number
}) {
  const model = useMemo(() => buildTrendsIntelModel(chart, focusSlug), [chart, focusSlug])

  return (
    <IntelCardShell
      chartId="google-trends"
      subtitle={chart.subtitle}
      expandLabel={CARD_META['google-trends'].expandLabel}
      onExpand={onExpand}
      staggerIndex={staggerIndex}
      footer={
        model.focus ? (
          <div className="wr-pi-context wr-pi-context--cols">
            <div>
              <span className="wr-pi-context__label">Nossa posição</span>
              <strong>{model.focus.rank}º</strong>
            </div>
            {model.focus.peak > 0 ? (
              <div>
                <span className="wr-pi-context__label">Maior pico</span>
                <strong className="tabular-nums">{Math.round(model.focus.peak)}</strong>
              </div>
            ) : null}
            {model.movementLabel ? (
              <div>
                <span className="wr-pi-context__label">Movimento</span>
                <strong>
                  {model.movementLabel === 'Crescendo'
                    ? '↑ Crescendo'
                    : model.movementLabel === 'Caindo'
                      ? '↓ Caindo'
                      : 'Estável'}
                </strong>
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      {!model.hasData ? (
        <IntelEmpty message="Dados insuficientes para este período." />
      ) : (
        <ol className="wr-pi-pulse">
          {model.top5.map((row, index) => (
            <li
              key={row.slug}
              className="wr-pi-pulse__row"
              style={{ ['--wr-pi-row-i' as string]: index }}
            >
              <span className="wr-pi-pulse__pos tabular-nums">{String(row.rank).padStart(2, '0')}</span>
              <span className="wr-pi-pulse__name truncate" title={row.name}>
                {row.name}
              </span>
              <strong className="wr-pi-pulse__val tabular-nums">{Math.round(row.current)}</strong>
              <MiniSparkline values={row.spark} />
              <span
                className={cn(
                  'wr-pi-pulse__delta tabular-nums',
                  row.deltaTone === 'up' && 'wr-pi-pulse__delta--up',
                  row.deltaTone === 'down' && 'wr-pi-pulse__delta--down',
                )}
              >
                {formatIntelDelta(row.deltaPct)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </IntelCardShell>
  )
}

function MetaAdsIntelCard({
  chart,
  focusSlug,
  onExpand,
  staggerIndex,
}: {
  chart: PanoramaPlatformChart
  focusSlug: string | null
  onExpand: () => void
  staggerIndex: number
}) {
  const model = useMemo(() => buildMetaAdsIntelModel(chart, focusSlug), [chart, focusSlug])

  return (
    <IntelCardShell
      chartId="meta-ads"
      subtitle={`Atividade de anúncios · ${periodSuffix(chart.subtitle)}`}
      expandLabel={CARD_META['meta-ads'].expandLabel}
      onExpand={onExpand}
      staggerIndex={staggerIndex}
      footer={
        model.focusPresence ? (
          <div className="wr-pi-context">
            <span className="wr-pi-context__label">Nossa presença</span>
            <strong>
              {model.focusPresence.activeCount}{' '}
              {model.focusPresence.activeCount === 1 ? 'anúncio ativo' : 'anúncios ativos'}
              {model.focusPresence.daysSinceLast != null
                ? ` · última entrada há ${model.focusPresence.daysSinceLast} ${
                    model.focusPresence.daysSinceLast === 1 ? 'dia' : 'dias'
                  }`
                : ''}
            </strong>
          </div>
        ) : null
      }
    >
      {!model.hasData ? (
        <IntelEmpty message="Dados insuficientes para este período." />
      ) : (
        <div className="wr-pi-media">
          <div className="wr-pi-media__block">
            <p className="wr-pi-media__label">Ativos agora</p>
            <ul className="wr-pi-media__active">
              {model.activeNow.map((row) => (
                <li key={row.slug} className="wr-pi-media__active-row">
                  <span className="wr-pi-media__name truncate" title={row.name}>
                    {row.name}
                  </span>
                  <span
                    className={cn(
                      'wr-pi-media__status',
                      row.active ? 'wr-pi-media__status--on' : 'wr-pi-media__status--off',
                    )}
                  >
                    <i aria-hidden />
                    {row.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="wr-pi-media__count tabular-nums">
                    {row.active ? `${row.activeCount} anúncio${row.activeCount === 1 ? '' : 's'}` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {model.timeline.length > 0 ? (
            <div className="wr-pi-media__block wr-pi-media__block--timeline">
              <p className="wr-pi-media__label">Timeline</p>
              <div
                className="wr-pi-timeline"
                style={{ ['--wr-pi-days' as string]: model.dateLabels.length }}
              >
                <div className="wr-pi-timeline__head" aria-hidden>
                  <span />
                  {model.dateLabels.map((label) => (
                    <span key={label} className="wr-pi-timeline__day tabular-nums">
                      {label}
                    </span>
                  ))}
                </div>
                {model.timeline.map((row) => (
                  <div key={row.slug} className="wr-pi-timeline__row">
                    <span className="wr-pi-timeline__name truncate" title={row.name}>
                      {row.name.split(/\s+/)[0]}
                    </span>
                    {row.cells.map((cell, index) => (
                      <TimelineCell key={`${row.slug}-${index}`} kind={cell} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {model.recentEvents.length > 0 ? (
            <div className="wr-pi-media__block">
              <p className="wr-pi-media__label">Movimento recente</p>
              <ul className="wr-pi-media__events">
                {model.recentEvents.map((event) => (
                  <li key={`${event.date}-${event.name}`} className="wr-pi-media__event">
                    <span className="wr-pi-media__event-date">{event.dateLabel}</span>
                    <span className="wr-pi-media__event-name truncate" title={event.name}>
                      {event.name}
                    </span>
                    <span className="wr-pi-media__event-count tabular-nums">+{event.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </IntelCardShell>
  )
}

export function PanoramaIntelligenceSection({ charts, columns, animationEpoch = 0 }: Props) {
  const [expanded, setExpanded] = useState<PanoramaPlatformChart | null>(null)
  const focusSlug = useMemo(() => resolvePanoramaFocusSlug(columns), [columns])

  const youtube = charts.find((c) => c.id === 'youtube')
  const trends = charts.find((c) => c.id === 'google-trends')
  const meta = charts.find((c) => c.id === 'meta-ads')

  return (
    <>
      <div className="wr-pi-grid" key={animationEpoch}>
        {youtube ? (
          <YoutubeIntelCard
            chart={youtube}
            focusSlug={focusSlug}
            onExpand={() => setExpanded(youtube)}
            staggerIndex={0}
          />
        ) : null}
        {trends ? (
          <TrendsIntelCard
            chart={trends}
            focusSlug={focusSlug}
            onExpand={() => setExpanded(trends)}
            staggerIndex={1}
          />
        ) : null}
        {meta ? (
          <MetaAdsIntelCard
            chart={meta}
            focusSlug={focusSlug}
            onExpand={() => setExpanded(meta)}
            staggerIndex={2}
          />
        ) : null}
      </div>

      {expanded ? (
        <PanoramaIntelligenceExpandModal chart={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </>
  )
}
