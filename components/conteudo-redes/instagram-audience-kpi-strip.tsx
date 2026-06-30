'use client'

import { Activity, ExternalLink, Eye, Users } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import { formatFollowersDelta } from '@/lib/instagram-followers-history-chart'

interface InstagramAudienceKpiStripProps {
  followers: number
  profileViews: number
  reach: number
  websiteClicks: number
  periodGrowth?: number
  growthPercentage?: number
  totalProfileViewsInPeriod?: number
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function buildCards({
  followers,
  profileViews,
  reach,
  websiteClicks,
  periodGrowth,
  growthPercentage,
  totalProfileViewsInPeriod,
}: InstagramAudienceKpiStripProps): QuickAccessKpiCardModel[] {
  const metricLabel = 'INSTAGRAM · AUDIÊNCIA'

  const followersGrowthText =
    typeof periodGrowth === 'number' && periodGrowth !== 0
      ? `${formatFollowersDelta(periodGrowth)} no período (${growthPercentage ?? 0}%)`
      : 'Base ativa monitorada no perfil'

  const profileViewsSecondary =
    typeof totalProfileViewsInPeriod === 'number' && totalProfileViewsInPeriod > 0
      ? `${formatCount(totalProfileViewsInPeriod)} visitas acumuladas no período`
      : 'Visualizações recentes do perfil'

  return [
    {
      id: 'followers',
      icon: Users,
      title: 'Seguidores',
      metricLabel: `${metricLabel} · BASE`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Total',
          text: `${formatCount(followers)} seguidores no perfil`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Variação',
          text: followersGrowthText,
        },
      ],
    },
    {
      id: 'profile-views',
      icon: Eye,
      title: 'Visitas ao perfil',
      metricLabel: `${metricLabel} · TRÁFEGO`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Visitas',
          text: `${formatCount(profileViews)} visitas ao perfil`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Período',
          text: profileViewsSecondary,
        },
      ],
    },
    {
      id: 'reach',
      icon: Activity,
      title: 'Alcance',
      metricLabel: `${metricLabel} · EXPOSIÇÃO`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Alcance',
          text: `${formatCount(reach)} contas únicas alcançadas`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Escopo',
          text: 'Pessoas que viram o conteúdo no recorte',
        },
      ],
    },
    {
      id: 'website-clicks',
      icon: ExternalLink,
      title: 'Cliques no link',
      metricLabel: `${metricLabel} · CONVERSÃO`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Cliques',
          text: `${formatCount(websiteClicks)} cliques no link da bio`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Destino',
          text: 'Saídas do perfil para o link externo',
        },
      ],
    },
  ]
}

export function InstagramAudienceKpiStrip(props: InstagramAudienceKpiStripProps) {
  return (
    <QuickAccessKpiStrip
      cards={buildCards(props)}
      gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-4"
    />
  )
}
