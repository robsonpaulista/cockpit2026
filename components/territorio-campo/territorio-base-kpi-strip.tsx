'use client'

import { FileText, MapPin, Target, Users, type LucideIcon } from 'lucide-react'
import type { KPI } from '@/types'
import { cn } from '@/lib/utils'

interface TerritorioBaseKpiStripProps {
  kpis: KPI[]
  totalRegistros: number
  cenarioLabel: string
  cidadesUnicasCount: number
}

type CxKpi = {
  id: string
  icon: LucideIcon
  label: string
  value: string
  hint?: string
}

function buildCards({
  kpis,
  totalRegistros,
  cenarioLabel,
  cidadesUnicasCount,
}: TerritorioBaseKpiStripProps): CxKpi[] {
  return kpis.map((kpi) => {
    switch (kpi.id) {
      case 'liderancas':
        return {
          id: kpi.id,
          icon: Users,
          label: 'Lideranças',
          value: String(kpi.value),
          hint: `de ${totalRegistros} registros`,
        }
      case 'total':
        return {
          id: kpi.id,
          icon: FileText,
          label: 'Registros',
          value: String(kpi.value),
          hint: 'territorio_liderancas',
        }
      case 'expectativa-votos':
        return {
          id: kpi.id,
          icon: Target,
          label: 'Expectativa 2026',
          value: String(kpi.value),
          hint: `Cenário ${cenarioLabel}`,
        }
      case 'cidades':
        return {
          id: kpi.id,
          icon: MapPin,
          label: 'Cidades',
          value: String(kpi.value),
          hint: `${cidadesUnicasCount} municípios`,
        }
      default:
        return {
          id: kpi.id,
          icon: FileText,
          label: kpi.label,
          value: String(kpi.value),
        }
    }
  })
}

export function TerritorioBaseKpiStrip(props: TerritorioBaseKpiStripProps) {
  const cards = buildCards(props)
  if (cards.length === 0) return null

  return (
    <div
      className={cn(
        'territorio-cx-kpi-strip grid min-w-0 gap-2',
        cards.length <= 2
          ? 'grid-cols-2'
          : cards.length === 3
            ? 'grid-cols-2 min-[480px]:grid-cols-3'
            : 'grid-cols-2 md:grid-cols-4',
      )}
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.id} className="territorio-cx-kpi relative overflow-hidden">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-[#969692]" aria-hidden />
              <p className="territorio-cx-kpi__label">{card.label}</p>
            </div>
            <p className="territorio-cx-kpi__value">{card.value}</p>
            {card.hint ? (
              <p className="mt-1 truncate text-[11px] text-[#969692]">{card.hint}</p>
            ) : null}
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#e8a825]"
              aria-hidden
            />
          </div>
        )
      })}
    </div>
  )
}
