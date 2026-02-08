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

interface KPIInfoLine {
  text: string
  type?: 'positive' | 'negative' | 'neutral'
}

interface KPICardProps {
  kpi: KPI
  href?: string
  subtitle?: string
  subtitleType?: 'positive' | 'negative' | 'neutral'
  infoLines?: KPIInfoLine[]
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

export function KPICard({ kpi, href = '#', subtitle, subtitleType = 'neutral', infoLines }: KPICardProps) {
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
        'relative p-3 rounded-[14px] border border-border-card bg-bg-surface shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden',
        'h-full min-h-[90px] flex flex-col justify-between'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-accent-gold-soft group-hover:scale-110 transition-all duration-200 flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-accent-gold" />
        </div>
        <p className="text-xs font-medium text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2">
          {kpi.label}
        </p>
      </div>

      {/* Value */}
      <div className="mt-auto pt-2">
        <p className={cn(
          'text-2xl font-bold text-text-primary group-hover:text-accent-gold transition-all duration-200',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
        {infoLines && infoLines.length > 0 ? (
          <div className="flex flex-col gap-0 mt-0.5">
            {infoLines.map((line, idx) => (
              <p key={idx} className={cn(
                'text-[10px] font-medium leading-tight',
                line.type === 'positive' && 'text-emerald-600',
                line.type === 'negative' && 'text-red-500',
                (!line.type || line.type === 'neutral') && 'text-text-secondary'
              )}>
                {line.text}
              </p>
            ))}
          </div>
        ) : subtitle ? (
          <p className={cn(
            'text-[10px] font-medium mt-0.5 leading-tight',
            subtitleType === 'positive' && 'text-emerald-600',
            subtitleType === 'negative' && 'text-red-500',
            subtitleType === 'neutral' && 'text-text-secondary'
          )}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="h-full">{content}</Link>
  }

  return content
}

