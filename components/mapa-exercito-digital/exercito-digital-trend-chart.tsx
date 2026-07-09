'use client'

import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import type { ExercitoDigitalTrendPoint } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip)

interface ExercitoDigitalTrendChartProps {
  points: ExercitoDigitalTrendPoint[]
  audience: ExercitoDigitalAudience
}

export function ExercitoDigitalTrendChart({ points, audience }: ExercitoDigitalTrendChartProps) {
  const redeLabel =
    audience === 'unificado' ? 'Base eleitoral' : audience === 'mandatos' ? 'Mandatários' : 'Liderados'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length === 0) return

    chartRef.current?.destroy()
    chartRef.current = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: redeLabel,
            data: points.map((p) => p.pctLiderados),
            backgroundColor: '#185FA5',
            borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'stack',
          },
          {
            label: 'Orgânicos',
            data: points.map((p) => p.pctOrganicos),
            backgroundColor: '#E8E6DF',
            borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
            borderSkipped: false,
            stack: 'stack',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#134E82',
            titleFont: { size: 11 },
            bodyFont: { size: 11 },
            callbacks: {
              label: (ctx) => {
                const v = typeof ctx.parsed.y === 'number' ? ctx.parsed.y : 0
                return `${ctx.dataset.label}: ${v.toFixed(1)}%`
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 10, weight: 500 },
              color: '#888780',
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
            },
          },
          y: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: {
              font: { size: 10 },
              color: '#888780',
              callback: (v) => `${v}%`,
            },
            grid: { color: 'rgba(136,135,128,0.12)' },
            border: { display: false },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [points, redeLabel])

  if (points.length === 0) {
    return (
      <div className={cn(exercitoSectionCardClass)}>
        <h2 className={exercitoSectionTitleClass}>Evolução por publicação</h2>
        <p className="mt-4 text-[11px] text-text-muted">Sincronize comentários para ver a tendência por publicação.</p>
      </div>
    )
  }

  return (
    <div className={cn(exercitoSectionCardClass)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={exercitoSectionTitleClass}>Evolução por publicação</h2>
          <p className={cn(exercitoSectionSubtitleClass, 'mb-0')}>
            % {redeLabel.toLowerCase()} vs. orgânicos em cada post
          </p>
        </div>
        <span className="text-[10px] font-medium text-text-muted">{points.length} publicações</span>
      </div>
      <div className="relative h-[200px] w-full rounded-lg border border-[rgb(var(--color-border-tertiary)/0.5)] bg-bg-app px-1 pt-1">
        <canvas
          ref={canvasRef}
          id="exercito-trend-chart"
          role="img"
          aria-label={`Gráfico de barras empilhadas: percentual de comentários ${redeLabel.toLowerCase()} versus orgânicos por data de publicação`}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[10px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-[rgb(var(--color-primary))]" aria-hidden />
          {redeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px] bg-[#E8E6DF]" aria-hidden />
          Orgânicos
        </span>
      </div>
    </div>
  )
}
