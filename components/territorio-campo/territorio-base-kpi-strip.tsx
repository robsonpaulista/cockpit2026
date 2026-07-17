'use client'

import { FileText, MapPin, Target, Users } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import type { KPI } from '@/types'

interface TerritorioBaseKpiStripProps {
  kpis: KPI[]
  totalRegistros: number
  cenarioLabel: string
  cidadesUnicasCount: number
}

function buildCards({
  kpis,
  totalRegistros,
  cenarioLabel,
  cidadesUnicasCount,
}: TerritorioBaseKpiStripProps): QuickAccessKpiCardModel[] {
  return kpis.map((kpi) => {
    switch (kpi.id) {
      case 'liderancas':
        return {
          id: kpi.id,
          icon: Users,
          title: 'Lideranças atuais',
          metricLabel: 'BASE · FILTRADA',
          insights: [
            {
              badge: 'leader',
              badgeLabel: 'Ativas',
              text: `${kpi.value} lideranças na seleção atual`,
            },
            {
              badge: 'growth',
              badgeLabel: 'Total',
              text: `de ${totalRegistros} registros totais`,
            },
          ],
        }
      case 'total':
        return {
          id: kpi.id,
          icon: FileText,
          title: 'Total de registros',
          metricLabel: 'BASE · BANCO',
          insights: [
            {
              badge: 'leader',
              badgeLabel: 'Volume',
              text: `${kpi.value} registros na base`,
            },
            {
              badge: 'growth',
              badgeLabel: 'Origem',
              text: 'territorio_liderancas no cockpit',
            },
          ],
        }
      case 'expectativa-votos':
        return {
          id: kpi.id,
          icon: Target,
          title: 'Expectativa 2026',
          metricLabel: 'BASE · VOTOS',
          insights: [
            {
              badge: 'leader',
              badgeLabel: 'Projeção',
              text: `${kpi.value} votos no cenário ativo`,
            },
            {
              badge: 'growth',
              badgeLabel: 'Cenário',
              text: `Cenário ${cenarioLabel} (base territorial)`,
            },
          ],
        }
      case 'cidades':
        return {
          id: kpi.id,
          icon: MapPin,
          title: 'Cidades únicas',
          metricLabel: 'BASE · COBERTURA',
          insights: [
            {
              badge: 'leader',
              badgeLabel: 'Municípios',
              text: `${kpi.value} cidades na base filtrada`,
            },
            {
              badge: 'growth',
              badgeLabel: 'Alcance',
              text: `${cidadesUnicasCount} municípios distintos`,
            },
          ],
        }
      default:
        return {
          id: kpi.id,
          icon: FileText,
          title: kpi.label,
          metricLabel: 'BASE · INDICADOR',
          insights: [
            {
              badge: 'leader',
              badgeLabel: 'Valor',
              text: String(kpi.value),
            },
          ],
        }
    }
  })
}

export function TerritorioBaseKpiStrip(props: TerritorioBaseKpiStripProps) {
  const cards = buildCards(props)
  const colCount = cards.length

  return (
    <QuickAccessKpiStrip
      cards={cards}
      gridClassName={
        colCount <= 2
          ? 'grid-cols-2 sm:grid-cols-2 xl:grid-cols-2'
          : colCount === 3
            ? 'grid-cols-2 min-[480px]:grid-cols-3 xl:grid-cols-3'
            : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-4'
      }
    />
  )
}
