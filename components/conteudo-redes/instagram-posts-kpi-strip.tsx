'use client'

import { BarChart3, Users } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import {
  formatEngagementValue,
  formatFollowersDelta,
} from '@/lib/instagram-followers-history-chart'

interface InstagramPostsKpiStripProps {
  currentFollowers?: number
  currentAvgEngagement?: number
  postsCount: number
  periodLabel: string
  growth?: number
  growthPercentage?: number
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function buildCards({
  currentFollowers,
  currentAvgEngagement,
  postsCount,
  periodLabel,
  growth,
  growthPercentage,
}: InstagramPostsKpiStripProps): QuickAccessKpiCardModel[] {
  const cards: QuickAccessKpiCardModel[] = []
  const periodMetric = `${periodLabel.toUpperCase()} · INSTAGRAM`

  if (typeof currentFollowers === 'number') {
    const growthText =
      typeof growth === 'number' && growth !== 0
        ? `${formatFollowersDelta(growth)} no período (${growthPercentage ?? 0}%)`
        : `Monitoramento ativo no recorte de ${periodLabel.toLowerCase()}`

    cards.push({
      id: 'followers',
      icon: Users,
      title: 'Seguidores atuais',
      metricLabel: `${periodMetric} · AUDIÊNCIA`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Total',
          text: `${formatCount(currentFollowers)} seguidores no perfil`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Variação',
          text: growthText,
        },
      ],
    })
  }

  if (typeof currentAvgEngagement === 'number' && currentAvgEngagement > 0) {
    cards.push({
      id: 'engagement',
      icon: BarChart3,
      title: 'Engajamento médio',
      metricLabel: `${periodMetric} · PUBLICAÇÕES`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Média',
          text: `${formatEngagementValue(currentAvgEngagement)} eng. por publicação`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Base',
          text: `${formatCount(postsCount)} posts no recorte analisado`,
        },
      ],
    })
  }

  return cards
}

export function InstagramPostsKpiStrip(props: InstagramPostsKpiStripProps) {
  const cards = buildCards(props)
  if (cards.length === 0) return null

  return (
    <QuickAccessKpiStrip
      cards={cards}
      gridClassName={
        cards.length === 1
          ? 'grid-cols-1 sm:grid-cols-1 xl:grid-cols-1'
          : 'grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-2'
      }
    />
  )
}
