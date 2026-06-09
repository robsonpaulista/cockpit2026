'use client'

import './jarvis-neural.css'
import { cn } from '@/lib/utils'

interface JarvisBrainHologramProps {
  active?: boolean
  listening?: boolean
  speaking?: boolean
  processing?: boolean
  size?: 'default' | 'large'
  className?: string
}

const NEURONS: Array<{ cx: number; cy: number; delay: number }> = [
  { cx: 200, cy: 72, delay: 0 },
  { cx: 155, cy: 95, delay: 0.3 },
  { cx: 245, cy: 95, delay: 0.6 },
  { cx: 130, cy: 130, delay: 0.9 },
  { cx: 270, cy: 130, delay: 1.1 },
  { cx: 200, cy: 118, delay: 0.4 },
  { cx: 175, cy: 155, delay: 1.4 },
  { cx: 225, cy: 155, delay: 1.6 },
  { cx: 200, cy: 185, delay: 0.8 },
  { cx: 148, cy: 175, delay: 1.8 },
  { cx: 252, cy: 175, delay: 2 },
  { cx: 165, cy: 210, delay: 2.2 },
  { cx: 235, cy: 210, delay: 2.4 },
  { cx: 200, cy: 235, delay: 1.2 },
  { cx: 182, cy: 265, delay: 2.6 },
  { cx: 218, cy: 265, delay: 2.8 },
]

const SYNAPSES: Array<{ d: string; delay: number }> = [
  { d: 'M200 72 L155 95', delay: 0 },
  { d: 'M200 72 L245 95', delay: 0.4 },
  { d: 'M155 95 L130 130', delay: 0.8 },
  { d: 'M245 95 L270 130', delay: 1 },
  { d: 'M200 118 L175 155', delay: 0.6 },
  { d: 'M200 118 L225 155', delay: 0.7 },
  { d: 'M175 155 L148 175', delay: 1.2 },
  { d: 'M225 155 L252 175', delay: 1.3 },
  { d: 'M200 185 L200 235', delay: 0.5 },
  { d: 'M148 175 L165 210', delay: 1.5 },
  { d: 'M252 175 L235 210', delay: 1.6 },
  { d: 'M165 210 L182 265', delay: 1.9 },
  { d: 'M235 210 L218 265', delay: 2 },
  { d: 'M182 265 L200 235', delay: 2.2 },
  { d: 'M218 265 L200 235', delay: 2.3 },
  { d: 'M130 130 L175 155', delay: 1.1 },
  { d: 'M270 130 L225 155', delay: 1.4 },
]

export function JarvisBrainHologram({
  active = true,
  listening = false,
  speaking = false,
  processing = false,
  size = 'default',
  className,
}: JarvisBrainHologramProps) {
  const large = size === 'large'
  const accent = listening ? '#3dff9a' : speaking ? '#7ee8ff' : '#00e5ff'
  const pulse = listening || processing || speaking

  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center',
        large ? 'min-h-[280px] max-h-[min(58vh,480px)]' : 'min-h-[160px]',
        className
      )}
    >
      <div
        className={cn(
          'jarvis-ring-pulse pointer-events-none absolute rounded-full border border-[rgba(0,229,255,0.15)]',
          large ? 'h-[92%] w-[92%] max-h-[440px] max-w-[440px]' : 'h-[140px] w-[140px]'
        )}
        aria-hidden
      />
      <div
        className={cn(
          'pointer-events-none absolute rounded-full border border-[rgba(0,229,255,0.22)]',
          pulse && 'jarvis-ring-pulse',
          large ? 'h-[78%] w-[78%] max-h-[380px] max-w-[380px]' : 'h-[120px] w-[120px]'
        )}
        style={{ animationDelay: '0.8s' }}
        aria-hidden
      />

      <div
        className={cn(
          'jarvis-neural-orbit pointer-events-none absolute rounded-full border border-dashed border-[rgba(0,229,255,0.12)]',
          large ? 'h-[88%] w-[88%] max-h-[420px] max-w-[420px]' : 'h-[130px] w-[130px]'
        )}
        aria-hidden
      />

      <svg
        viewBox="0 0 400 320"
        className={cn(
          'jarvis-core-breathe relative z-[1] w-full max-w-full',
          large ? 'h-full max-h-[min(58vh,480px)]' : 'h-[130px] w-[130px]'
        )}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Núcleo neural Jarvis"
      >
        <defs>
          <filter id="jarvis-neural-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="jarvis-brain-fill" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="rgba(0,229,255,0.14)" />
            <stop offset="55%" stopColor="rgba(0,168,198,0.06)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <linearGradient id="jarvis-brain-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#00a8c6" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        <path
          d="M200 48 C148 48 108 78 98 118 C88 148 92 178 108 205 C118 225 112 252 128 272 C148 296 178 306 200 310 C222 306 252 296 272 272 C288 252 282 225 292 205 C308 178 312 148 302 118 C292 78 252 48 200 48 Z"
          fill="url(#jarvis-brain-fill)"
          stroke="url(#jarvis-brain-stroke)"
          strokeWidth="1.8"
          filter="url(#jarvis-neural-glow)"
        />

        {SYNAPSES.map((s, i) => (
          <path
            key={`syn-${i}`}
            d={s.d}
            fill="none"
            stroke={accent}
            strokeWidth="1"
            strokeOpacity={0.5}
            className="jarvis-synapse-line"
            style={{ animationDelay: `${s.delay}s`, animationDuration: pulse ? '1.6s' : '2.8s' }}
            filter="url(#jarvis-neural-glow)"
          />
        ))}

        {NEURONS.map((n, i) => (
          <circle
            key={`n-${i}`}
            cx={n.cx}
            cy={n.cy}
            r={listening && i === 5 ? 6 : speaking && i === 5 ? 5.5 : 4}
            fill={accent}
            className="jarvis-neuron-node"
            style={{
              animationDelay: `${n.delay}s`,
              animationDuration: pulse ? '1.2s' : '2.4s',
              transformOrigin: `${n.cx}px ${n.cy}px`,
            }}
            filter="url(#jarvis-neural-glow)"
          />
        ))}

        <circle
          cx={200}
          cy={165}
          r={listening ? 14 : speaking ? 12 : 10}
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
          strokeOpacity={0.65}
          className={pulse ? 'jarvis-neuron-node' : undefined}
        />
      </svg>

      <p
        className={cn(
          'absolute bottom-0 left-1/2 -translate-x-1/2 font-mono uppercase tracking-[0.22em]',
          large ? 'text-[9px]' : 'text-[8px]',
          listening ? 'text-[#3dff9a]' : speaking ? 'text-[#7ee8ff]' : 'text-[rgba(0,229,255,0.45)]'
        )}
      >
        {listening ? 'escuta neural' : speaking ? 'síntese ativa' : processing ? 'processando' : 'núcleo ativo'}
      </p>
    </div>
  )
}
