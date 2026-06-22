'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, FileText, Maximize2, Minimize2, X } from 'lucide-react'
import type { JarvisResultView } from '@/lib/agent/jarvis-result-view'
import { COCKPIT_AGENT_NAME } from '@/lib/agent/cockpit-agent-brand'
import { JARVIS_READ_ALOUD_HINT } from '@/lib/agent/jarvis-read-aloud'
import { JarvisReportMarkdown } from '@/components/jarvis/jarvis-report-markdown'
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

function ReportStat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        highlight
          ? 'border-slate-300 bg-slate-100'
          : 'border-slate-200 bg-white'
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold leading-snug text-slate-900',
          highlight && 'text-slate-950'
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
  const [fullscreen, setFullscreen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [view.title])

  useEffect(() => {
    setFullscreen(false)
  }, [view.title])

  useEffect(() => {
    if (!fullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fullscreen])

  const handleClose = useCallback(() => {
    setFullscreen(false)
    onClose()
  }, [onClose])

  const panel = (
    <div
      className={cn(
        'jarvis-result-panel jarvis-result-panel--report flex h-full min-h-0 flex-col overflow-hidden border border-slate-200/90 bg-[#faf9f7] text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.22)]',
        fullscreen ? 'rounded-xl sm:rounded-2xl jarvis-result-panel--fullscreen' : 'rounded-xl',
        visible ? 'jarvis-result-panel--visible' : 'jarvis-result-panel--enter',
        isSpeaking && 'jarvis-result-panel--speaking',
        className
      )}
      role="region"
      aria-labelledby="jarvis-result-title"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-slate-500">
            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
              Relatório {COCKPIT_AGENT_NAME}
              {fullscreen ? (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
                  · tela cheia
                </span>
              ) : null}
              {isSpeaking ? (
                <span className="ml-2 inline-flex items-center gap-0.5 text-sky-700">
                  <span className="jarvis-audio-bar inline-block h-2 w-0.5 rounded-sm bg-current" />
                  <span className="jarvis-audio-bar inline-block h-2.5 w-0.5 rounded-sm bg-current" />
                  <span className="jarvis-audio-bar inline-block h-2 w-0.5 rounded-sm bg-current" />
                </span>
              ) : null}
            </p>
          </div>
          <h2
            id="jarvis-result-title"
            className="mt-1 font-jarvis-ui text-xl font-bold leading-tight text-slate-950 sm:text-2xl"
          >
            {view.title}
          </h2>
          {view.subtitle ? (
            <p className="mt-1 text-sm leading-snug text-slate-600">{view.subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setFullscreen((value) => !value)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Abrir em tela cheia'}
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Abrir em tela cheia'}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar relatório"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 md:px-8">
        {view.newsItems.length > 0 ? (
          <ol className="space-y-4">
            {view.newsItems.map((item) => (
              <li
                key={`${item.index}-${item.title.slice(0, 24)}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:px-5 sm:py-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {item.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-slate-950 sm:text-[17px]">
                      {item.title}
                    </p>
                    {item.meta ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">
                        {item.meta}
                      </p>
                    ) : null}
                    {item.url ? (
                      <p className="mt-1 truncate text-[11px] text-sky-700">{item.url}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {view.agendaItems.length > 0 ? (
          <ul className="space-y-3">
            {view.agendaItems.map((item, idx) => (
              <li
                key={`${idx}-${item.time}-${item.title.slice(0, 16)}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                    {item.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-slate-950">
                      {item.title}
                    </p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    ) : null}
                    {item.description ? (
                      <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {view.stats.length > 0 ? (
          <div
            className={cn(
              'grid gap-3',
              view.stats.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
              (view.newsItems.length > 0 || view.agendaItems.length > 0) && 'mt-4'
            )}
          >
            {view.stats.map((stat, idx) => (
              <ReportStat key={`${stat.label}-${idx}`} {...stat} />
            ))}
          </div>
        ) : null}

        {view.markdownBody ? (
          <JarvisReportMarkdown content={view.markdownBody} className={view.stats.length > 0 ? 'mt-4' : undefined} />
        ) : null}

        {!view.markdownBody &&
          view.sections.map((section, idx) => {
            const sectionMarkdown = [
              section.heading ? `## ${section.heading}` : '',
              ...section.lines,
            ]
              .filter(Boolean)
              .join('\n')

            return (
              <JarvisReportMarkdown
                key={`${section.heading ?? 'section'}-${idx}`}
                content={sectionMarkdown}
                className={idx > 0 || view.stats.length > 0 ? 'mt-4' : undefined}
              />
            )
          })}

        {view.bullets.length > 0 ? (
          <ul className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:px-5 sm:py-4">
            {view.bullets.map((item, idx) => (
              <li
                key={`${idx}-${item.slice(0, 24)}`}
                className="flex gap-2 text-sm leading-relaxed text-slate-800 sm:text-[15px]"
              >
                <span className="shrink-0 font-semibold text-slate-400">{idx + 1}.</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {view.footer ? (
          <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-950">
            {view.footer}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5 md:px-8">
        <p className="text-[11px] leading-snug text-slate-500 sm:text-xs">
          {fullscreen ? 'Esc · sair da tela cheia · ' : ''}
          {JARVIS_READ_ALOUD_HINT}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
        {action && onAction ? (
          <button
            type="button"
            onClick={() => onAction(action)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-slate-800 sm:text-[11px]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {action.label}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:text-[11px]"
        >
          Fechar
        </button>
        </div>
      </div>
    </div>
  )

  if (fullscreen && mounted) {
    return (
      <>
        <div
          className="flex min-h-[6rem] flex-1 items-center justify-center rounded-xl border border-dashed border-[rgba(0,212,255,0.18)] bg-[rgba(2,11,20,0.4)] px-4 py-6 text-center"
          aria-hidden
        >
          <p className="font-jarvis-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-dim)]">
            Relatório em tela cheia
          </p>
        </div>
        {createPortal(
          <div className="fixed inset-0 z-[220] flex flex-col p-2 sm:p-3 md:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
              aria-label="Sair da tela cheia"
              onClick={() => setFullscreen(false)}
            />
            <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[min(100%,90rem)] flex-1 flex-col">
              {panel}
            </div>
          </div>,
          document.body
        )}
      </>
    )
  }

  return panel
}
