'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, FileText, X } from 'lucide-react'
import type { JarvisResultView } from '@/lib/agent/jarvis-result-view'
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

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setVisible(true))
    return () => window.cancelAnimationFrame(id)
  }, [view.title])

  return (
    <div
      className={cn(
        'jarvis-result-panel jarvis-result-panel--report flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-[#faf9f7] text-slate-900 shadow-[0_18px_50px_rgba(15,23,42,0.22)]',
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
              Relatório Jarvis
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
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Fechar relatório"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
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

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
        <p className="text-[11px] leading-snug text-slate-500 sm:text-xs">{JARVIS_READ_ALOUD_HINT}</p>
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
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:text-[11px]"
        >
          Fechar
        </button>
        </div>
      </div>
    </div>
  )
}
