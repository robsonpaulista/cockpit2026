'use client'

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'
import type { MonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { readResponseJson } from '@/lib/parse-response-json'

export function MonitoramentoProductionCollectNotice() {
  const [status, setStatus] = useState<MonitoramentoCollectorsStatus | null>(null)

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

  if (!status?.showProductionNotice || !status.notice) return null

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 space-y-2">
          <p className="font-medium text-amber-950">Coleta local: Google Trends e Meta Ads</p>
          <p className="text-amber-900/95">{status.notice}</p>
          <div className="space-y-1 text-xs text-amber-900/90">
            {!status.trends.runnerAvailable ? (
              <p>
                <span className="font-medium">Google Trends:</span>{' '}
                <code className="rounded bg-white/70 px-1 py-0.5">{status.trends.localCommand}</code>
              </p>
            ) : null}
            {!status.metaAds.runnerAvailable ? (
              <p>
                <span className="font-medium">Meta Ads:</span>{' '}
                <code className="rounded bg-white/70 px-1 py-0.5">{status.metaAds.localCommand}</code>
                <span className="text-amber-800/90"> (requer Playwright + Chromium)</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
