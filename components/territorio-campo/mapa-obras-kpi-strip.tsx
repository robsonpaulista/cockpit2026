'use client'

import { CheckCircle2, Clock, HardHat, MapPin, PlayCircle, Tractor, Trophy } from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import { obraMapaTemaConfig, type ObraMapaTema, type ObraMapaTemaFiltro } from '@/lib/obras-mapa'

export interface MapaObrasKpiTotais {
  municipios: number
  obras: number
  emAndamento: number
  finalizadas: number
  aIniciar: number
}

function buildCards(totais: MapaObrasKpiTotais, tema: ObraMapaTemaFiltro): QuickAccessKpiCardModel[] {
  const temaConfig = obraMapaTemaConfig(tema)
  const volumeIcon =
    tema === 'quadras-esportivas' ? Trophy : tema === 'maquinario-agricola' ? Tractor : HardHat
  const pctAndamento =
    totais.obras > 0 ? Math.round((totais.emAndamento / totais.obras) * 100) : 0
  const pctFinalizadas =
    totais.obras > 0 ? Math.round((totais.finalizadas / totais.obras) * 100) : 0
  const pctAIniciar = totais.obras > 0 ? Math.round((totais.aIniciar / totais.obras) * 100) : 0

  return [
    {
      id: 'municipios',
      icon: MapPin,
      title: 'Municípios',
      metricLabel: 'OBRAS · COBERTURA',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Mapa',
          text: `${totais.municipios} ${temaConfig.kpiEscopo}`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Escopo',
          text: 'Piauí · obras cadastradas no cockpit',
        },
      ],
    },
    {
      id: 'obras',
      icon: volumeIcon,
      title: 'Obras',
      metricLabel: 'OBRAS · VOLUME',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Total',
          text: `${totais.obras} obras no tema`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Tipo',
          text: temaConfig.kpiTipo,
        },
      ],
    },
    {
      id: 'em-andamento',
      icon: PlayCircle,
      title: 'Em andamento',
      metricLabel: 'OBRAS · FASE',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Ativas',
          text: `${totais.emAndamento} obras em execução`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Share',
          text: `${pctAndamento}% do total cadastrado`,
        },
      ],
    },
    {
      id: 'finalizadas',
      icon: CheckCircle2,
      title: 'Finalizadas',
      metricLabel: 'OBRAS · FASE',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Concluídas',
          text: `${totais.finalizadas} obras finalizadas`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Share',
          text: `${pctFinalizadas}% do total cadastrado`,
        },
      ],
    },
    {
      id: 'a-iniciar',
      icon: Clock,
      title: 'A iniciar',
      metricLabel: 'OBRAS · FASE',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Fila',
          text: `${totais.aIniciar} obras aguardando início`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Share',
          text: `${pctAIniciar}% do total cadastrado`,
        },
      ],
    },
  ]
}

export function MapaObrasKpiStrip({
  totais,
  tema = 'pavimentacao',
}: {
  totais: MapaObrasKpiTotais
  tema?: ObraMapaTemaFiltro
}) {
  const cards = buildCards(totais, tema)

  return (
    <QuickAccessKpiStrip
      cards={cards}
      gridClassName="grid-cols-2 min-[480px]:grid-cols-3 xl:grid-cols-5"
    />
  )
}
