'use client'

import type { ReactNode } from 'react'
import {
  IconAlertTriangle,
  IconChartPie,
  IconMessageCircle,
  IconPhoto,
} from '@tabler/icons-react'
import { formatInt, formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalKpis } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoKpiCardClass,
  exercitoKpiHeroValueClass,
  exercitoKpiValueClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

interface ExercitoDigitalKpiStripProps {
  kpis: ExercitoDigitalKpis
  audience: ExercitoDigitalAudience
  referenceMonthLabel: string
}

function KpiLabel({ icon: Icon, text }: { icon: typeof IconChartPie; text: string }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <Icon className="h-2.5 w-2.5 shrink-0 text-[rgb(var(--color-primary))]" stroke={1.5} aria-hidden />
      <span className="truncate text-[10px] text-text-muted">{text}</span>
    </div>
  )
}

function KpiFooter({ children }: { children: ReactNode }) {
  return (
    <p className="mt-auto pt-1.5 text-[10px] leading-snug text-text-muted line-clamp-2">{children}</p>
  )
}

export function ExercitoDigitalKpiStrip({ kpis, audience, referenceMonthLabel }: ExercitoDigitalKpiStripProps) {
  const redeLabel =
    audience === 'unificado' ? 'perfis da base' : audience === 'mandatos' ? 'mandatários' : 'líderes'
  const comentariosRedeLabel =
    audience === 'unificado' ? 'base eleitoral' : audience === 'mandatos' ? 'mandatários' : 'liderados'

  return (
    <div className="flex w-full min-w-0 flex-row flex-nowrap items-stretch gap-2">
      <div className={cn(exercitoKpiCardClass('min-w-0 flex-1 border-[#B5D4F4]'))}>
        <KpiLabel icon={IconChartPie} text="Ativação geral" />
        <p className={exercitoKpiHeroValueClass}>{formatPct(kpis.ativacaoPct)}</p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-[99px] bg-bg-app">
          <div
            className="h-full rounded-[99px] bg-[rgb(var(--color-primary))]"
            style={{ width: `${Math.min(100, Math.max(0, kpis.ativacaoPct))}%` }}
          />
        </div>
        <KpiFooter>
          {formatInt(kpis.lideresAtivados)}/{formatInt(kpis.lideresMedidos)} {redeLabel} · {referenceMonthLabel}
          {kpis.abaixoMeta ? (
            <>
              {' · '}
              <span className="font-medium text-[#854F0B]">abaixo de {formatInt(kpis.metaPct)}%</span>
            </>
          ) : (
            <> · meta {formatInt(kpis.metaPct)}%</>
          )}
        </KpiFooter>
      </div>

      <div className={cn(exercitoKpiCardClass(), 'min-w-0 flex-1')}>
        <KpiLabel icon={IconMessageCircle} text="Comentários gerados" />
        <p className={exercitoKpiValueClass}>{formatInt(kpis.comentariosTotal)}</p>
        <KpiFooter>
          <span className="font-medium text-[#3B6D11]">{formatInt(kpis.comentariosLiderados)} {comentariosRedeLabel}</span>
          {' · '}
          {formatInt(kpis.comentariosOrganicos)} org.
        </KpiFooter>
      </div>

      <div className={cn(exercitoKpiCardClass(), 'min-w-0 flex-1')}>
        <KpiLabel icon={IconAlertTriangle} text="Municípios críticos" />
        <p className={cn(exercitoKpiValueClass, 'text-[#A32D2D]')}>{formatInt(kpis.municipiosCriticos)}</p>
        <KpiFooter>
          <span className="font-medium text-[#A32D2D]">0% ativação</span>
        </KpiFooter>
      </div>

      <div className={cn(exercitoKpiCardClass(), 'min-w-0 flex-1')}>
        <KpiLabel icon={IconPhoto} text="Publicações analisadas" />
        <p className={exercitoKpiValueClass}>{formatInt(kpis.publicacoesAnalisadas)}</p>
        <KpiFooter>
          {formatInt(kpis.publicacoesAnalisadas)} publicações em {referenceMonthLabel}
        </KpiFooter>
      </div>
    </div>
  )
}
