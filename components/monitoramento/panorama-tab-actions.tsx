'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { CollectSourcesProductionInfo } from '@/components/monitoramento/monitoramento-production-collect-notice'
import { cn } from '@/lib/utils'

interface PanoramaTabActionsProps {
  busy: boolean
  collectingAll: boolean
  refreshing: boolean
  onCollectAll: () => void
  onReload: () => void
}

export function PanoramaTabActions({
  busy,
  collectingAll,
  refreshing,
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
          className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {collectingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Download className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar todas as fontes
        </button>
        <CollectSourcesProductionInfo />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={handleReload}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-app disabled:opacity-50',
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
