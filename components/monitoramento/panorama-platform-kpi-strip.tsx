'use client'

import { Instagram, LineChart, Megaphone, Newspaper, Youtube, type LucideIcon } from 'lucide-react'
import {
  QuickAccessKpiCard,
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import type { PanoramaPlatformKpiCard } from '@/lib/monitoramento-panorama-kpis'
import type { PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import { typographySectionLabelClass, typographySectionLeadClass } from '@/lib/typography-chrome'
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

function toQuickAccessCard(card: PanoramaPlatformKpiCard): QuickAccessKpiCardModel {
  return {
    id: card.platformId,
    icon: PLATFORM_ICONS[card.platformId],
    title: card.platformLabel,
    metricLabel: card.metricLabel,
    insights: card.insights.map((insight) => ({
      badge: insight.badge,
      badgeLabel: insight.badgeLabel,
      name: insight.name,
      text: insight.text,
    })),
    empty: card.empty,
  }
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
        <p className={cn('mt-1 hidden sm:block', typographySectionLeadClass)}>
          O primeiro indicador resume os últimos 30 dias; o segundo destaca quem mais avançou na comparação dos
          últimos 7 dias com a semana anterior.
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ordered.map((card, index) => (
          <QuickAccessKpiCard
            key={card.platformId}
            card={toQuickAccessCard(card)}
            index={index}
            animationEpoch={animationEpoch}
          />
        ))}
      </div>
    </section>
  )
}
