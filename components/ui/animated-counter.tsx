'use client'

import { useAnimatedCounter } from '@/hooks/use-animated-counter'
import { cn } from '@/lib/utils'

export type AnimatedCounterFormat = 'int' | 'decimal' | 'currency' | 'compact'

function formatValue(value: number, format: AnimatedCounterFormat): string {
  const n = Math.round(value)
  if (format === 'currency') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(n)
  }
  if (format === 'compact') {
    return new Intl.NumberFormat('pt-BR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  }
  if (format === 'decimal') {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat('pt-BR').format(n)
}

interface AnimatedCounterProps {
  value: number
  format?: AnimatedCounterFormat
  durationMs?: number
  enabled?: boolean
  resetKey?: string | number
  className?: string
}

export function AnimatedCounter({
  value,
  format = 'int',
  durationMs = 1000,
  enabled = true,
  resetKey,
  className,
}: AnimatedCounterProps) {
  const animated = useAnimatedCounter(value, { durationMs, enabled, resetKey })
  return <span className={cn('tabular-nums', className)}>{formatValue(animated, format)}</span>
}
