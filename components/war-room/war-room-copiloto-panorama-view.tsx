'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { PanoramaBoard } from '@/components/monitoramento/panorama-board'
import { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import {
  remapPanoramaForWarRoom,
  WR_PANORAMA_HEATMAP_COMPARATIVE,
} from '@/lib/war-room/panorama-war-room-theme'
import { cn } from '@/lib/utils'

function formatLastUpdateLabel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Copiloto · Panorama — mesmos dados do Radar Eleitoral, visual War Room. */
export function WarRoomCopilotoPanoramaView() {
  const {
    panorama,
    loading,
    refreshing,
    error,
    animationEpoch,
    carregar,
  } = usePanoramaPanel({ enabled: true })

  const wrPanorama = useMemo(() => remapPanoramaForWarRoom(panorama), [panorama])
  const busy = loading || refreshing

  return (
    <div className="wr-copiloto-panorama wr-copiloto-reveal">
      <header
        className="wr-copiloto-panorama__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-copiloto-panorama__toolbar-meta">
          <h2 className="wr-copiloto-panorama__title">Panorama</h2>
          <p className="wr-copiloto-panorama__last-update">
            <span className="wr-copiloto-panorama__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-panorama__last-update-value">
              {formatLastUpdateLabel(panorama.lastUpdated)}
            </span>
            <span className="wr-copiloto-panorama__window"> · {panorama.windowLabel}</span>
          </p>
        </div>

        <div className="wr-copiloto-panorama__toolbar-actions">
          <Link
            href="/dashboard/noticias/monitoramento"
            className="wr-copiloto-redes__ghost-btn"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Abrir no Radar
          </Link>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => void carregar(true)}
            disabled={busy}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', busy && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      <div className="wr-copiloto-panorama__body">
        {error ? <p className="wr-copiloto-panorama__error">{error}</p> : null}

        {loading && panorama.columns.length === 0 ? (
          <div className="wr-copiloto-panorama__state">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--wr-text-secondary,#686865)]"
              strokeWidth={1.5}
            />
            <span>Carregando Panorama…</span>
          </div>
        ) : (
          <div className="wr-copiloto-panorama__board wr-copiloto-reveal__board">
            <PanoramaBoard
              panorama={wrPanorama}
              loading={false}
              refreshing={refreshing}
              animationEpoch={animationEpoch}
              heatmapComparativeBase={WR_PANORAMA_HEATMAP_COMPARATIVE}
            />
          </div>
        )}
      </div>
    </div>
  )
}
