'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { MetaAdsCollectProgressBar } from '@/components/meta-ads-radar/meta-ads-collect-progress-bar'
import { PanoramaBoard } from '@/components/monitoramento/panorama-board'
import { PanoramaCollectProgress } from '@/components/monitoramento/panorama-collect-progress'
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
  setupRequired: false,
}

export function PanoramaPanel() {
  const [panorama, setPanorama] = useState<PanoramaModel>(EMPTY_PANORAMA)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [collectingAll, setCollectingAll] = useState(false)
  const [collectProgress, setCollectProgress] = useState<MonitoramentoCollectAllProgress | null>(null)
  const [metaAdsProgress, setMetaAdsProgress] = useState<MetaAdsCollectProgress | null>(null)
  const [error, setError] = useState('')

  const carregar = useCallback(async (silent = false) => {
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
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletarTodas = useCallback(async () => {
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
  }, [carregar])

  const busy = loading || refreshing || collectingAll

  return (
    <div className="flex flex-col gap-4">
      {panorama.setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute os SQLs de monitoramento no Supabase e colete dados nas abas específicas
          (YouTube, Google News, Meta Ads, Trends) para preencher o panorama.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-text-muted">
          Painel de gestão à vista: gráficos comparativos por plataforma, contexto de picos e
          previews de imprensa, YouTube e anúncios Meta por candidato. Use &quot;Atualizar todas as
          fontes&quot; para rodar as coletas das outras abas em sequência.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void coletarTodas()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {collectingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            Atualizar todas as fontes
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void carregar(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--color-border-secondary)/0.85)] px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-app disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Recarregar panorama
          </button>
        </div>
      </div>

      {collectProgress ? <PanoramaCollectProgress progress={collectProgress} /> : null}

      {metaAdsProgress || (collectingAll && collectProgress?.currentStepId === 'meta-ads') ? (
        <MetaAdsCollectProgressBar
          progress={metaAdsProgress}
          collecting={collectingAll && collectProgress?.currentStepId === 'meta-ads'}
        />
      ) : null}

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <PanoramaBoard panorama={panorama} loading={loading} />
    </div>
  )
}
