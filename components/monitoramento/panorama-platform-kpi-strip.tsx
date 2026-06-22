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
import type { PanoramaPlatformKpiCard, PanoramaKpiBadge } from '@/lib/monitoramento-panorama-kpis'
import type { PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
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

const BADGE_STYLES: Record<
  PanoramaKpiBadge,
  { icon: LucideIcon; className: string }
> = {
  leader: {
    icon: Trophy,
    className: 'border-[#D1E7FF] bg-[#F0F7FF] text-[#1E4A7A]',
  },
  growth: {
    icon: TrendingUp,
    className: 'border-[#CDE8C1] bg-[#F3FAEF] text-[#2D5A1E]',
  },
  outsider: {
    icon: Zap,
    className: 'border-[#FDE6B8] bg-[#FFFBF0] text-[#8A5A00]',
  },
}

function KpiInsightRow({
  insight,
}: {
  insight: PanoramaPlatformKpiCard['insights'][number]
}) {
  const style = BADGE_STYLES[insight.badge]
  const BadgeIcon = style.icon
  const isStable = insight.badgeLabel === 'Estável'

  return (
    <div className="space-y-1">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
          style.className
        )}
      >
        <BadgeIcon className="h-2.5 w-2.5" aria-hidden />
        {insight.badgeLabel}
      </span>
      {insight.name ? (
        <p className="text-[11px] leading-snug">
          <span className="font-semibold" style={{ color: insight.color }}>
            {insight.name}
          </span>
          <span className="text-text-secondary"> · {insight.text}</span>
        </p>
      ) : (
        <p className={cn('text-[11px] leading-snug', isStable ? 'text-text-muted' : 'text-text-secondary')}>
          {insight.text}
        </p>
      )}
    </div>
  )
}

function PlatformKpiCard({ card }: { card: PanoramaPlatformKpiCard }) {
  const PlatformIcon = PLATFORM_ICONS[card.platformId]
  const leader = card.insights.find((insight) => insight.badge === 'leader')
  const momentum = card.insights.find((insight) => insight.badge === 'growth')

  return (
    <article
      className={cn(
        'flex min-h-[8.5rem] min-w-0 flex-col rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-3',
        card.empty && 'opacity-70'
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app text-[rgb(var(--color-primary))]">
          <PlatformIcon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h4 className="truncate text-xs font-semibold text-text-primary">{card.platformLabel}</h4>
          <p className="truncate text-[10px] text-text-muted">{card.metricLabel}</p>
        </div>
      </div>

      {card.empty ? (
        <p className="mt-auto text-[11px] leading-snug text-text-muted">Sem dados coletados neste período.</p>
      ) : (
        <div className="flex flex-1 flex-col gap-2.5">
          {leader ? <KpiInsightRow insight={leader} /> : null}
          {momentum ? (
            <div className="mt-auto border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2.5">
              <KpiInsightRow insight={momentum} />
            </div>
          ) : null}
        </div>
      )}
    </article>
  )
}

interface PanoramaPlatformKpiStripProps {
  cards: PanoramaPlatformKpiCard[]
}

export function PanoramaPlatformKpiStrip({ cards }: PanoramaPlatformKpiStripProps) {
  if (cards.length === 0) return null

  const ordered = PLATFORM_ORDER.map((id) => cards.find((c) => c.platformId === id)).filter(
    (c): c is PanoramaPlatformKpiCard => Boolean(c)
  )

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Leitura rápida por plataforma
        </h3>
        <p className="mt-1 text-[11px] text-text-muted">
          Líder no período · maior avanço nos últimos 7 dias.
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-5 gap-2">
        {ordered.map((card) => (
          <PlatformKpiCard key={card.platformId} card={card} />
        ))}
      </div>
    </section>
  )
}
