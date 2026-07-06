'use client'

import { AlertTriangle, CheckCircle2, MapPin, MinusCircle } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import type { IptResumo } from '@/lib/ipt'

function buildCards(resumo: IptResumo): QuickAccessKpiCardModel[] {
  return [
    {
      id: 'monitorados',
      icon: MapPin,
      title: 'Municípios no mapa',
      metricLabel: 'DECISÃO · COBERTURA',
      insights: [
        { badge: 'leader', badgeLabel: 'Total', text: `${resumo.municipiosMonitorados} municípios` },
        {
          badge: 'growth',
          badgeLabel: 'Leitura',
          text:
            resumo.semExpectativa > 0
              ? `${resumo.semExpectativa} sem expectativa · filtro por cor`
              : 'Check rápido por cor',
        },
      ],
    },
    {
      id: 'criticos',
      icon: AlertTriangle,
      title: 'Prioridade crítica',
      metricLabel: 'DECISÃO · VERMELHO',
      insights: [
        { badge: 'leader', badgeLabel: 'Urgente', text: `${resumo.criticos} municípios em vermelho` },
        { badge: 'growth', badgeLabel: 'Ação', text: 'Expectativa alta · resultado fraco' },
      ],
    },
    {
      id: 'atencao',
      icon: MinusCircle,
      title: 'Precisam atenção',
      metricLabel: 'DECISÃO · LARANJA',
      insights: [
        { badge: 'leader', badgeLabel: 'Atenção', text: `${resumo.atencao} municípios em laranja` },
        { badge: 'growth', badgeLabel: 'Revisar', text: 'Visitas, obras ou pesquisa' },
      ],
    },
    {
      id: 'fortes',
      icon: CheckCircle2,
      title: 'Estamos bem',
      metricLabel: 'DECISÃO · VERDE',
      insights: [
        { badge: 'leader', badgeLabel: 'Ok', text: `${resumo.fortes} municípios em verde` },
        { badge: 'growth', badgeLabel: 'Manter', text: `${resumo.estaveis} em amarelo · acompanhar` },
      ],
    },
  ]
}

export function IptKpiStrip({ resumo }: { resumo: IptResumo }) {
  return <QuickAccessKpiStrip cards={buildCards(resumo)} />
}
