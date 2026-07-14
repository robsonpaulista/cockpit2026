'use client'

import { AlertTriangle, Image, MessageCircle, PieChart } from 'lucide-react'
import { formatInt, formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalKpis } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoKpiCardClass,
  exercitoKpiGridClass,
  exercitoKpiValueClass,
  exercitoSectionCardClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

const ICON_CLASS = 'h-3.5 w-3.5 shrink-0 text-[#ff9800]'

interface LideresEngajamentoKpisProps {
  kpis: ExercitoDigitalKpis
  audience: ExercitoDigitalAudience
  referenceMonthLabel: string
}

export function LideresEngajamentoKpis({ kpis, audience, referenceMonthLabel }: LideresEngajamentoKpisProps) {
  const redeLabel =
    audience === 'unificado' ? 'perfis' : audience === 'mandatos' ? 'mandatários' : 'líderes'

  const items = [
    {
      icon: PieChart,
      label: 'Ativação',
      value: formatPct(kpis.ativacaoPct),
      detail: `${formatInt(kpis.lideresAtivados)}/${formatInt(kpis.lideresMedidos)} ${redeLabel}`,
    },
    {
      icon: MessageCircle,
      label: 'Comentários',
      value: formatInt(kpis.comentariosTotal),
      detail: `${formatInt(kpis.comentariosLiderados)} base · ${formatInt(kpis.comentariosOrganicos)} org.`,
    },
    {
      icon: AlertTriangle,
      label: 'Municípios críticos',
      value: formatInt(kpis.municipiosCriticos),
      detail: 'Sem tração no mês',
    },
    {
      icon: Image,
      label: 'Publicações',
      value: formatInt(kpis.publicacoesAnalisadas),
      detail: referenceMonthLabel,
    },
  ] as const

  return (
    <div className={cn(exercitoSectionCardClass, 'py-3')}>
      <div className={cn(exercitoKpiGridClass, 'max-md:grid-cols-2')}>
        {items.map((item) => (
          <div key={item.label} className={exercitoKpiCardClass()}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <item.icon className={ICON_CLASS} aria-hidden />
              <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{item.label}</span>
            </div>
            <p className={exercitoKpiValueClass}>{item.value}</p>
            <p className="mt-1 text-[10px] text-text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
