'use client'

import { cn } from '@/lib/utils'
import './jarvis-neural.css'

interface JarvisListeningWaveProps {
  active?: boolean
  variant?: 'standby' | 'capture'
  barCount?: number
  className?: string
}

export function JarvisListeningWave({
  active = true,
  variant = 'capture',
  barCount = 7,
  className,
}: JarvisListeningWaveProps) {
  if (!active) return null

  return (
    <div
      className={cn(
        'jarvis-listening-wave flex items-end justify-center gap-[3px]',
        variant === 'standby' ? 'opacity-70' : 'opacity-100',
        className
      )}
      aria-hidden
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'jarvis-listening-wave-bar w-[3px] rounded-full',
            variant === 'standby' ? 'bg-[var(--color-online)]/70' : 'bg-[var(--color-core)]'
          )}
          style={{
            height: variant === 'standby' ? 10 + (i % 3) * 4 : 12 + (i % 4) * 5,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  )
}
