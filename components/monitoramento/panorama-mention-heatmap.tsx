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
import { chromeFilterChipClass } from '@/lib/button-chrome'
import {
  typographyBodyMediumClass,
  typographyBodyMutedClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const SCALE_OPTIONS: { value: HeatmapScaleMode; label: string; title: string }[] = [
  {
    value: 'comparative',
    label: 'Todos',
    title: 'Mesma escala entre candidatos',
  },
  {
    value: 'individual',
    label: 'Por candidato',
    title: 'Escala relativa ao pico de cada candidato',
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
  scaleMode?: HeatmapScaleMode
  onScaleModeChange?: (mode: HeatmapScaleMode) => void
  /** Oculta os botões de escala (use com toggle no cabeçalho do card). */
  hideScaleControls?: boolean
  /** Layout mais estreito (ex.: War Room com 7 dias). */
  compact?: boolean
}

export function PanoramaHeatmapScaleToggle({
  scaleMode,
  onScaleModeChange,
  className,
}: {
  scaleMode: HeatmapScaleMode
  onScaleModeChange: (mode: HeatmapScaleMode) => void
  className?: string
}) {
  return (
    <div className={cn('flex shrink-0 flex-wrap justify-end gap-1', className)} role="group" aria-label="Modo de escala">
      {SCALE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onScaleModeChange(opt.value)}
          className={chromeFilterChipClass(scaleMode === opt.value)}
          aria-pressed={scaleMode === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function PanoramaMentionHeatmap({
  dates,
  rows,
  metricLabel,
  className,
  enableNewsModal = true,
  scaleMode: scaleModeProp,
  onScaleModeChange,
  hideScaleControls = false,
  compact = false,
}: PanoramaMentionHeatmapProps) {
  const [internalScaleMode, setInternalScaleMode] = useState<HeatmapScaleMode>('comparative')
  const scaleMode = scaleModeProp ?? internalScaleMode
  const setScaleMode = onScaleModeChange ?? setInternalScaleMode
  const [selection, setSelection] = useState<PanoramaNewsDaySelection | null>(null)

  const globalMax = useMemo(() => heatmapGlobalMax(rows.map((row) => row.values)), [rows])
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

  const dayTicks = compact
    ? dates.map((date, index) => ({
        index,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit' }),
      }))
    : []

  const metricWord = metricLabel.toLowerCase()
  const lessLabel = 'Menos'
  const moreLabel = scaleMode === 'comparative' ? 'Mais' : 'Pico'
  const nameColClass = compact ? 'w-[104px]' : 'w-[120px]'
  const axisPadClass = compact ? 'pl-[112px]' : 'pl-[128px]'
  const nameTypeClass = compact
    ? 'pmh-name leading-snug'
    : cn(typographyBodyMediumClass, 'text-text-secondary')
  const mutedTypeClass = compact
    ? 'pmh-muted leading-snug'
    : typographyBodyMutedClass
  const rowGapClass = compact ? 'mb-1.5' : 'mb-2'

  return (
    <div className={cn('flex h-full min-h-0 flex-col', compact ? 'gap-1.5' : 'gap-2', className)}>
      {!hideScaleControls ? (
        <PanoramaHeatmapScaleToggle scaleMode={scaleMode} onScaleModeChange={setScaleMode} />
      ) : null}

      {enableNewsModal && !compact ? (
        <p className={cn('shrink-0 leading-snug', typographyBodyMutedClass)}>
          Clique em um dia para ver as matérias
        </p>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-x-auto',
          compact ? 'justify-start overflow-y-auto pr-0.5' : 'justify-center',
        )}
      >
        <div className={cn(compact ? 'min-w-0' : 'min-w-[520px]')}>
          {rows.map((row, rowIndex) => {
            const scaleMax = scaleMode === 'comparative' ? globalMax : heatmapRowMax(row.values)
            return (
              <div
                key={row.slug}
                className={cn('flex items-center gap-2 last:mb-0', rowGapClass)}
              >
                <span
                  className={cn('shrink-0 truncate', nameColClass, nameTypeClass)}
                  title={row.name}
                >
                  {row.name}
                </span>
                <div className="flex min-w-0 flex-1 gap-[3px]">
                  {row.values.map((value, i) => (
                    <button
                      key={`${row.slug}-${dates[i]}`}
                      type="button"
                      className={cn(
                        'animate-panorama-heatmap-cell h-[18px] min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--color-primary))]',
                        value > 0 && enableNewsModal ? 'cursor-pointer' : 'cursor-default'
                      )}
                      style={{
                        backgroundColor: heatmapCellColor(row.color, value, scaleMax, scaleMode),
                        animationDelay: `${rowIndex * 22 + i * 5}ms`,
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
                        const rect = e.currentTarget.getBoundingClientRect()
                        setSelection({
                          slug: row.slug,
                          name: row.name,
                          date: dates[i],
                          count: value,
                          anchor: {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                          },
                        })
                      }}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {dayTicks.length > 0 ? (
            <div className={cn('mt-1 flex h-4 gap-2', axisPadClass)}>
              <div className="relative flex min-w-0 flex-1">
                {dayTicks.map((tick) => (
                  <span
                    key={tick.index}
                    className={cn('absolute -translate-x-1/2', mutedTypeClass)}
                    style={{ left: `${((tick.index + 0.5) / Math.max(dates.length, 1)) * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          ) : monthTicks.length > 0 ? (
            <div className={cn('mt-1 flex gap-2', axisPadClass)}>
              <div className="relative flex min-w-0 flex-1">
                {monthTicks.map((tick) => (
                  <span
                    key={tick.index}
                    className={cn('absolute', mutedTypeClass)}
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

      <div className={cn('mt-0 flex shrink-0 flex-wrap items-center gap-2', mutedTypeClass)}>
        <span>{lessLabel}</span>
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
        <span>{moreLabel}</span>
      </div>

      {enableNewsModal ? (
        <PanoramaNewsDayModal selection={selection} onClose={() => setSelection(null)} />
      ) : null}
    </div>
  )
}
