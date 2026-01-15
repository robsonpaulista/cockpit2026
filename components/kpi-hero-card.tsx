'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import { TrendingUp, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

interface KPIHeroCardProps {
  kpi: KPI
  subtitle?: string
  href?: string
}

export function KPIHeroCard({ kpi, subtitle, href = '#' }: KPIHeroCardProps) {
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

  const content = (
    <div
      className={cn(
        'relative p-6 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary-soft to-surface',
        'hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/60',
        'transition-all duration-300 ease-premium',
        'cursor-pointer group overflow-hidden',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary before:rounded-l-2xl'
      )}
    >
      {/* Badge "Atualizado hoje" */}
      <div className="absolute top-4 right-4">
        <span className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded-full border border-primary/20">
          Atualizado hoje
        </span>
      </div>

      {/* Label and Icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-colors duration-300">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-base font-semibold text-text-strong group-hover:text-primary transition-colors">
            {kpi.label}
          </p>
          {subtitle && (
            <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Value - Maior e mais destacado */}
      <div className="mb-2">
        <p className={cn(
          'text-4xl font-bold text-text-strong group-hover:text-primary transition-all duration-300',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
      </div>

      {/* Variation indicator */}
      {kpi.variation !== undefined && kpi.variation !== 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <span className={cn(
            'text-sm font-medium',
            kpi.variation > 0 ? 'text-status-success' : 'text-status-error'
          )}>
            {kpi.variation > 0 ? '+' : ''}{kpi.variation}%
          </span>
          <span className="text-xs text-text-muted">vs última medição</span>
        </div>
      )}

      {/* Tag de fonte */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <span className="text-[10px] text-text-muted font-medium">Fonte própria</span>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
