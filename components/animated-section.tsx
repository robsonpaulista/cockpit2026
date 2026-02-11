'use client'

import { useInView } from '@/hooks/use-in-view'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface AnimatedSectionProps {
  children: ReactNode
  className?: string
  delay?: number // delay em ms (0-300)
  animation?: 'reveal' | 'fade' | 'slide-right'
}

/**
 * Wrapper que anima seus filhos ao entrarem na viewport.
 * Animação sutil: fade + translateY de 12px → 0.
 * Usado para dar sensação de "dados vivos" ao rolar a página.
 */
export function AnimatedSection({ 
  children, 
  className,
  delay = 0,
  animation = 'reveal'
}: AnimatedSectionProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.1 })

  const animClass = {
    reveal: 'animate-reveal',
    fade: 'fade-in',
    'slide-right': 'slide-in-right',
  }[animation]

  return (
    <div
      ref={ref}
      className={cn(
        'transition-opacity',
        isInView ? animClass : 'opacity-0',
        className
      )}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}
