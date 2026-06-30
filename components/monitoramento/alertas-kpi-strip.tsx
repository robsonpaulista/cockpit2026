'use client'

import { AlertTriangle, Newspaper, Star } from 'lucide-react'
import { QuickAccessKpiStrip, type QuickAccessKpiCardModel } from '@/components/monitoramento/quick-access-kpi-card'

interface AlertasKpiStripProps {
  hojeCount: number
  riscoAltoCount: number
  destacadasCount: number
}

function buildCards(hojeCount: number, riscoAltoCount: number, destacadasCount: number): QuickAccessKpiCardModel[] {
  return [
    {
      id: 'hoje',
      icon: Newspaper,
      title: 'Notícias hoje',
      metricLabel: 'INBOX · CAPTADAS HOJE',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Volume',
          text: `${hojeCount} notícias captadas hoje`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Filtro',
          text: 'Itens com data de publicação no dia',
        },
      ],
    },
    {
      id: 'risco-alto',
      icon: AlertTriangle,
      title: 'Risco alto',
      metricLabel: 'INBOX · ALERTAS',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Alertas',
          text: `${riscoAltoCount} notícias com risco alto`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Prioridade',
          text: 'Requer atenção imediata da equipe',
        },
      ],
    },
    {
      id: 'destacadas',
      icon: Star,
      title: 'Destacadas',
      metricLabel: 'INBOX · MARCAÇÃO',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Painel',
          text: `${destacadasCount} notícias em destaque`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Monitor',
          text: 'Marcadas para painel ou monitor',
        },
      ],
    },
  ]
}

export function AlertasKpiStrip({ hojeCount, riscoAltoCount, destacadasCount }: AlertasKpiStripProps) {
  return (
    <QuickAccessKpiStrip
      cards={buildCards(hojeCount, riscoAltoCount, destacadasCount)}
      gridClassName="min-[480px]:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3"
    />
  )
}
