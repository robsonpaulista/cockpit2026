'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'

interface InfoLine {
  text: string
  type?: 'positive' | 'negative' | 'neutral'
  icon?: 'trending' | 'trophy'
}

interface KPIHeroCardProps {
  kpi: KPI
  subtitle?: string
  infoLines?: InfoLine[]
  href?: string
}

export function KPIHeroCard({ kpi, subtitle, infoLines, href = '#' }: KPIHeroCardProps) {
  const [displayValue, setDisplayValue] = useState<string | number>('0')
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setIsAnimating(true)
    const numericValue = typeof kpi.value === 'string' 
      ? parseFloat(kpi.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
      : kpi.value || 0

    if (typeof numericValue === 'number' && numericValue > 0) {
      const duration = 500
      const steps = 30
      const increment = numericValue / steps
      let current = 0
      let step = 0

      const timer = setInterval(() => {
        step++
        current = Math.min(increment * step, numericValue)
        
        if (typeof kpi.value === 'string' && kpi.value.includes('/')) {
          // Se for formato "X/Y", manter formato
          setDisplayValue(kpi.value)
        } else {
          setDisplayValue(Math.floor(current).toLocaleString('pt-BR'))
        }

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

  const getInfoLineColor = (type?: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive': return 'text-emerald-600'
      case 'negative': return 'text-red-500'
      default: return 'text-text-secondary'
    }
  }

  const getInfoLineIcon = (line: InfoLine) => {
    if (line.icon === 'trophy') return <Trophy className="w-3 h-3 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'positive') return <TrendingUp className="w-3 h-3 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'negative') return <TrendingDown className="w-3 h-3 flex-shrink-0" />
    return null
  }

  const content = (
    <div
      className={cn(
        'relative p-4 rounded-[14px] border border-border-card bg-bg-surface shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden',
        'border-t-4 border-t-accent-gold'
      )}
    >
      {/* Layout horizontal compacto */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-gold-soft flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-accent-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
            {kpi.label}
          </p>
          {subtitle && !infoLines && (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          )}
          {infoLines && infoLines.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
              {infoLines.map((line, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'text-[11px] font-medium flex items-center gap-1',
                    getInfoLineColor(line.type)
                  )}
                >
                  {getInfoLineIcon(line)}
                  {line.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-2 justify-end">
            <p className={cn(
              'text-3xl font-black text-text-primary group-hover:text-accent-gold transition-all duration-300',
              isAnimating && 'scale-105'
            )}>
              {displayValue}
            </p>
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-accent-gold-soft text-accent-gold rounded border border-accent-gold/20">
              Hoje
            </span>
          </div>
          <span className="text-[10px] text-text-secondary">Fonte própria</span>
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
