'use client'

import { useMemo, useState } from 'react'
import {
  PanoramaNewsDayModal,
  type PanoramaNewsDaySelection,
} from '@/components/monitoramento/panorama-news-day-modal'
import {
  heatmapCellColor,
  heatmapCellTextColor,
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

function formatHeatmapCellValue(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mi`
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1_000).toLocaleString('pt-BR')}mil`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mil`
  }
  return Math.round(value).toLocaleString('pt-BR')
}

/** Contraste do texto sobre a intensidade da célula — baseado na luminância real. */
function heatmapValueTone(
  baseHex: string,
  value: number,
  scaleMax: number,
  mode: HeatmapScaleMode,
  comparativeBase?: string,
): 'on-dark' | 'on-light' {
  const color = heatmapCellTextColor(baseHex, value, scaleMax, mode, comparativeBase)
  return color === '#ffffff' ? 'on-dark' : 'on-light'
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
  /**
   * Força o máximo do modo comparativo (ex.: página parcial do heatmap —
   * mantém a escala igual à da lista completa).
   */
  comparativeMax?: number
  /** Exibe o valor numérico dentro de cada célula. */
  showValues?: boolean
  /**
   * Estica linhas/células para ocupar a altura do container
   * (ex.: Comparativo candidatos no Copiloto Redes).
   */
  fillAvailableHeight?: boolean
  /** Cor base do modo “Todos” (default coral IPT; WR usa azul institucional). */
  comparativeBaseColor?: string
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
    <div
      className={cn('flex shrink-0 flex-wrap justify-end gap-1', className)}
      role="group"
      aria-label="Modo de escala"
    >
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
  comparativeMax,
  showValues = false,
  fillAvailableHeight = false,
  comparativeBaseColor,
}: PanoramaMentionHeatmapProps) {
  const [internalScaleMode, setInternalScaleMode] = useState<HeatmapScaleMode>('comparative')
  const scaleMode = scaleModeProp ?? internalScaleMode
  const setScaleMode = onScaleModeChange ?? setInternalScaleMode
  const [selection, setSelection] = useState<PanoramaNewsDaySelection | null>(null)

  const globalMax = useMemo(() => {
    const fromRows = heatmapGlobalMax(rows.map((row) => row.values))
    if (typeof comparativeMax === 'number' && Number.isFinite(comparativeMax) && comparativeMax > 0) {
      return Math.max(comparativeMax, fromRows)
    }
    return fromRows
  }, [rows, comparativeMax])
  const legendBase = heatmapLegendBaseColor(scaleMode, comparativeBaseColor)

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
  const nameColClass = compact
    ? fillAvailableHeight
      ? 'w-[104px] min-[900px]:w-[132px]'
      : 'w-[104px]'
    : 'w-[120px]'
  const axisPadClass = compact
    ? fillAvailableHeight
      ? 'pl-[112px] min-[900px]:pl-[140px]'
      : 'pl-[112px]'
    : 'pl-[128px]'
  const nameTypeClass = compact
    ? 'pmh-name leading-snug'
    : cn('pmh-name', typographyBodyMediumClass, 'text-text-secondary')
  const mutedTypeClass = compact
    ? 'pmh-muted leading-snug'
    : typographyBodyMutedClass
  const rowGapClass = compact ? 'mb-1.5' : 'mb-2'

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col',
        compact ? 'gap-1.5' : 'gap-2',
        className,
      )}
    >
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
          'flex min-h-0 w-full flex-1 flex-col',
          fillAvailableHeight
            ? 'h-full overflow-x-hidden overflow-y-auto'
            : compact
              ? 'justify-start overflow-x-auto overflow-y-auto pr-0.5'
              : 'justify-center overflow-x-auto',
        )}
      >
        <div
          className={cn(
            'w-full max-w-none',
            compact ? 'min-w-0' : 'min-w-[520px]',
            fillAvailableHeight && 'flex w-full flex-col gap-1.5',
          )}
        >
          {rows.map((row, rowIndex) => {
            const scaleMax = scaleMode === 'comparative' ? globalMax : heatmapRowMax(row.values)
            return (
              <div
                key={row.slug}
                className={cn(
                  'flex w-full max-w-none items-center gap-2 last:mb-0',
                  fillAvailableHeight ? 'h-7 shrink-0' : rowGapClass,
                )}
              >
                <span
                  className={cn('shrink-0 truncate', nameColClass, nameTypeClass)}
                  title={row.name}
                >
                  {row.name}
                </span>
                <div className="flex h-full min-w-0 flex-1 gap-1">
                  {row.values.map((value, i) => (
                    <button
                      key={`${row.slug}-${dates[i]}`}
                      type="button"
                      className={cn(
                        'animate-panorama-heatmap-cell min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--color-primary))]',
                        showValues
                          ? cn(
                              'inline-flex items-center justify-center px-0.5',
                              fillAvailableHeight ? 'h-full' : 'h-[22px]',
                            )
                          : fillAvailableHeight
                            ? 'h-full'
                            : 'h-[18px]',
                        value > 0 && enableNewsModal ? 'cursor-pointer' : 'cursor-default',
                      )}
                      style={{
                        backgroundColor: heatmapCellColor(
                          row.color,
                          value,
                          scaleMax,
                          scaleMode,
                          comparativeBaseColor
                        ),
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
                    >
                      {showValues ? (
                        <span
                          className={cn(
                            'wr-heatmap-cell-val pointer-events-none select-none font-semibold leading-none tabular-nums tracking-tight',
                            fillAvailableHeight ? 'text-[10px] min-[900px]:text-[11px]' : 'text-[9px]',
                            heatmapValueTone(
                              row.color,
                              value,
                              scaleMax,
                              scaleMode,
                              comparativeBaseColor,
                            ) === 'on-dark'
                              ? 'wr-heatmap-cell-val--on-dark'
                              : 'wr-heatmap-cell-val--on-light',
                          )}
                        >
                          {value > 0 ? formatHeatmapCellValue(value) : '0'}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {dayTicks.length > 0 ? (
            <div className={cn('mt-1 flex h-4 shrink-0 gap-2', axisPadClass)}>
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
            <div className={cn('mt-1 flex shrink-0 gap-2', axisPadClass)}>
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
                backgroundColor: heatmapCellColor(legendBase, t, 1, scaleMode, comparativeBaseColor),
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
