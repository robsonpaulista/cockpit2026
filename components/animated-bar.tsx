'use client'

import { useInView } from '@/hooks/use-in-view'
import { cn } from '@/lib/utils'

interface AnimatedBarProps {
  percentage: number
  className?: string
  barClassName?: string
  height?: string // ex: "h-2", "h-3"
}

/**
 * Barra de progresso que cresce suavemente ao entrar na viewport.
 * Transmite sensação de expansão e progresso.
 */
export function AnimatedBar({ 
  percentage, 
  className,
  barClassName = 'bg-accent-gold',
  height = 'h-2'
}: AnimatedBarProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.2 })

  return (
    <div ref={ref} className={cn('w-full rounded-full overflow-hidden bg-background', height, className)}>
      <div 
        className={cn(
          'h-full rounded-full transition-all duration-700',
          barClassName
        )}
        style={{ 
          width: isInView ? `${Math.min(percentage, 100)}%` : '0%',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}
