'use client'

import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import type { MonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { readResponseJson } from '@/lib/parse-response-json'
import { cn } from '@/lib/utils'

export function CollectSourcesProductionInfo() {
  const [status, setStatus] = useState<MonitoramentoCollectorsStatus | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/monitoramento/collectors-status', { cache: 'no-store' })
        const j = await readResponseJson<MonitoramentoCollectorsStatus>(res)
        if (res.ok) setStatus(j)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (!status?.showProductionNotice || !status.notice) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-full',
          'text-[rgb(var(--color-primary))] hover:bg-[#E6F1FB]',
          open && 'bg-[#E6F1FB]'
        )}
        aria-label="Informações sobre coleta em produção"
        aria-expanded={open}
      >
        <Info className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-3 text-xs text-text-secondary shadow-lg"
        >
          <p className="font-medium text-text-primary">Coleta em produção</p>
          <p className="mt-1 leading-relaxed">{status.notice}</p>
          <div className="mt-2 space-y-1.5 text-[11px]">
            {!status.trends.runnerAvailable ? (
              <p>
                <span className="font-medium text-text-primary">Google Trends:</span>{' '}
                <code className="rounded bg-bg-app px-1 py-0.5">{status.trends.localCommand}</code>
              </p>
            ) : null}
            {!status.metaAds.runnerAvailable ? (
              <p>
                <span className="font-medium text-text-primary">Meta Ads:</span>{' '}
                <code className="rounded bg-bg-app px-1 py-0.5">{status.metaAds.localCommand}</code>
                <span className="text-text-muted"> (Playwright + Chromium)</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
