'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { JarvisResultView } from '@/lib/agent/jarvis-result-view'
import { jarvisPanelClass } from '@/lib/jarvis-hud-tokens'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

interface JarvisResultPanelAction {
  type: 'navigate' | 'link'
  url: string
  label: string
}

interface JarvisResultPanelProps {
  view: JarvisResultView
  action?: JarvisResultPanelAction
  isSpeaking?: boolean
  onAction?: (action: JarvisResultPanelAction) => void
  onClose: () => void
  className?: string
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded border px-2.5 py-2 sm:px-3 sm:py-2.5',
        highlight
          ? 'border-[rgba(0,212,255,0.45)] bg-[rgba(0,212,255,0.08)]'
          : 'border-[rgba(0,212,255,0.18)] bg-[rgba(5,21,37,0.6)]'
      )}
    >
      <p className="font-jarvis-mono text-[7px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] sm:text-[8px]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 font-jarvis-display text-base font-semibold tracking-wide sm:mt-1 sm:text-lg',
          highlight ? 'text-[var(--color-core)]' : 'text-[var(--color-text-primary)]'
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function JarvisResultPanel({
  view,
  action,
  isSpeaking = false,
  onAction,
  onClose,
  className,
}: JarvisResultPanelProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [view.title])

  return (
    <div
      className={cn(
        jarvisPanelClass,
        'jarvis-result-panel flex h-full min-h-0 flex-col overflow-hidden border border-[rgba(0,212,255,0.28)]',
        visible ? 'jarvis-result-panel--visible' : 'jarvis-result-panel--enter',
        isSpeaking && 'jarvis-result-panel--speaking',
        className
      )}
      role="region"
      aria-labelledby="jarvis-result-title"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[rgba(0,212,255,0.15)] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="font-jarvis-mono text-[7px] uppercase tracking-[0.18em] text-[var(--color-online)] sm:text-[8px]">
            resultado · jarvis
            {isSpeaking ? (
              <span className="ml-2 inline-flex items-center gap-0.5 text-[var(--color-core)]">
                <span className="jarvis-audio-bar inline-block h-2 w-0.5 rounded-sm bg-current" />
                <span className="jarvis-audio-bar inline-block h-2.5 w-0.5 rounded-sm bg-current" />
                <span className="jarvis-audio-bar inline-block h-2 w-0.5 rounded-sm bg-current" />
              </span>
            ) : null}
          </p>
          <h2
            id="jarvis-result-title"
            className="mt-0.5 line-clamp-2 font-jarvis-display text-base font-bold leading-tight tracking-wide text-[var(--color-core)] sm:mt-1 sm:text-xl"
          >
            {view.title}
          </h2>
          {view.subtitle ? (
            <p className="mt-0.5 line-clamp-2 font-jarvis-mono text-[9px] text-[var(--color-text-dim)] sm:text-[10px]">
              {view.subtitle}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-[var(--color-text-dim)] hover:bg-[rgba(0,212,255,0.08)] hover:text-[var(--color-core)]"
          aria-label="Fechar painel de resultado"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
          {view.agendaItems.length > 0 ? (
            <ul className="space-y-2.5 sm:space-y-3">
              {view.agendaItems.map((item, idx) => (
                <li
                  key={`${idx}-${item.time}-${item.title.slice(0, 16)}`}
                  className="rounded border border-[rgba(0,212,255,0.2)] bg-[rgba(0,212,255,0.04)] px-3 py-2.5 sm:px-3.5 sm:py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 rounded bg-[rgba(0,212,255,0.14)] px-2 py-0.5 font-jarvis-mono text-[10px] font-medium text-[var(--color-core)] sm:text-[11px]">
                      {item.time}
                    </span>
                    <p className="min-w-0 flex-1 font-jarvis-display text-[12px] font-semibold leading-snug text-[var(--color-text-primary)] sm:text-[13px]">
                      {item.title}
                    </p>
                  </div>
                  {item.detail ? (
                    <p className="mt-1.5 pl-[calc(2.5rem+0.625rem)] font-jarvis-mono text-[9px] leading-relaxed text-[var(--color-text-dim)] sm:text-[10px]">
                      {item.detail}
                    </p>
                  ) : null}
                  {item.description ? (
                    <p className="mt-1 pl-[calc(2.5rem+0.625rem)] line-clamp-3 font-jarvis-mono text-[8px] leading-relaxed text-[var(--color-text-dim)] opacity-80 sm:text-[9px]">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {view.stats.length > 0 ? (
          <div className={cn('grid gap-2', view.stats.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {view.stats.map((stat, idx) => (
              <StatCard key={`${stat.label}-${idx}`} {...stat} />
            ))}
          </div>
        ) : null}

        {view.sections.map((section, idx) => (
          <div key={`${section.heading ?? 'section'}-${idx}`} className="mt-3 first:mt-0 sm:mt-4">
            {section.heading ? (
              <h3 className="mb-1.5 font-jarvis-mono text-[8px] uppercase tracking-[0.16em] text-[var(--color-text-dim)] sm:text-[9px]">
                {section.heading}
              </h3>
            ) : null}
            {section.lines.map((line, lineIdx) => (
              <p
                key={`${idx}-${lineIdx}-${line.slice(0, 24)}`}
                className="font-jarvis-mono text-[10px] leading-relaxed text-[var(--color-text-primary)] sm:text-[11px]"
              >
                {line}
              </p>
            ))}
          </div>
        ))}

        {view.bullets.length > 0 ? (
          <ul className="mt-3 space-y-1 sm:mt-4 sm:space-y-1.5">
            {view.bullets.map((item, idx) => (
              <li
                key={`${idx}-${item.slice(0, 24)}`}
                className="flex gap-1.5 font-jarvis-mono text-[10px] leading-relaxed text-[var(--color-text-primary)] sm:gap-2 sm:text-[11px]"
              >
                <span className="shrink-0 text-[var(--color-core)]">›</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {view.footer ? (
          <p className="mt-3 rounded border border-[rgba(0,212,255,0.12)] bg-[rgba(0,212,255,0.04)] px-2.5 py-2 font-jarvis-mono text-[9px] leading-relaxed text-[var(--color-text-dim)] sm:mt-4 sm:text-[10px]">
            {view.footer}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[rgba(0,212,255,0.12)] px-3 py-2 sm:px-4 sm:py-3">
        {action && onAction ? (
          <button
            type="button"
            onClick={() => onAction(action)}
            className="inline-flex items-center gap-1.5 rounded border border-[rgba(0,212,255,0.35)] px-2.5 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.08)] sm:px-3 sm:py-1.5 sm:text-[9px]"
          >
            <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2.5 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-core)] sm:px-3 sm:py-1.5 sm:text-[9px]"
        >
          fechar
        </button>
      </div>
    </div>
  )
}
