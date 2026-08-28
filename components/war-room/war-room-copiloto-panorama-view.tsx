'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { PanoramaBoard } from '@/components/monitoramento/panorama-board'
import { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import {
  remapPanoramaForWarRoom,
  WR_PANORAMA_HEATMAP_COMPARATIVE,
} from '@/lib/war-room/panorama-war-room-theme'
import {
  COPILOTO_REDES_PERIOD_OPTIONS,
  copilotoRedesDays,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
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

/** Copiloto · Radar — mesmos dados do Radar Eleitoral, visual War Room. */
export function WarRoomCopilotoPanoramaView() {
  const [period, setPeriod] = useState<CopilotoRedesPeriod>('7d')
  const days = copilotoRedesDays(period)
  const {
    panorama,
    loading,
    refreshing,
    error,
    animationEpoch,
    carregar,
  } = usePanoramaPanel({ enabled: true, days })

  const wrPanorama = useMemo(() => remapPanoramaForWarRoom(panorama), [panorama])
  const busy = loading || refreshing

  return (
    <div className="wr-copiloto-panorama wr-copiloto-reveal">
      <header
        className="wr-copiloto-panorama__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <nav className="wr-copiloto-redes__period-tabs" aria-label="Período">
          {COPILOTO_REDES_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'wr-copiloto-redes__period-tab',
                period === opt.value && 'wr-copiloto-redes__period-tab--active',
              )}
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </nav>

        <div className="wr-copiloto-panorama__toolbar-actions">
          <p className="wr-copiloto-panorama__last-update">
            <span className="wr-copiloto-panorama__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-panorama__last-update-value">
              {formatLastUpdateLabel(panorama.lastUpdated)}
            </span>
          </p>
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
            <span>Carregando Radar…</span>
          </div>
        ) : (
          <div className="wr-copiloto-panorama__board wr-copiloto-reveal__board">
            <PanoramaBoard
              panorama={wrPanorama}
              loading={false}
              refreshing={refreshing}
              animationEpoch={animationEpoch}
              heatmapComparativeBase={WR_PANORAMA_HEATMAP_COMPARATIVE}
              intelligenceMode
            />
          </div>
        )}
      </div>
    </div>
  )
}
