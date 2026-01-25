'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import { useEffect, useState } from 'react'

interface KPIHeroCardProps {
  kpi: KPI
  subtitle?: string
  href?: string
  variation?: number // Variação percentual vs última medição
  variationLabel?: string // Label da variação (ex: "vs última medição")
}

export function KPIHeroCard({ kpi, subtitle, href = '#', variation, variationLabel = 'vs última medição' }: KPIHeroCardProps) {
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
        'relative p-8 rounded-[14px] border border-border bg-white',
        'shadow-[0_8px_24px_rgba(17,24,39,0.06)]',
        'hover:shadow-[0_12px_32px_rgba(17,24,39,0.10)] hover:-translate-y-0.5',
        'transition-all duration-200 ease-out',
        'cursor-pointer group overflow-hidden',
        'w-full'
      )}
    >
      {/* Top strip azul sutil */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-primary-50" />
      
      {/* Badge "Atualizado hoje" */}
      <div className="absolute top-6 right-6">
        <span className="px-2.5 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
          Atualizado hoje
        </span>
      </div>

      {/* Label and Icon */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted">
            {kpi.label}
          </p>
          {subtitle && (
            <p className="text-xs text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Value - Enorme e destacado */}
      <div className="mb-4">
        <p className={cn(
          'text-[56px] font-extrabold text-text leading-none',
          isAnimating && 'scale-105'
        )}>
          {displayValue}
        </p>
      </div>

      {/* Variação percentual */}
      {variation !== undefined && (
        <div className="flex items-center gap-2 mb-4">
          {variation >= 0 ? (
            <ArrowUpRight className="w-4 h-4 text-primary" />
          ) : (
            <TrendingDown className="w-4 h-4 text-status-danger" />
          )}
          <span className={cn(
            'text-sm font-semibold',
            variation >= 0 ? 'text-primary' : 'text-status-danger'
          )}>
            {variation >= 0 ? '+' : ''}{variation.toFixed(1)}% {variationLabel}
          </span>
        </div>
      )}

      {/* Divider e fonte */}
      <div className="mt-6 pt-4 border-t border-border">
        <span className="text-xs text-muted font-medium">Fonte própria</span>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
