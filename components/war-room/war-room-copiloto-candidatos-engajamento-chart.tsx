'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  PanoramaHeatmapScaleToggle,
  PanoramaMentionHeatmap,
} from '@/components/monitoramento/panorama-mention-heatmap'
import { heatmapGlobalMax, type HeatmapScaleMode } from '@/lib/monitoramento-heatmap-colors'
import type { PanoramaHeatmapRow } from '@/lib/monitoramento-panorama-charts'
import type { CandidatosEngajamentoChartModel } from '@/lib/war-room/instagram-candidatos-engajamento'
import { cn } from '@/lib/utils'

type Props = {
  model: CandidatosEngajamentoChartModel
  className?: string
}

/** Alinha ao breakpoint do layout split das Redes (`wr-copiloto-redes`). */
const COMPACT_MEDIA = '(max-width: 1100px)'
const COMPACT_PAGE_SIZE = 5

export function WarRoomCopilotoCandidatosEngajamentoChart({ model, className }: Props) {
  const [page, setPage] = useState(0)
  const [compact, setCompact] = useState(false)
  const [scaleMode, setScaleMode] = useState<HeatmapScaleMode>('comparative')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(COMPACT_MEDIA)
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setPage(0)
  }, [model.lines.length, compact])

  const dates = useMemo(() => model.chartData.map((row) => row.date), [model.chartData])

  const heatmapRows = useMemo<PanoramaHeatmapRow[]>(
    () =>
      model.lines.map((line) => ({
        slug: line.slug,
        name: line.name,
        color: line.color,
        values: model.chartData.map((day) => Number(day[line.slug] ?? 0) || 0),
      })),
    [model.lines, model.chartData],
  )

  const fullComparativeMax = useMemo(
    () => heatmapGlobalMax(heatmapRows.map((row) => row.values)),
    [heatmapRows],
  )

  const pageSize = compact ? COMPACT_PAGE_SIZE : Math.max(heatmapRows.length, 1)
  const pageCount = Math.max(1, Math.ceil(heatmapRows.length / pageSize))
  const pageSafe = Math.min(page, pageCount - 1)
  const rowsPage = heatmapRows.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize)
  const showPager = compact && pageCount > 1

  if (model.empty || model.lines.length === 0) {
    return (
      <p className="wr-copiloto-redes__empty">
        Sem candidatos ativos no comparativo.
      </p>
    )
  }

  return (
    <div className={cn('wr-copiloto-redes-candidatos', className)}>
      <div className="wr-copiloto-redes-candidatos__toolbar">
        <PanoramaHeatmapScaleToggle
          scaleMode={scaleMode}
          onScaleModeChange={setScaleMode}
          className="wr-copiloto-redes-candidatos__scale"
        />
      </div>

      <div className="wr-copiloto-redes-candidatos__scroll">
        <PanoramaMentionHeatmap
          dates={dates}
          rows={rowsPage}
          metricLabel="Engajamento"
          enableNewsModal={false}
          scaleMode={scaleMode}
          onScaleModeChange={setScaleMode}
          hideScaleControls
          compact
          comparativeMax={fullComparativeMax}
          showValues
          className="wr-copiloto-redes-candidatos__heatmap"
        />
      </div>

      {showPager ? (
        <div
          className="wr-copiloto-redes__pager"
          role="navigation"
          aria-label="Páginas de candidatos"
        >
          <button
            type="button"
            className="wr-copiloto-redes__pager-btn"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <span className="wr-copiloto-redes__pager-status tabular-nums">
            {pageSafe + 1} / {pageCount}
            <span className="wr-copiloto-redes__pager-count">
              · {heatmapRows.length} candidatos
            </span>
          </span>
          <button
            type="button"
            className="wr-copiloto-redes__pager-btn"
            disabled={pageSafe >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  )
}
