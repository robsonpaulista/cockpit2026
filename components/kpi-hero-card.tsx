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

  const getInfoLineColor = (_type?: 'positive' | 'negative' | 'neutral') => {
    return 'text-white/80'
  }

  const getInfoLineIcon = (line: InfoLine) => {
    if (line.icon === 'trophy') return <Trophy className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'positive') return <TrendingUp className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'negative') return <TrendingDown className="w-4 h-4 flex-shrink-0" />
    return null
  }

  const content = (
    <div
      className={cn(
        'relative p-5 rounded-[14px] bg-accent-gold border border-accent-gold shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden'
      )}
    >
      {/* Layout horizontal */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-white/20 flex-shrink-0">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white group-hover:text-white/90 transition-colors">
            {kpi.label}
          </p>
          {subtitle && !infoLines && (
            <p className="text-sm text-white/70">{subtitle}</p>
          )}
          {infoLines && infoLines.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              {infoLines.map((line, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'text-xs font-medium flex items-center gap-1.5',
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
              'text-4xl font-black text-white transition-all duration-300',
              isAnimating && 'scale-105'
            )}>
              {displayValue}
            </p>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded border border-white/30">
              Hoje
            </span>
          </div>
          <span className="text-xs text-white/60">Fonte própria</span>
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
