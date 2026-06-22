'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import type { MonitoramentoCollectAllProgress } from '@/lib/monitoramento-collect-all'
import { runMonitoramentoCollectAll } from '@/lib/monitoramento-collect-all'
import type { PanoramaModel } from '@/lib/monitoramento-panorama'
import { panoramaWindowLabel } from '@/lib/monitoramento-panorama-window'

const EMPTY_PANORAMA: PanoramaModel = {
  title: 'PAINEL DE MONITORAMENTO — PIAUÍ 2026',
  windowLabel: panoramaWindowLabel(),
  lastUpdated: null,
  isLive: false,
  columns: [],
  charts: [],
  platformKpis: [],
  setupRequired: false,
}

type PanoramaMeta = {
  lastUpdated: string | null
  windowLabel: string
  isLive: boolean
}

export function usePanoramaPanel(options: {
  enabled: boolean
  onMetaChange?: (meta: PanoramaMeta) => void
}) {
  const { enabled, onMetaChange } = options
  const [panorama, setPanorama] = useState<PanoramaModel>(EMPTY_PANORAMA)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [collectingAll, setCollectingAll] = useState(false)
  const [collectProgress, setCollectProgress] = useState<MonitoramentoCollectAllProgress | null>(null)
  const [metaAdsProgress, setMetaAdsProgress] = useState<MetaAdsCollectProgress | null>(null)
  const [error, setError] = useState('')

  const carregar = useCallback(async (silent = false) => {
    if (!enabled) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError('')
    try {
      const res = await fetch('/api/monitoramento/panorama', { cache: 'no-store' })
      const j = (await res.json()) as { error?: string; panorama?: PanoramaModel }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao carregar panorama.')
      setPanorama(j.panorama ?? EMPTY_PANORAMA)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar panorama.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void carregar()
  }, [enabled, carregar])

  useEffect(() => {
    if (!enabled) return
    onMetaChange?.({
      lastUpdated: panorama.lastUpdated,
      windowLabel: panorama.windowLabel,
      isLive: panorama.isLive,
    })
  }, [enabled, panorama.lastUpdated, panorama.windowLabel, panorama.isLive, onMetaChange])

  const coletarTodas = useCallback(async () => {
    if (!enabled) return
    setCollectingAll(true)
    setCollectProgress(null)
    setMetaAdsProgress(null)
    setError('')
    try {
      const result = await runMonitoramentoCollectAll(setCollectProgress, {
        onMetaAdsProgress: setMetaAdsProgress,
      })
      setCollectProgress(result)
      await carregar(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar fontes.')
    } finally {
      setCollectingAll(false)
      setMetaAdsProgress(null)
    }
  }, [enabled, carregar])

  const busy = loading || refreshing || collectingAll

  return {
    panorama,
    loading,
    refreshing,
    collectingAll,
    collectProgress,
    metaAdsProgress,
    error,
    busy,
    carregar,
    coletarTodas,
  }
}
