'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import type { Chart as ChartJsInstance, ChartEvent, TooltipItem } from 'chart.js'
import { IconArrowsMaximize, IconPin, IconPinFilled, IconX } from '@tabler/icons-react'
import {
  computeYAxisMax,
  extractInstitutosFromRow,
  firstSerieValue,
  formatChartAxisLabel,
  formatChartDateLabel,
  formatDeltaLegendText,
  getCandidateLineColor,
  getDatasetStyle,
  getTopActiveCandidates,
  isNsoCandidate,
  lastSerieValue,
  legendDisplayName,
  parseSerieValue,
  serieKeyForCandidate,
} from '@/lib/pesquisa-tendencia-chart-config'
import {
  computeEndLabelRightPadding,
  createPesquisaEndLineLabelsPlugin,
} from '@/lib/pesquisa-tendencia-chart-end-labels-plugin'
import { cn } from '@/lib/utils'

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip)

type PesquisaSerieRow = Record<string, string | number | undefined>

interface LegendEntry {
  nome: string
  color: string
  latestValue: number | null
  firstValue: number | null
  singleReading: boolean
  resumo: string
  datasetIndex: number
  isNso: boolean
}

type PopupRow = {
  nome: string
  color: string
  value: number
  isNso: boolean
}

type PinnedPopup = {
  dataIndex: number
  title: string
  rows: PopupRow[]
  left: number
  top: number
}

interface TendenciaTemporalPanelProps {
  pesquisaData: PesquisaSerieRow[]
  candidatos: string[]
  candidatoPadrao: string
  resumoLegendaPorCandidato: Record<string, string>
  onTelaCheia?: () => void
  showHeader?: boolean
  chartHeight?: number
  /** Preenche a altura do container (ex.: modal tela cheia). */
  fillAvailable?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
}

const POPUP_WIDTH = 228

function countSeriePoints(data: readonly PesquisaSerieRow[], nome: string): number {
  const key = serieKeyForCandidate(nome)
  return data.reduce((acc, row) => (parseSerieValue(row[key]) !== null ? acc + 1 : acc), 0)
}

function buildPopupTitle(row: PesquisaSerieRow, fallbackLabel: string): string {
  const dateLabel = formatChartDateLabel(String(row.data ?? ''))
  const institutos = extractInstitutosFromRow(row)
  if (institutos.length === 0) return dateLabel || fallbackLabel
  if (institutos.length === 1) return `${dateLabel} · ${institutos[0]}`
  return `${dateLabel} · ${institutos.join(', ')}`
}

function buildPopupRows(
  dataIndex: number,
  datasetBundle: Array<{ nome: string; color: string; data: Array<number | null> }>,
): PopupRow[] {
  const rows: PopupRow[] = []
  for (const dataset of datasetBundle) {
    const value = dataset.data[dataIndex]
    if (typeof value !== 'number') continue
    rows.push({
      nome: dataset.nome,
      color: dataset.color,
      value,
      isNso: isNsoCandidate(dataset.nome),
    })
  }
  rows.sort((a, b) => {
    if (a.isNso !== b.isNso) return a.isNso ? 1 : -1
    return b.value - a.value
  })
  return rows
}

function resolvePopupPosition(
  chart: ChartJsInstance,
  dataIndex: number,
  stackIndex: number,
): { left: number; top: number } | null {
  const meta = chart.getDatasetMeta(0)
  const point = meta?.data?.[dataIndex]
  if (!point || typeof point.x !== 'number') return null

  const area = chart.chartArea
  const staggerX = (stackIndex % 4) * 14
  const staggerY = Math.floor(stackIndex / 4) * 18
  let left = point.x - POPUP_WIDTH / 2 + staggerX
  if (left + POPUP_WIDTH > area.right - 4) left = area.right - POPUP_WIDTH - 4
  if (left < area.left + 4) left = area.left + 4

  const top = Math.max(area.top + 6, 8) + staggerY
  return { left, top }
}

export function TendenciaTemporalPanel({
  pesquisaData,
  candidatos,
  candidatoPadrao,
  resumoLegendaPorCandidato,
  onTelaCheia,
  showHeader = true,
  chartHeight,
  fillAvailable = false,
  loading = false,
  emptyMessage = 'Nenhum registro com os filtros atuais.',
  className,
}: TendenciaTemporalPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ChartJsInstance | null>(null)
  const candidatoPadraoRef = useRef(candidatoPadrao)
  candidatoPadraoRef.current = candidatoPadrao

  const [hiddenCandidates, setHiddenCandidates] = useState<Set<string>>(new Set())
  /** Popups permanecem abertos ao clicar na data (vários ao mesmo tempo). */
  const [fixPopups, setFixPopups] = useState(true)
  const [pinnedIndexes, setPinnedIndexes] = useState<number[]>([])
  const [layoutTick, setLayoutTick] = useState(0)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)

  const fixPopupsRef = useRef(fixPopups)
  fixPopupsRef.current = fixPopups

  const endLineLabelsPlugin = useMemo(
    () =>
      createPesquisaEndLineLabelsPlugin({
        isHidden: () => false,
        isBold: (label) => label === candidatoPadraoRef.current,
      }),
    []
  )

  const endLabelPadding = useMemo(
    () => computeEndLabelRightPadding(candidatos),
    [candidatos]
  )

  const topActiveCandidates = useMemo(
    () => getTopActiveCandidates(candidatos, pesquisaData),
    [candidatos, pesquisaData]
  )

  const chartLabels = useMemo(
    () =>
      pesquisaData.map((row) =>
        formatChartAxisLabel(String(row.data ?? ''), row)
      ),
    [pesquisaData]
  )

  const datasetBundle = useMemo(() => {
    const usedColors = new Set<string>()
    return candidatos.map((nome, index) => {
      const color = getCandidateLineColor(nome, candidatoPadrao, usedColors)
      const latestValue = lastSerieValue(pesquisaData, nome)
      const style = getDatasetStyle(nome, candidatoPadrao, latestValue, topActiveCandidates)
      const key = serieKeyForCandidate(nome)

      return {
        nome,
        index,
        color,
        style,
        data: pesquisaData.map((row) => parseSerieValue(row[key])),
      }
    })
  }, [candidatos, candidatoPadrao, pesquisaData, topActiveCandidates])

  const legendEntries = useMemo(() => {
    const regular: LegendEntry[] = []
    let nsoEntry: LegendEntry | null = null

    datasetBundle.forEach((dataset) => {
      const firstValue = firstSerieValue(pesquisaData, dataset.nome)
      const latestValue = lastSerieValue(pesquisaData, dataset.nome)
      const entry: LegendEntry = {
        nome: dataset.nome,
        color: dataset.color,
        latestValue,
        firstValue,
        singleReading: countSeriePoints(pesquisaData, dataset.nome) <= 1,
        resumo: isNsoCandidate(dataset.nome)
          ? 'Indecisão do eleitorado (referência no gráfico)'
          : resumoLegendaPorCandidato[dataset.nome] ?? '',
        datasetIndex: dataset.index,
        isNso: isNsoCandidate(dataset.nome),
      }

      if (entry.isNso) {
        nsoEntry = entry
      } else {
        regular.push(entry)
      }
    })

    regular.sort((a, b) => (b.latestValue ?? -1) - (a.latestValue ?? -1))

    return nsoEntry ? [...regular, nsoEntry] : regular
  }, [datasetBundle, pesquisaData, resumoLegendaPorCandidato])

  const resolvedChartHeight = useMemo(() => {
    if (fillAvailable && measuredHeight != null && measuredHeight > 0) {
      return Math.max(280, Math.floor(measuredHeight))
    }
    if (chartHeight != null) return chartHeight
    const byLegend = legendEntries.length * 54 + 100
    return Math.min(680, Math.max(480, byLegend))
  }, [fillAvailable, measuredHeight, chartHeight, legendEntries.length])

  const yAxisMax = useMemo(() => {
    const values: number[] = []
    datasetBundle.forEach((dataset) => {
      dataset.data.forEach((value) => {
        if (value !== null) values.push(value)
      })
    })
    return computeYAxisMax(values)
  }, [datasetBundle])

  const chartDepsKey = useMemo(
    () =>
      JSON.stringify({
        chartLabels,
        yAxisMax,
        candidatoPadrao,
        datasets: datasetBundle.map((dataset) => ({
          nome: dataset.nome,
          data: dataset.data,
          color: dataset.color,
          style: dataset.style,
        })),
        endLabelPadding,
      }),
    [chartLabels, yAxisMax, candidatoPadrao, datasetBundle, endLabelPadding]
  )

  useEffect(() => {
    setHiddenCandidates(new Set())
    setPinnedIndexes([])
  }, [chartDepsKey])

  const bumpLayout = useCallback(() => {
    setLayoutTick((tick) => tick + 1)
  }, [])

  useEffect(() => {
    if (!fillAvailable) {
      setMeasuredHeight(null)
      return
    }
    const el = chartAreaRef.current
    if (!el) return

    const apply = (height: number) => {
      const next = Math.max(280, Math.floor(height))
      setMeasuredHeight((prev) => (prev === next ? prev : next))
    }

    apply(el.getBoundingClientRect().height)

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      apply(entry.contentRect.height)
      chartRef.current?.resize()
      bumpLayout()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fillAvailable, bumpLayout, chartDepsKey, loading])

  const togglePinIndex = useCallback((dataIndex: number) => {
    setPinnedIndexes((prev) =>
      prev.includes(dataIndex)
        ? prev.filter((idx) => idx !== dataIndex)
        : [...prev, dataIndex],
    )
  }, [])

  const togglePinIndexRef = useRef(togglePinIndex)
  togglePinIndexRef.current = togglePinIndex

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || pesquisaData.length === 0) {
      chartRef.current?.destroy()
      chartRef.current = null
      return
    }

    chartRef.current?.destroy()

    chartRef.current = new Chart(canvas, {
      type: 'line',
      plugins: [endLineLabelsPlugin],
      data: {
        labels: chartLabels,
        datasets: datasetBundle.map((dataset) => ({
          label: dataset.nome,
          data: dataset.data,
          borderColor: dataset.color,
          backgroundColor: dataset.color,
          borderWidth: dataset.style.borderWidth,
          borderDash: dataset.style.borderDash,
          pointRadius: dataset.style.pointRadius,
          pointHoverRadius: dataset.style.pointRadius + 2,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: dataset.color,
          pointBorderWidth: dataset.style.borderWidth,
          tension: 0.4,
          fill: false,
          order: dataset.style.order,
          spanGaps: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        onClick: (event: ChartEvent, elements, chart) => {
          if (!fixPopupsRef.current) return
          if (elements.length > 0) {
            togglePinIndexRef.current(elements[0].index)
            return
          }
          // Clique na coluna da data (não só no ponto) — mesmo modo do tooltip.
          const hits = chart.getElementsAtEventForMode(
            event as unknown as Event,
            'index',
            { intersect: false },
            true,
          )
          if (hits.length === 0) return
          togglePinIndexRef.current(hits[0].index)
        },
        onResize: () => {
          bumpLayout()
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !fixPopupsRef.current,
            backgroundColor: '#ffffff',
            titleColor: '#2C2C2A',
            bodyColor: '#5F5E5A',
            borderColor: '#D3D1C7',
            borderWidth: 1,
            padding: 10,
            titleFont: { size: 12, weight: 500 },
            bodyFont: { size: 11 },
            itemSort: (a: TooltipItem<'line'>, b: TooltipItem<'line'>) => {
              const av = typeof a.parsed.y === 'number' ? a.parsed.y : -Infinity
              const bv = typeof b.parsed.y === 'number' ? b.parsed.y : -Infinity
              return bv - av
            },
            callbacks: {
              title: (items) => {
                if (!items.length) return ''
                const idx = items[0].dataIndex
                const row = pesquisaData[idx]
                if (!row) return chartLabels[idx] ?? ''
                return buildPopupTitle(row, chartLabels[idx] ?? '')
              },
              label: (context) => {
                const value = typeof context.parsed.y === 'number' ? context.parsed.y : 0
                return ` ${context.dataset.label}: ${value.toFixed(1)}%`
              },
            },
          },
        },
        layout: {
          padding: { right: endLabelPadding, bottom: 8 },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: '#D3D1C7', width: 0.5 },
            ticks: {
              autoSkip: chartLabels.length > 8,
              maxRotation: 0,
              minRotation: 0,
              font: { size: 11 },
              color: '#888780',
              padding: 12,
            },
          },
          y: {
            min: 0,
            max: yAxisMax,
            grid: {
              color: 'rgba(0,0,0,0.05)',
              lineWidth: 0.5,
            },
            border: {
              dash: [3, 3],
              color: 'transparent',
            },
            ticks: {
              stepSize: 10,
              font: { size: 11 },
              color: '#888780',
              padding: 8,
              callback: (value) => `${value}%`,
            },
          },
        },
      },
    })

    bumpLayout()

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartDepsKey, bumpLayout])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart?.options.plugins?.tooltip) return
    chart.options.plugins.tooltip.enabled = !fixPopups
    chart.update('none')
  }, [fixPopups])

  useEffect(() => {
    const onResize = () => bumpLayout()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [bumpLayout])

  const pinnedPopups = useMemo((): PinnedPopup[] => {
    void layoutTick
    const chart = chartRef.current
    if (!chart || !fixPopups || pinnedIndexes.length === 0) return []

    const out: PinnedPopup[] = []
    pinnedIndexes.forEach((dataIndex, stackIndex) => {
      const row = pesquisaData[dataIndex]
      if (!row) return
      const pos = resolvePopupPosition(chart, dataIndex, stackIndex)
      if (!pos) return
      out.push({
        dataIndex,
        title: buildPopupTitle(row, chartLabels[dataIndex] ?? ''),
        rows: buildPopupRows(dataIndex, datasetBundle),
        left: pos.left,
        top: pos.top,
      })
    })
    return out
  }, [
    layoutTick,
    fixPopups,
    pinnedIndexes,
    pesquisaData,
    chartLabels,
    datasetBundle,
  ])

  const toggleCandidateVisibility = (nome: string, datasetIndex: number) => {
    const chart = chartRef.current
    if (!chart) return

    const visible = chart.isDatasetVisible(datasetIndex)
    chart.setDatasetVisibility(datasetIndex, !visible)
    chart.update()

    setHiddenCandidates((prev) => {
      const next = new Set(prev)
      if (visible) next.add(nome)
      else next.delete(nome)
      return next
    })
  }

  const pinAllDates = () => {
    setPinnedIndexes(pesquisaData.map((_, index) => index))
    setFixPopups(true)
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div
          className={cn('flex items-center justify-center', fillAvailable && 'min-h-0 flex-1')}
          style={fillAvailable ? undefined : { height: resolvedChartHeight }}
        >
          <p className="text-[12px] text-text-secondary">Carregando...</p>
        </div>
      )
    }

    if (pesquisaData.length === 0) {
      return (
        <div
          className={cn(
            'flex items-center justify-center px-4 text-center',
            fillAvailable && 'min-h-0 flex-1',
          )}
          style={fillAvailable ? undefined : { height: resolvedChartHeight }}
        >
          <p className="text-[12px] text-text-secondary">{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div
        className={cn(
          'grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_220px]',
          fillAvailable && 'h-full min-h-0 flex-1',
        )}
      >
        <div
          ref={chartAreaRef}
          className={cn(
            'relative w-full overflow-hidden',
            fillAvailable ? 'min-h-0' : 'min-h-[480px]',
            fixPopups && 'cursor-pointer',
          )}
          style={
            fillAvailable
              ? { height: measuredHeight ?? '100%' }
              : { height: resolvedChartHeight }
          }
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Gráfico de linhas com tendência temporal de intenção de voto por candidato ao longo das datas de pesquisa"
          >
            Gráfico de tendência temporal de intenção de voto por candidato.
          </canvas>

          {pinnedPopups.map((popup) => (
            <div
              key={popup.dataIndex}
              className="pointer-events-auto absolute z-20 max-h-[min(420px,70%)] w-[228px] overflow-y-auto rounded-[10px] border border-[#D3D1C7] bg-white p-2.5 shadow-[0_8px_24px_rgba(44,44,42,0.12)]"
              style={{ left: popup.left, top: popup.top }}
              role="dialog"
              aria-label={`Detalhe da pesquisa ${popup.title}`}
            >
              <div className="mb-1.5 flex items-start gap-1.5">
                <p className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-[#2C2C2A]">
                  {popup.title}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPinnedIndexes((prev) => prev.filter((idx) => idx !== popup.dataIndex))
                  }}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#888780] transition-colors hover:bg-[#F5F4F0] hover:text-[#2C2C2A]"
                  aria-label={`Fechar popup ${popup.title}`}
                >
                  <IconX className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {popup.rows.map((row) => (
                  <li key={row.nome} className="flex items-center gap-1.5 text-[11px] text-[#5F5E5A]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px] border"
                      style={{ borderColor: row.color, backgroundColor: `${row.color}22` }}
                      aria-hidden
                    />
                    <span className={cn('min-w-0 flex-1 truncate', row.isNso && 'opacity-70')}>
                      {legendDisplayName(row.nome)}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium text-[#2C2C2A]">
                      {row.value.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={cn(
            'flex flex-col gap-1.5 overflow-y-auto',
            fillAvailable ? 'min-h-0' : 'lg:min-h-[480px]',
          )}
          style={
            fillAvailable
              ? { height: measuredHeight ?? '100%' }
              : { maxHeight: resolvedChartHeight }
          }
        >
          <p className="mb-0.5 border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-1.5 text-[10px] font-medium uppercase tracking-[0.05em] text-text-muted">
            Variação · clique para ocultar linha
          </p>

          {legendEntries.map((entry, index) => {
            const hidden = hiddenCandidates.has(entry.nome)
            const delta = formatDeltaLegendText(entry.firstValue, entry.latestValue, entry.singleReading)
            const deltaClass =
              delta.tone === 'up'
                ? 'text-[#3B6D11] font-medium'
                : delta.tone === 'down'
                  ? 'text-[#A32D2D] font-medium'
                  : 'text-text-muted'

            return (
              <div key={entry.nome}>
                {entry.isNso && index > 0 ? (
                  <div
                    className="mb-1.5 border-t border-[rgb(var(--color-border-tertiary)/0.85)]"
                    aria-hidden
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleCandidateVisibility(entry.nome, entry.datasetIndex)}
                  className={cn(
                    'w-full rounded-[10px] border border-[rgb(var(--color-border-tertiary)/0.85)] px-2.5 py-2 text-left transition-colors hover:border-[rgb(var(--color-border-secondary)/0.85)]',
                    hidden ? 'opacity-35' : entry.isNso ? 'opacity-80' : 'opacity-100'
                  )}
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-text-primary">
                        {legendDisplayName(entry.nome)}
                      </span>
                      {entry.latestValue !== null ? (
                        <span
                          className="shrink-0 text-[12px] font-medium tabular-nums"
                          style={{ color: entry.color }}
                        >
                          {entry.latestValue.toFixed(1).replace('.', ',')}%
                        </span>
                      ) : null}
                    </div>

                    {!entry.isNso ? (
                      <p className={cn('ml-3.5 text-[10.5px] tabular-nums', deltaClass)}>{delta.text}</p>
                    ) : null}

                    {entry.resumo ? (
                      <p className="ml-3.5 text-[10.5px] leading-snug text-text-muted">{entry.resumo}</p>
                    ) : null}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4',
        fillAvailable && 'flex h-full min-h-0 flex-1 flex-col overflow-hidden',
        className
      )}
    >
      {showHeader ? (
        <div className="mb-3.5 shrink-0">
          <h2 className="text-[13px] font-medium text-text-primary">
            Tendência temporal de intenção · todos os candidatos
          </h2>
          <p className="mt-0.5 text-[11px] text-text-muted">
            {fixPopups
              ? 'Clique em uma data para fixar o popup · vários podem ficar abertos · use o X para fechar'
              : 'Passe o mouse sobre uma data para ver o detalhe · ative “Fixar popups” para manter abertos'}
          </p>
        </div>
      ) : null}

      {pesquisaData.length > 0 && !loading ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setFixPopups((prev) => {
                if (prev) setPinnedIndexes([])
                return !prev
              })
            }}
            aria-pressed={fixPopups}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
              fixPopups
                ? 'border-[#D3D1C7] bg-[#F5F4F0] text-text-primary'
                : 'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-primary hover:bg-bg-app',
            )}
          >
            {fixPopups ? (
              <IconPinFilled className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
            ) : (
              <IconPin className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
            )}
            Fixar popups
          </button>
          {fixPopups ? (
            <>
              <button
                type="button"
                onClick={pinAllDates}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary transition-colors hover:bg-bg-app"
              >
                Mostrar todas
              </button>
              {pinnedIndexes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPinnedIndexes([])}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary transition-colors hover:bg-bg-app"
                >
                  Fechar todas
                </button>
              ) : null}
            </>
          ) : null}
          {onTelaCheia ? (
            <button
              type="button"
              onClick={onTelaCheia}
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary transition-colors hover:bg-bg-app"
            >
              <IconArrowsMaximize className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
              Tela cheia
            </button>
          ) : null}
        </div>
      ) : onTelaCheia && showHeader ? (
        <div className="mb-3 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={onTelaCheia}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary transition-colors hover:bg-bg-app"
          >
            <IconArrowsMaximize className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
            Tela cheia
          </button>
        </div>
      ) : null}

      {renderBody()}
    </div>
  )
}
