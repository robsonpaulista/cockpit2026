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
        'relative p-5 rounded-[14px] border border-card bg-surface',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-accent-gold-soft group-hover:scale-110 transition-all duration-200">
          <Icon className="w-4 h-4 text-accent-gold" />
        </div>
        <p className="text-sm font-medium text-secondary group-hover:text-primary transition-colors">
          {kpi.label}
        </p>
      </div>

      {/* Value */}
      <div>
        <p className={cn(
          'text-3xl font-bold text-primary group-hover:text-accent-gold transition-all duration-200',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

