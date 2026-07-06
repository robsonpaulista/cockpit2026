'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSpatialTilt } from '@/hooks/use-spatial-tilt'

type SpatialGlassCardProps = {
  children: ReactNode
  className?: string
  glow?: 'cyan' | 'violet' | 'gold'
  tilt?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const GLOW_CLASS: Record<NonNullable<SpatialGlassCardProps['glow']>, string> = {
  cyan: 'spatial-glass-card--glow-cyan',
  violet: 'spatial-glass-card--glow-violet',
  gold: 'spatial-glass-card--glow-gold',
}

const PADDING_CLASS: Record<NonNullable<SpatialGlassCardProps['padding']>, string> = {
  none: 'p-0',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
}

export function SpatialGlassCard({
  children,
  className,
  glow = 'cyan',
  tilt = true,
  padding = 'md',
}: SpatialGlassCardProps) {
  const { ref, style, onMouseMove, onMouseLeave } = useSpatialTilt()

  return (
    <div
      ref={tilt ? ref : undefined}
      onMouseMove={tilt ? onMouseMove : undefined}
      onMouseLeave={tilt ? onMouseLeave : undefined}
      className={cn('spatial-glass-card', GLOW_CLASS[glow], className)}
      style={tilt ? style : undefined}
    >
      <div className="spatial-glass-card__border" aria-hidden />
      <div className="spatial-glass-card__shine" aria-hidden />
      <div className={cn('spatial-glass-card__content', PADDING_CLASS[padding])}>{children}</div>
    </div>
  )
}
