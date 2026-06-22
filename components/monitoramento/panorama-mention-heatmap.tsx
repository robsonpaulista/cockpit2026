'use client'

import { useMemo, useState } from 'react'
import {
  PanoramaNewsDayModal,
  type PanoramaNewsDaySelection,
} from '@/components/monitoramento/panorama-news-day-modal'
import {
  heatmapCellColor,
  heatmapGlobalMax,
  heatmapLegendBaseColor,
  heatmapRowMax,
  type HeatmapScaleMode,
} from '@/lib/monitoramento-heatmap-colors'
import type { PanoramaHeatmapRow } from '@/lib/monitoramento-panorama-charts'
import { cn } from '@/lib/utils'

const SCALE_OPTIONS: { value: HeatmapScaleMode; label: string; hint: string }[] = [
  {
    value: 'comparative',
    label: 'Comparar todos',
    hint: 'Mesma escala entre candidatos — quem teve mais menções fica mais escuro',
  },
  {
    value: 'individual',
    label: 'Picos por candidato',
    hint: 'Escala relativa ao pico de cada um — detecta dias atípicos mesmo com pouco volume',
  },
]

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

interface PanoramaMentionHeatmapProps {
  dates: string[]
  rows: PanoramaHeatmapRow[]
  metricLabel: string
  className?: string
  /** Abre modal de matérias ao clicar (só Google News). */
  enableNewsModal?: boolean
}

export function PanoramaMentionHeatmap({
  dates,
  rows,
  metricLabel,
  className,
  enableNewsModal = true,
}: PanoramaMentionHeatmapProps) {
  const [scaleMode, setScaleMode] = useState<HeatmapScaleMode>('comparative')
  const [selection, setSelection] = useState<PanoramaNewsDaySelection | null>(null)

  const globalMax = useMemo(() => heatmapGlobalMax(rows.map((row) => row.values)), [rows])
  const activeOption = SCALE_OPTIONS.find((o) => o.value === scaleMode) ?? SCALE_OPTIONS[0]
  const legendBase = heatmapLegendBaseColor(scaleMode)

  const monthTicks: Array<{ index: number; label: string }> = []
  let lastMonth = ''
  dates.forEach((date, index) => {
    const month = date.slice(0, 7)
    if (month !== lastMonth) {
      monthTicks.push({
        index,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }),
      })
      lastMonth = month
    }
  })

  const metricWord = metricLabel.toLowerCase()
  const lessLabel = enableNewsModal ? 'Menos menções (todos)' : `Menos ${metricWord} (todos)`
  const moreLabel = enableNewsModal ? 'Mais menções (todos)' : `Mais ${metricWord} (todos)`
  const lessIndividual = enableNewsModal ? 'Menos menções (candidato)' : `Menos ${metricWord} (candidato)`
  const moreIndividual = enableNewsModal ? 'Pico do candidato' : `Pico de ${metricWord}`

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setScaleMode(opt.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] font-medium transition-colors',
                scaleMode === opt.value
                  ? 'border-[rgb(var(--color-primary))] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                  : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
              )}
              aria-pressed={scaleMode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {scaleMode === 'comparative' && globalMax > 0 ? (
          <p className="text-[10px] text-text-muted">
            Escala global · máx. {globalMax} {metricLabel.toLowerCase()}/dia
          </p>
        ) : null}
      </div>

      <p className="shrink-0 text-[11px] leading-snug text-text-muted">
        {activeOption.hint}
        {enableNewsModal ? ' · clique em um dia para ver as matérias' : null}
      </p>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="min-w-[520px]">
          {rows.map((row) => {
            const scaleMax = scaleMode === 'comparative' ? globalMax : heatmapRowMax(row.values)
            return (
              <div key={row.slug} className="mb-2 flex items-center gap-2 last:mb-0">
                <span
                  className="w-[118px] shrink-0 truncate text-[11px] font-medium text-text-secondary"
                  title={row.name}
                >
                  {scaleMode === 'individual' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                        aria-hidden
                      />
                      {row.name}
                    </span>
                  ) : (
                    row.name
                  )}
                </span>
                <div className="flex min-w-0 flex-1 gap-[3px]">
                  {row.values.map((value, i) => (
                    <button
                      key={`${row.slug}-${dates[i]}`}
                      type="button"
                      className={cn(
                        'h-[18px] min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--color-primary))]',
                        value > 0 && enableNewsModal ? 'cursor-pointer' : 'cursor-default'
                      )}
                      style={{
                        backgroundColor: heatmapCellColor(row.color, value, scaleMax, scaleMode),
                      }}
                      title={`${row.name} · ${formatDayLabel(dates[i])}: ${value} ${metricWord}${
                        scaleMode === 'comparative' && globalMax > 0
                          ? ` (${Math.round((value / globalMax) * 100)}% do pico global)`
                          : scaleMode === 'individual' && scaleMax > 0 && value > 0
                            ? ` (${Math.round((value / scaleMax) * 100)}% do pico de ${row.name})`
                            : ''
                      }${value > 0 && enableNewsModal ? ' · clique para ver matérias' : ''}`}
                      aria-label={`${row.name}, ${formatDayLabel(dates[i])}: ${value} ${metricWord}`}
                      disabled={value <= 0 || !enableNewsModal}
                      onClick={(e) => {
                        if (value <= 0 || !enableNewsModal) return
                        setSelection({
                          slug: row.slug,
                          name: row.name,
                          date: dates[i],
                          count: value,
                          anchor: { x: e.clientX, y: e.clientY },
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {monthTicks.length > 0 ? (
            <div className="mt-1 flex gap-2 pl-[126px]">
              <div className="relative flex min-w-0 flex-1">
                {monthTicks.map((tick) => (
                  <span
                    key={tick.index}
                    className="absolute text-[9px] text-text-muted"
                    style={{ left: `${(tick.index / Math.max(dates.length - 1, 1)) * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex shrink-0 flex-wrap items-center gap-2 text-[10px] text-text-muted">
        <span>{scaleMode === 'comparative' ? lessLabel : lessIndividual}</span>
        <div className="flex gap-[2px]">
          {[0.15, 0.35, 0.55, 0.75, 1].map((t) => (
            <div
              key={t}
              className="h-3 w-4 rounded-[2px]"
              style={{
                backgroundColor: heatmapCellColor(legendBase, t, 1, scaleMode),
              }}
            />
          ))}
        </div>
        <span>{scaleMode === 'comparative' ? moreLabel : moreIndividual}</span>
      </div>

      {enableNewsModal ? (
        <PanoramaNewsDayModal selection={selection} onClose={() => setSelection(null)} />
      ) : null}
    </div>
  )
}
