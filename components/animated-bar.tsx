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
  height = 'h-2',
}: AnimatedBarProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.2 })

  return (
    <div ref={ref} className={cn('w-full rounded-full overflow-hidden bg-background', height, className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700', barClassName)}
        style={{
          width: isInView ? `${Math.min(percentage, 100)}%` : '0%',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}

export interface GlassGradientProgressBarProps {
  percentage: number
  className?: string
  /** Classes de altura da trilha (ex.: h-3, h-3.5) */
  heightClass?: string
  /** Efeito de brilho externo para leitura de "energia/progresso". */
  glow?: boolean
  /** Tooltip nativo no hover da barra. */
  title?: string
}

/**
 * Trilha em vidro + preenchimento em gradiente (Cockpit), animação ao entrar na viewport
 * e reflexo único para dar destaque.
 */
export function GlassGradientProgressBar({
  percentage,
  className,
  heightClass = 'h-3.5',
  glow = false,
  title,
}: GlassGradientProgressBarProps) {
  const { ref, isInView } = useInView<HTMLDivElement>({ threshold: 0.12 })
  const w = Math.min(Math.max(percentage, 0), 100)

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
      title={title}
      className={cn(
        'relative w-full overflow-hidden rounded-full',
        heightClass,
        'border border-white/50 bg-white/18 backdrop-blur-md supports-[backdrop-filter]:bg-white/14',
        'shadow-[inset_0_1px_3px_rgba(15,45,74,0.12),0_1px_0_rgba(255,255,255,0.5)]',
        glow && 'shadow-[inset_0_1px_3px_rgba(15,45,74,0.12),0_0_12px_rgba(59,130,246,0.28),0_1px_0_rgba(255,255,255,0.5)]',
        className
      )}
    >
      <div
        className="relative h-full overflow-hidden rounded-full transition-[width] duration-1000 ease-out"
        style={{
          width: isInView ? `${w}%` : '0%',
          transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          backgroundImage:
            'linear-gradient(90deg, #062e52 0%, #0b4a7a 32%, #0E74BC 62%, #1a8fd6 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        {isInView ? (
          <span
            className="cockpit-progress-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-2/3 rounded-full opacity-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
            }}
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  )
}
