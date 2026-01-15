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
import { useEffect, useState } from 'react'

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
  const [displayValue, setDisplayValue] = useState<string | number>('0')
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setIsAnimating(true)
    const numericValue = typeof kpi.value === 'string' 
      ? parseFloat(kpi.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
      : kpi.value || 0

    if (typeof numericValue === 'number' && numericValue > 0 && !kpi.value.toString().includes('/')) {
      const duration = 400
      const steps = 25
      const increment = numericValue / steps
      let step = 0

      const timer = setInterval(() => {
        step++
        const current = Math.min(increment * step, numericValue)
        setDisplayValue(Math.floor(current).toLocaleString('pt-BR'))

        if (step >= steps) {
          clearInterval(timer)
          setDisplayValue(kpi.value)
          setIsAnimating(false)
        }
      }, duration / steps)
      
      return () => clearInterval(timer)
    } else {
      setDisplayValue(kpi.value)
      setIsAnimating(false)
    }
  }, [kpi.value])

  const content = (
    <div
      className={cn(
        'relative p-5 rounded-2xl border border-border bg-surface',
        'hover:shadow-lg hover:-translate-y-1 hover:border-primary/30',
        'transition-all duration-300 ease-premium',
        'cursor-pointer group overflow-hidden',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary before:opacity-0 group-hover:opacity-100 before:transition-opacity before:duration-300'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary-soft group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-sm font-medium text-text-muted group-hover:text-text-strong transition-colors">
          {kpi.label}
        </p>
      </div>

      {/* Value */}
      <div>
        <p className={cn(
          'text-3xl font-bold text-text-strong group-hover:text-primary transition-all duration-300',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
        {kpi.variation !== undefined && kpi.variation !== 0 && (
          <p className={cn(
            'text-xs mt-1',
            kpi.variation > 0 ? 'text-status-success' : 'text-status-error'
          )}>
            {kpi.variation > 0 ? '+' : ''}{kpi.variation}%
          </p>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

