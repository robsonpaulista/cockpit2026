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
        'relative p-6 rounded-[14px] border border-border bg-white',
        'shadow-[0_8px_24px_rgba(17,24,39,0.06)]',
        'hover:shadow-[0_12px_32px_rgba(17,24,39,0.10)] hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center group-hover:scale-110 transition-all duration-200">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <p className="text-sm font-medium text-muted">
          {kpi.label}
        </p>
      </div>

      {/* Value */}
      <div>
        <p className={cn(
          'text-[30px] font-bold text-text leading-none',
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

