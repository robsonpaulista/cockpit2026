'use client'

import { MetaAdsCollectProgressBar } from '@/components/meta-ads-radar/meta-ads-collect-progress-bar'
import { PanoramaBoard } from '@/components/monitoramento/panorama-board'
import { PanoramaCollectProgress } from '@/components/monitoramento/panorama-collect-progress'
import type { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'

type PanoramaPanelState = ReturnType<typeof usePanoramaPanel>

interface PanoramaPanelProps {
  state: PanoramaPanelState
}

export function PanoramaPanel({ state }: PanoramaPanelProps) {
  const {
    panorama,
    loading,
    refreshing,
    collectingAll,
    collectProgress,
    metaAdsProgress,
    error,
    animationEpoch,
  } = state

  return (
    <div className="flex flex-col gap-4">
      {panorama.setupRequired && panorama.columns.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute os SQLs de monitoramento no Supabase e cadastre candidatos ativos para habilitar o
          panorama.
        </div>
      ) : null}

      {collectProgress ? <PanoramaCollectProgress progress={collectProgress} /> : null}

      {metaAdsProgress || (collectingAll && collectProgress?.currentStepId === 'meta-ads') ? (
        <MetaAdsCollectProgressBar
          progress={metaAdsProgress}
          collecting={collectingAll && collectProgress?.currentStepId === 'meta-ads'}
        />
      ) : null}

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <PanoramaBoard
        panorama={panorama}
        loading={loading}
        refreshing={refreshing}
        animationEpoch={animationEpoch}
      />
    </div>
  )
}
