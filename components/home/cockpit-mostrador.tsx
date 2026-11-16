'use client'

import { cn } from '@/lib/utils'

type Traco = { x1: number; y1: number; x2: number; y2: number; longo: boolean }

const arred = (n: number) => Math.round(n * 100) / 100

const TRACOS_MOSTRADOR: Traco[] = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180
  const longo = i % 6 === 0
  const r1 = 196
  const r2 = longo ? 180 : 189
  return {
    x1: arred(200 + r1 * Math.sin(a)),
    y1: arred(200 - r1 * Math.cos(a)),
    x2: arred(200 + r2 * Math.sin(a)),
    y2: arred(200 - r2 * Math.cos(a)),
    longo,
  }
})

export type CockpitMostradorProps = {
  /** `amarelo` = splash/descanso; `claro` = card branco (boas-vindas). */
  tom?: 'amarelo' | 'claro'
  className?: string
}

/** Velocímetro/mostrador circular giratório da home Cockpit X. */
export function CockpitMostrador({ tom = 'amarelo', className }: CockpitMostradorProps) {
  return (
    <div
      className={cn(
        'ch-home__mostrador',
        tom === 'claro' && 'ch-home__mostrador--claro',
        className,
      )}
      aria-hidden
    >
      <svg className="ch-home__mostrador-giro" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="198" stroke="currentColor" strokeWidth="1" />
        {TRACOS_MOSTRADOR.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            strokeWidth={t.longo ? 1.6 : 0.8}
          />
        ))}
        <circle
          cx="200"
          cy="200"
          r="150"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="2 6"
        />
      </svg>
    </div>
  )
}
