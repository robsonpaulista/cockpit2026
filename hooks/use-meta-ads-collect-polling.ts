'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import { normalizeMetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import type { MetaAdsCollectStatus } from '@/lib/meta-ads-types'

type MetaAdsStatusResponse = MetaAdsCollectStatus & {
  progress?: unknown
  message?: string
  setupRequired?: boolean
  error?: string
}

export function useMetaAdsCollectPolling(active: boolean, intervalMs = 2000) {
  const [progress, setProgress] = useState<MetaAdsCollectProgress | null>(null)
  const [status, setStatus] = useState<MetaAdsCollectStatus | null>(null)

  const refresh = useCallback(async (): Promise<MetaAdsStatusResponse | null> => {
    try {
      const res = await fetch('/api/meta-ads/status', { cache: 'no-store' })
      const j = (await res.json()) as MetaAdsStatusResponse
      if (!res.ok) return null
      setStatus(j)
      setProgress(normalizeMetaAdsCollectProgress(j.progress))
      return j
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!active) return
    void refresh()
    const id = window.setInterval(() => void refresh(), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs, refresh])

  return { progress, status, refresh }
}
