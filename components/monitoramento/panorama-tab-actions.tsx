'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { chromeButtonClass } from '@/lib/button-chrome'
import { cn } from '@/lib/utils'

interface PanoramaTabActionsProps {
  busy: boolean
  refreshing: boolean
  onReload: () => void
}

export function PanoramaTabActions({
  busy,
  refreshing,
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
      Recarregar
    </button>
  )
}
