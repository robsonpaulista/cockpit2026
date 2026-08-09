'use client'

import { useMemo } from 'react'
import { MetaAdsCollectProgressBar } from '@/components/meta-ads-radar/meta-ads-collect-progress-bar'
import { PanoramaBoard } from '@/components/monitoramento/panorama-board'
import { PanoramaCollectProgress } from '@/components/monitoramento/panorama-collect-progress'
import type { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import {
  remapPanoramaForWarRoom,
  WR_PANORAMA_HEATMAP_COMPARATIVE,
} from '@/lib/war-room/panorama-war-room-theme'

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

  const wrPanorama = useMemo(() => remapPanoramaForWarRoom(panorama), [panorama])

  return (
    <div className="wr-copiloto-panorama flex flex-col gap-4">
      {wrPanorama.setupRequired && wrPanorama.columns.length === 0 ? (
        <div className="rounded-xl border border-[var(--wr-border,#e8e8e6)] bg-[var(--wr-surface-subtle,#f4f4f2)] px-4 py-3 text-sm text-[var(--wr-text-secondary,#686865)]">
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

      {error ? <p className="text-sm text-[var(--wr-danger,#c4544a)]">{error}</p> : null}

      <div className="wr-copiloto-panorama__body">
        <div className="wr-copiloto-panorama__board">
          <PanoramaBoard
            panorama={wrPanorama}
            loading={loading}
            refreshing={refreshing}
            animationEpoch={animationEpoch}
            heatmapComparativeBase={WR_PANORAMA_HEATMAP_COMPARATIVE}
          />
        </div>
      </div>
    </div>
  )
}
