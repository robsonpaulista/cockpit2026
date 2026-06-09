'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import type { Chart as ChartJsInstance, TooltipItem } from 'chart.js'
import { IconArrowsMaximize } from '@tabler/icons-react'
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

interface TendenciaTemporalPanelProps {
  pesquisaData: PesquisaSerieRow[]
  candidatos: string[]
  candidatoPadrao: string
  resumoLegendaPorCandidato: Record<string, string>
  onTelaCheia?: () => void
  showHeader?: boolean
  chartHeight?: number
  loading?: boolean
  emptyMessage?: string
  className?: string
}

function countSeriePoints(data: readonly PesquisaSerieRow[], nome: string): number {
  const key = serieKeyForCandidate(nome)
  return data.reduce((acc, row) => (parseSerieValue(row[key]) !== null ? acc + 1 : acc), 0)
}

export function TendenciaTemporalPanel({
  pesquisaData,
  candidatos,
  candidatoPadrao,
  resumoLegendaPorCandidato,
  onTelaCheia,
  showHeader = true,
  chartHeight,
  loading = false,
  emptyMessage = 'Nenhum registro com os filtros atuais.',
  className,
}: TendenciaTemporalPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<ChartJsInstance | null>(null)
  const [hiddenCandidates, setHiddenCandidates] = useState<Set<string>>(new Set())

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
          ? 'Referência · indica indecisão do eleitorado'
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
    if (chartHeight != null) return chartHeight
    const byLegend = legendEntries.length * 54 + 100
    return Math.min(680, Math.max(480, byLegend))
  }, [chartHeight, legendEntries.length])

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
      }),
    [chartLabels, yAxisMax, candidatoPadrao, datasetBundle]
  )

  useEffect(() => {
    setHiddenCandidates(new Set())
  }, [chartDepsKey])

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
        plugins: {
          legend: { display: false },
          tooltip: {
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
                const dateLabel = formatChartDateLabel(String(row.data ?? ''))
                const institutos = extractInstitutosFromRow(row)
                if (institutos.length === 0) return dateLabel
                if (institutos.length === 1) return `${dateLabel} · ${institutos[0]}`
                return `${dateLabel} · ${institutos.join(', ')}`
              },
              label: (context) => {
                const value = typeof context.parsed.y === 'number' ? context.parsed.y : 0
                return ` ${context.dataset.label}: ${value.toFixed(1)}%`
              },
            },
          },
        },
        layout: {
          padding: { bottom: 8 },
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

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartDepsKey])

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

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center" style={{ height: resolvedChartHeight }}>
          <p className="text-[12px] text-text-secondary">Carregando...</p>
        </div>
      )
    }

    if (pesquisaData.length === 0) {
      return (
        <div className="flex items-center justify-center px-4 text-center" style={{ height: resolvedChartHeight }}>
          <p className="text-[12px] text-text-secondary">{emptyMessage}</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_220px]">
        <div className="relative min-h-[480px] w-full" style={{ height: resolvedChartHeight }}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Gráfico de linhas com tendência temporal de intenção de voto por candidato ao longo das datas de pesquisa"
          >
            Gráfico de tendência temporal de intenção de voto por candidato.
          </canvas>
        </div>

        <div
          className="flex flex-col gap-1.5 overflow-y-auto lg:min-h-[480px]"
          style={{ maxHeight: resolvedChartHeight }}
        >
          <p className="mb-0.5 border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-1.5 text-[10px] font-medium uppercase tracking-[0.05em] text-text-muted">
            Candidatos · 1ª → última leitura
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
                    hidden ? 'opacity-35' : entry.isNso ? 'opacity-45' : 'opacity-100'
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
        className
      )}
    >
      {showHeader ? (
        <div className="mb-3.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[13px] font-medium text-text-primary">
              Tendência temporal de intenção · todos os candidatos
            </h2>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Uma linha por candidato · pontos = datas de pesquisa · valores em % de intenção de voto
            </p>
          </div>
          {onTelaCheia ? (
            <button
              type="button"
              onClick={onTelaCheia}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-text-primary transition-colors hover:bg-bg-app"
            >
              <IconArrowsMaximize className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
              Tela cheia
            </button>
          ) : null}
        </div>
      ) : null}

      {renderBody()}
    </div>
  )
}
