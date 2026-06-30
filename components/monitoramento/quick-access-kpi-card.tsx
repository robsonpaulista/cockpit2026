'use client'

import { TrendingUp, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
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

export const QUICK_ACCESS_KPI_ICON_CLASS = 'text-[#C8900A]'

export type QuickAccessKpiBadge = 'leader' | 'growth' | 'outsider'

export type QuickAccessKpiInsight = {
  badge: QuickAccessKpiBadge
  badgeLabel: string
  name?: string
  text: string
}

export type QuickAccessKpiCardModel = {
  id: string
  icon: LucideIcon
  title: string
  metricLabel: string
  insights: QuickAccessKpiInsight[]
  empty?: boolean
  emptyMessage?: string
}

const BADGE_ICONS: Record<QuickAccessKpiBadge, LucideIcon> = {
  leader: Trophy,
  growth: TrendingUp,
  outsider: Zap,
}

type ParsedMetric = {
  value: number
  suffix: string
  format: 'int' | 'decimal' | 'currency'
}

function parseMetricText(text: string): ParsedMetric | null {
  const pct = text.match(/^(\d+)%\s*(.*)$/)
  if (pct) {
    return { value: Number(pct[1]), suffix: `%${pct[2] ? ` ${pct[2]}` : ''}`, format: 'int' }
  }

  const brl = text.match(/^(R\$\s*[\d.]+)\s*(.*)$/i)
  if (brl) {
    const num = Number(brl[1].replace(/[^\d]/g, ''))
    if (Number.isFinite(num)) {
      return { value: num, suffix: brl[2] ? ` ${brl[2]}` : '', format: 'currency' }
    }
  }

  const intLeading = text.match(/^([\d.]+)\s+(.+)$/)
  if (intLeading) {
    const num = Number(intLeading[1].replace(/\./g, ''))
    if (Number.isFinite(num)) {
      return { value: num, suffix: ` ${intLeading[2]}`, format: 'int' }
    }
  }

  const slash = text.match(/^(\d+)\/(\d+)$/)
  if (slash) {
    return { value: Number(slash[1]), suffix: `/${slash[2]}`, format: 'int' }
  }

  return null
}

function QuickAccessKpiMetricText({ text, resetKey }: { text: string; resetKey: number }) {
  const parsed = parseMetricText(text)
  if (!parsed) {
    return <span className={typographyBodyClass}>{text}</span>
  }

  return (
    <span className={typographyBodyClass}>
      <AnimatedCounter value={parsed.value} format={parsed.format} resetKey={resetKey} />
      {parsed.suffix}
    </span>
  )
}

export function QuickAccessKpiInsightRow({
  insight,
  resetKey,
}: {
  insight: QuickAccessKpiInsight
  resetKey: number
}) {
  const BadgeIcon = BADGE_ICONS[insight.badge]
  const iconOnly = insight.badge === 'leader' || insight.badge === 'growth'

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {iconOnly ? (
        <span
          className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center', QUICK_ACCESS_KPI_ICON_CLASS)}
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
          <BadgeIcon className={cn('h-3.5 w-3.5', QUICK_ACCESS_KPI_ICON_CLASS)} aria-hidden />
          {insight.badgeLabel}
        </span>
      )}
      {insight.name ? (
        <p
          className={cn(
            'min-w-0 flex-1 leading-snug line-clamp-2 sm:line-clamp-none sm:truncate',
            typographyBodyClass
          )}
          title={`${insight.name} · ${insight.text}`}
        >
          <span className="text-text-primary">{insight.name}</span>
          <span className="text-text-primary"> · </span>
          <QuickAccessKpiMetricText text={insight.text} resetKey={resetKey} />
        </p>
      ) : (
        <p className={cn('min-w-0 flex-1 truncate leading-snug', typographyBodyMutedClass)} title={insight.text}>
          {insight.text}
        </p>
      )}
    </div>
  )
}

export function QuickAccessKpiCard({
  card,
  index = 0,
  animationEpoch = 0,
}: {
  card: QuickAccessKpiCardModel
  index?: number
  animationEpoch?: number
}) {
  const Icon = card.icon
  const primary = card.insights[0]
  const secondary = card.insights[1]

  return (
    <article
      className={cn(
        'flex min-w-0 flex-col rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-3',
        'min-h-[6.5rem] sm:min-h-[7rem]',
        premiumCardHoverClass,
        premiumStaggerClass(index),
        card.empty && 'opacity-70'
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className={dashboardChromeIconShellSmClass}>
          <Icon className={cn('h-3.5 w-3.5', QUICK_ACCESS_KPI_ICON_CLASS)} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className={cn('leading-snug sm:truncate', typographySectionTitleClass)}>{card.title}</h4>
          <p className={cn('leading-snug uppercase font-normal sm:truncate', typographySectionLabelClass)}>
            {card.metricLabel}
          </p>
        </div>
      </div>

      {card.empty ? (
        <p className={cn('mt-auto leading-snug', typographyBodyMutedClass)}>
          {card.emptyMessage ?? 'Sem dados coletados neste período.'}
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {primary ? <QuickAccessKpiInsightRow insight={primary} resetKey={animationEpoch} /> : null}
          {secondary ? (
            <div className="mt-auto border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2">
              <QuickAccessKpiInsightRow insight={secondary} resetKey={animationEpoch} />
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}

export function QuickAccessKpiStrip({
  title,
  lead,
  cards,
  animationEpoch = 0,
  gridClassName,
}: {
  title?: string
  lead?: string
  cards: QuickAccessKpiCardModel[]
  animationEpoch?: number
  gridClassName?: string
}) {
  if (cards.length === 0) return null

  return (
    <section>
      {title ? (
        <div className="mb-3">
          <h3 className={typographySectionLabelClass}>{title}</h3>
          {lead ? <p className={cn('mt-1 hidden sm:block', typographySectionLeadClass)}>{lead}</p> : null}
        </div>
      ) : null}
      <div
        className={cn(
          'grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
          gridClassName
        )}
      >
        {cards.map((card, index) => (
          <QuickAccessKpiCard key={card.id} card={card} index={index} animationEpoch={animationEpoch} />
        ))}
      </div>
    </section>
  )
}
