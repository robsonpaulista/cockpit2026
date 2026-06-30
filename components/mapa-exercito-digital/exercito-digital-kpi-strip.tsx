'use client'

import { AlertTriangle, Image, MessageCircle, PieChart } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import { formatInt, formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalKpis } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'

interface ExercitoDigitalKpiStripProps {
  kpis: ExercitoDigitalKpis
  audience: ExercitoDigitalAudience
  referenceMonthLabel: string
}

function buildCards(
  kpis: ExercitoDigitalKpis,
  audience: ExercitoDigitalAudience,
  referenceMonthLabel: string
): QuickAccessKpiCardModel[] {
  const redeLabel =
    audience === 'unificado' ? 'perfis da base' : audience === 'mandatos' ? 'mandatários' : 'líderes'
  const comentariosRedeLabel =
    audience === 'unificado' ? 'base eleitoral' : audience === 'mandatos' ? 'mandatários' : 'liderados'

  const metaFooter = kpis.abaixoMeta
    ? `abaixo de ${formatInt(kpis.metaPct)}% · meta ${formatInt(kpis.metaPct)}%`
    : `meta ${formatInt(kpis.metaPct)}%`

  return [
    {
      id: 'ativacao',
      icon: PieChart,
      title: 'Ativação geral',
      metricLabel: `${referenceMonthLabel.toUpperCase()} · REDE`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Ativação',
          text: `${formatPct(kpis.ativacaoPct)} de ativação na rede`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Cobertura',
          text: `${formatInt(kpis.lideresAtivados)}/${formatInt(kpis.lideresMedidos)} ${redeLabel} · ${metaFooter}`,
        },
      ],
    },
    {
      id: 'comentarios',
      icon: MessageCircle,
      title: 'Comentários gerados',
      metricLabel: `${referenceMonthLabel.toUpperCase()} · VOLUME`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Total',
          text: `${formatInt(kpis.comentariosTotal)} comentários no mês`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Origem',
          text: `${formatInt(kpis.comentariosLiderados)} ${comentariosRedeLabel} · ${formatInt(kpis.comentariosOrganicos)} org.`,
        },
      ],
    },
    {
      id: 'municipios',
      icon: AlertTriangle,
      title: 'Municípios críticos',
      metricLabel: `${referenceMonthLabel.toUpperCase()} · COBERTURA`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Críticos',
          text: `${formatInt(kpis.municipiosCriticos)} municípios sem tração`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Critério',
          text: 'Sem comentários ou 0% de ativação',
        },
      ],
    },
    {
      id: 'publicacoes',
      icon: Image,
      title: 'Publicações analisadas',
      metricLabel: `${referenceMonthLabel.toUpperCase()} · POSTS`,
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Volume',
          text: `${formatInt(kpis.publicacoesAnalisadas)} publicações no período`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Base',
          text: `Posts dos ${redeLabel} monitorados`,
        },
      ],
    },
  ]
}

export function ExercitoDigitalKpiStrip({ kpis, audience, referenceMonthLabel }: ExercitoDigitalKpiStripProps) {
  const cards = buildCards(kpis, audience, referenceMonthLabel)

  return (
    <QuickAccessKpiStrip
      cards={cards}
      gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-4"
    />
  )
}
