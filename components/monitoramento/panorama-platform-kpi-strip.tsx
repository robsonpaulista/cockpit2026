'use client'

import {
  Instagram,
  LineChart,
  Megaphone,
  Newspaper,
  TrendingUp,
  Trophy,
  Zap,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import type { PanoramaPlatformKpiCard, PanoramaKpiBadge } from '@/lib/monitoramento-panorama-kpis'
import type { PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import { premiumCardHoverClass, premiumStaggerClass } from '@/lib/premium-ui-motion'
import { dashboardChromeIconShellSmClass } from '@/lib/sidebar-apify-styles'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyBodyMutedClass,
  typographySectionLabelClass,
  typographySectionLeadClass,
  typographySectionTitleClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const PLATFORM_ORDER: PanoramaPlatformId[] = [
  'google-news',
  'instagram',
  'youtube',
  'google-trends',
  'meta-ads',
]

const PLATFORM_ICONS: Record<PanoramaPlatformId, LucideIcon> = {
  'google-news': Newspaper,
  instagram: Instagram,
  youtube: Youtube,
  'google-trends': LineChart,
  'meta-ads': Megaphone,
}

const KPI_ICON_CLASS = 'text-[#C8900A]'

const BADGE_ICONS: Record<PanoramaKpiBadge, LucideIcon> = {
  leader: Trophy,
  growth: TrendingUp,
  outsider: Zap,
}

type ParsedMetric = {
  value: number
  prefix: string
  suffix: string
  format: 'int' | 'decimal' | 'currency'
}

function parseMetricText(text: string): ParsedMetric | null {
  const pct = text.match(/^(\d+)%\s*(.*)$/)
  if (pct) {
    return { value: Number(pct[1]), prefix: '', suffix: `%${pct[2] ? ` ${pct[2]}` : ''}`, format: 'int' }
  }

  const brl = text.match(/^(R\$\s*[\d.]+)\s*(.*)$/i)
  if (brl) {
    const num = Number(brl[1].replace(/[^\d]/g, ''))
    if (Number.isFinite(num)) {
      return { value: num, prefix: '', suffix: brl[2] ? ` ${brl[2]}` : '', format: 'currency' }
    }
  }

  const intLeading = text.match(/^([\d.]+)\s+(.+)$/)
  if (intLeading) {
    const num = Number(intLeading[1].replace(/\./g, ''))
    if (Number.isFinite(num)) {
      return { value: num, prefix: '', suffix: ` ${intLeading[2]}`, format: 'int' }
    }
  }

  const slash = text.match(/^(\d+)\/(\d+)$/)
  if (slash) {
    return { value: Number(slash[1]), prefix: '', suffix: `/${slash[2]}`, format: 'int' }
  }

  return null
}

function KpiMetricText({
  text,
  resetKey,
}: {
  text: string
  resetKey: number
}) {
  const parsed = parseMetricText(text)
  if (!parsed) {
    return <span className={typographyBodyClass}>{text}</span>
  }

  return (
    <span className={typographyBodyClass}>
      <AnimatedCounter
        value={parsed.value}
        format={parsed.format}
        resetKey={resetKey}
      />
      {parsed.suffix}
    </span>
  )
}

function KpiInsightRow({
  insight,
  resetKey,
}: {
  insight: PanoramaPlatformKpiCard['insights'][number]
  resetKey: number
}) {
  const BadgeIcon = BADGE_ICONS[insight.badge]
  const iconOnly = insight.badge === 'leader' || insight.badge === 'growth'

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {iconOnly ? (
        <span
          className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center', KPI_ICON_CLASS)}
          title={insight.badgeLabel}
          aria-label={insight.badgeLabel}
        >
          <BadgeIcon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app px-2 py-0.5',
            typographyBodyMediumClass
          )}
        >
          <BadgeIcon className={cn('h-3.5 w-3.5', KPI_ICON_CLASS)} aria-hidden />
          {insight.badgeLabel}
        </span>
      )}
      {insight.name ? (
        <p
          className={cn('min-w-0 flex-1 truncate leading-snug', typographyBodyClass)}
          title={`${insight.name} · ${insight.text}`}
        >
          <span className="text-text-primary">{insight.name}</span>
          <span className="text-text-primary"> · </span>
          <KpiMetricText text={insight.text} resetKey={resetKey} />
        </p>
      ) : (
        <p
          className={cn('min-w-0 flex-1 truncate leading-snug', typographyBodyMutedClass)}
          title={insight.text}
        >
          {insight.text}
        </p>
      )}
    </div>
  )
}

function PlatformKpiCard({
  card,
  index,
  animationEpoch,
}: {
  card: PanoramaPlatformKpiCard
  index: number
  animationEpoch: number
}) {
  const PlatformIcon = PLATFORM_ICONS[card.platformId]
  const leader = card.insights.find((insight) => insight.badge === 'leader')
  const momentum = card.insights.find((insight) => insight.badge === 'growth')

  return (
    <article
      className={cn(
        'flex min-h-[7rem] min-w-0 flex-col rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-3',
        premiumCardHoverClass,
        premiumStaggerClass(index),
        card.empty && 'opacity-70'
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className={dashboardChromeIconShellSmClass}>
          <PlatformIcon className={cn('h-3.5 w-3.5', KPI_ICON_CLASS)} aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className={cn('truncate', typographySectionTitleClass)}>{card.platformLabel}</h4>
          <p className={cn('truncate uppercase font-normal', typographySectionLabelClass)}>{card.metricLabel}</p>
        </div>
      </div>

      {card.empty ? (
        <p className={cn('mt-auto leading-snug', typographyBodyMutedClass)}>Sem dados coletados neste período.</p>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {leader ? <KpiInsightRow insight={leader} resetKey={animationEpoch} /> : null}
          {momentum ? (
            <div className="mt-auto border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2">
              <KpiInsightRow insight={momentum} resetKey={animationEpoch} />
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}

interface PanoramaPlatformKpiStripProps {
  cards: PanoramaPlatformKpiCard[]
  animationEpoch?: number
}

export function PanoramaPlatformKpiStrip({ cards, animationEpoch = 0 }: PanoramaPlatformKpiStripProps) {
  if (cards.length === 0) return null

  const ordered = PLATFORM_ORDER.map((id) => cards.find((c) => c.platformId === id)).filter(
    (c): c is PanoramaPlatformKpiCard => Boolean(c)
  )

  return (
    <section>
      <div className="mb-3">
        <h3 className={typographySectionLabelClass}>Leitura rápida por plataforma</h3>
        <p className={cn('mt-1', typographySectionLeadClass)}>
          Líder no período · maior avanço nos últimos 7 dias.
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-5 gap-2">
        {ordered.map((card, index) => (
          <PlatformKpiCard key={card.platformId} card={card} index={index} animationEpoch={animationEpoch} />
        ))}
      </div>
    </section>
  )
}
