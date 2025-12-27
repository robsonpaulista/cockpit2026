'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import { 
  TrendingUp, 
  MapPin, 
  Users, 
  Vote, 
  AlertTriangle, 
  BarChart3,
  Sparkles,
  FileText,
  Target
} from 'lucide-react'

interface KPICardProps {
  kpi: KPI
  href?: string
}

const getKpiIcon = (id: string) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    // Dashboard principal
    ife: TrendingUp,
    presenca: MapPin,
    base: Users,
    projecao: Vote,
    sentimento: BarChart3,
    risco: AlertTriangle,
    // Território & Base
    liderancas: Users,
    total: FileText,
    'expectativa-votos': Target,
    cidades: MapPin,
  }
  return iconMap[id] || Sparkles
}

export function KPICard({ kpi, href = '#' }: KPICardProps) {
  const Icon = getKpiIcon(kpi.id)

  const content = (
    <div
      className={cn(
        'relative p-5 rounded-2xl border border-border bg-surface',
        'hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/30',
        'transition-all duration-300 ease-premium',
        'cursor-pointer group overflow-hidden'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary-soft group-hover:bg-primary/20 transition-colors duration-300">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm font-medium text-text-muted group-hover:text-text-strong transition-colors">
          {kpi.label}
        </p>
      </div>

      {/* Value */}
      <div>
        <p className="text-3xl font-bold text-text-strong group-hover:text-primary transition-all duration-300 group-hover:scale-105">
          {typeof kpi.value === 'number' ? kpi.value : kpi.value}
        </p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

