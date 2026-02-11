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
      const duration = 800
      const fps = 60
      const totalFrames = Math.round(duration / (1000 / fps))
      let frame = 0

      const timer = setInterval(() => {
        frame++
        // Easing: desacelera no final (easeOutCubic)
        const progress = 1 - Math.pow(1 - frame / totalFrames, 3)
        const current = Math.floor(numericValue * progress)
        setDisplayValue(current.toLocaleString('pt-BR'))

        if (frame >= totalFrames) {
          clearInterval(timer)
          setDisplayValue(kpi.value)
          setIsAnimating(false)
        }
      }, 1000 / fps)
      
      return () => clearInterval(timer)
    } else {
      setDisplayValue(kpi.value)
      setIsAnimating(false)
    }
  }, [kpi.value])

  const content = (
    <div
      className={cn(
        'relative p-4 rounded-[14px] border border-border-card bg-bg-surface',
        'shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]',
        'transition-all duration-300 ease-out',
        'cursor-pointer group overflow-hidden',
        'h-full min-h-[100px] flex flex-col justify-between'
      )}
    >
      {/* Label and Icon */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-accent-gold-soft group-hover:scale-110 transition-all duration-300 flex-shrink-0">
          <Icon className="w-4 h-4 text-accent-gold animate-breathe" />
        </div>
        <p className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2">
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
        {/* Área fixa para detalhes — garante alinhamento entre cards */}
        <div className="min-h-[2rem] flex items-start mt-1">
          {infoLines && infoLines.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {infoLines.map((line, idx) => (
                <p key={idx} className="text-xs font-medium leading-tight text-text-secondary">
                  {line.text}
                </p>
              ))}
            </div>
          ) : subtitle ? (
            <p className="text-xs font-medium leading-tight text-text-secondary">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className="h-full">{content}</Link>
  }

  return content
}

