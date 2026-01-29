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
        'relative p-5 rounded-[14px] border border-border-card bg-bg-surface shadow-card',
        'hover:shadow-card-hover hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden',
        'border-t-4 border-t-accent-gold'
      )}
    >
      {/* Badge "Atualizado hoje" */}
      <div className="absolute top-4 right-4">
        <span className="px-2.5 py-1 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-full border border-border-card">
          Atualizado hoje
        </span>
      </div>

      {/* Label and Icon */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-lg bg-accent-gold-soft group-hover:bg-accent-gold-soft transition-colors duration-300">
          <TrendingUp className="w-4 h-4 text-accent-gold" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
            {kpi.label}
          </p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Value - Maior e mais destacado */}
      <div className="mb-2">
        <p className={cn(
          'text-4xl font-black text-text-primary group-hover:text-accent-gold transition-all duration-300',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
      </div>

      {/* Divider */}
      <div className="mt-3 pt-3 border-t border-border-card">
        <span className="text-xs text-text-secondary font-medium">Fonte própria</span>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
