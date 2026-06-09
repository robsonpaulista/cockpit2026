'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { jarvisLabelClass, jarvisPanelGhostClass } from '@/lib/jarvis-hud-tokens'
import { useCountUp } from '@/components/jarvis/use-count-up'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

export interface JarvisLogLine {
  tag: string
  message: string
  tone?: 'default' | 'success' | 'warn'
  at?: string
}

const BOOT_LOGS: JarvisLogLine[] = [
  { tag: 'SYSTEM', message: 'JARVIS INITIALIZED', tone: 'success' },
  { tag: 'AI', message: 'NEURAL NETWORK ACTIVE', tone: 'success' },
  { tag: 'SCAN', message: 'SYSTEM INTEGRITY CHECK', tone: 'default' },
  { tag: 'READY', message: 'AWAITING USER INPUT', tone: 'default' },
]

function formatLogTime(date = new Date()): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function JarvisHudSystemLog({
  extraLines = [],
  processing = false,
  className,
}: {
  extraLines?: JarvisLogLine[]
  processing?: boolean
  className?: string
}) {
  const logRef = useRef<HTMLDivElement>(null)

  const lines = useMemo(() => {
    const merged = [...BOOT_LOGS, ...extraLines].slice(-18)
    if (processing) {
      merged.push({ tag: 'AI', message: 'PROCESSING QUERY...', tone: 'warn', at: formatLogTime() })
    }
    return merged.map((line, i) => ({
      ...line,
      at: line.at ?? formatLogTime(new Date(Date.now() - (merged.length - i) * 1000)),
    }))
  }, [extraLines, processing])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [lines])

  return (
    <div className={cn(jarvisPanelGhostClass, 'flex min-h-[160px] flex-1 flex-col', className)}>
      <p className={jarvisLabelClass}>system log</p>
      <div
        ref={logRef}
        className="mt-2 min-h-0 flex-1 overflow-y-auto font-jarvis-mono text-[9px] leading-relaxed"
      >
        {lines.map((line, i) => (
          <p
            key={`${line.tag}-${i}-${line.message.slice(0, 12)}`}
            className={cn(
              'jarvis-log-line-enter mb-1.5',
              line.tone === 'success' && 'text-[var(--color-online)]',
              line.tone === 'warn' && 'text-[var(--color-alert)]',
              line.tone === 'default' && 'text-[var(--color-text-primary)]'
            )}
          >
            <span className="text-[var(--color-text-dim)]">[{line.at}]</span>{' '}
            <span className="text-[var(--color-text-dim)]">[{line.tag}]</span> {line.message}
            {i === lines.length - 1 ? (
              <span className="jarvis-cursor-blink ml-0.5 inline-block h-[10px] w-[5px] translate-y-[1px] bg-[var(--color-core)]" />
            ) : null}
          </p>
        ))}
      </div>
      <JarvisHudMetrics />
    </div>
  )
}

const METRIC_LABELS = ['municípios', 'alertas', 'pendências', 'score'] as const

function JarvisHudMetrics() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200)
    return () => clearInterval(id)
  }, [])

  const targets = useMemo(
    () => [40 + ((tick * 7) % 35), 2 + (tick % 5), 12 + ((tick * 3) % 20), 60 + ((tick * 11) % 30)],
    [tick]
  )

  return (
    <div className="mt-3 flex pt-2">
      {targets.map((target, i) => (
        <MetricFooterCell key={METRIC_LABELS[i]} label={METRIC_LABELS[i]} value={target} />
      ))}
    </div>
  )
}

function MetricFooterCell({ label, value }: { label: string; value: number }) {
  const display = useCountUp(value, 900)

  return (
    <div className="group flex flex-1 flex-col items-center px-1 transition-shadow hover:shadow-[0_0_12px_rgba(0,102,255,0.15)]">
      <span className="font-jarvis-mono text-sm text-[var(--color-text-code)]">{display}</span>
      <span className="mt-0.5 font-jarvis-mono text-[7px] uppercase tracking-wider text-[var(--color-text-dim)]">
        {label}
      </span>
    </div>
  )
}

