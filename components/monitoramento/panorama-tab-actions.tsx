'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { CollectSourcesProductionInfo } from '@/components/monitoramento/monitoramento-production-collect-notice'
import { chromeButtonClass } from '@/lib/button-chrome'
import type { MonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { cn } from '@/lib/utils'

interface PanoramaTabActionsProps {
  busy: boolean
  collectingAll: boolean
  refreshing: boolean
  collectorsStatus?: MonitoramentoCollectorsStatus | null
  onCollectAll: () => void
  onReload: () => void
}

export function PanoramaTabActions({
  busy,
  collectingAll,
  refreshing,
  collectorsStatus,
  onCollectAll,
  onReload,
}: PanoramaTabActionsProps) {
  const [reloadAnimating, setReloadAnimating] = useState(false)

  useEffect(() => {
    if (!refreshing) setReloadAnimating(false)
  }, [refreshing])

  const handleReload = () => {
    setReloadAnimating(true)
    onReload()
  }

  return (
    <>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          disabled={busy}
          onClick={onCollectAll}
          className={chromeButtonClass}
        >
          {collectingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar todas as fontes
        </button>
        <CollectSourcesProductionInfo status={collectorsStatus} />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleReload}
        className={cn(
          chromeButtonClass,
          reloadAnimating && 'animate-panorama-reload-btn'
        )}
      >
        {refreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RefreshCw
            className={cn('h-3.5 w-3.5', reloadAnimating && 'animate-panorama-refresh-once')}
            aria-hidden
          />
        )}
        Recarregar panorama
      </button>
    </>
  )
}
