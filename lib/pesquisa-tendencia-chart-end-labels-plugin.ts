import type { Chart, Plugin } from 'chart.js'
import { legendDisplayName } from '@/lib/pesquisa-tendencia-chart-config'

export type EndLineLabelItem = {
  y: number
  name: string
  value: number | null
  color: string
  bold: boolean
}

function lastPointIndex(data: readonly (number | null | undefined)[]): number {
  for (let i = data.length - 1; i >= 0; i -= 1) {
    const v = data[i]
    if (v !== null && v !== undefined && Number.isFinite(Number(v))) return i
  }
  return -1
}

/** Evita sobreposição vertical mantendo labels dentro da área do gráfico. */
export function resolveEndLineLabelPositions(
  items: EndLineLabelItem[],
  chartArea: { top: number; bottom: number },
  minGap = 15
): EndLineLabelItem[] {
  if (items.length === 0) return items

  const sorted = [...items].sort((a, b) => a.y - b.y)

  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].y - sorted[i - 1].y < minGap) {
      sorted[i].y = sorted[i - 1].y + minGap
    }
  }

  const overflow = sorted[sorted.length - 1].y - (chartArea.bottom - 6)
  if (overflow > 0) {
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      sorted[i].y -= overflow
    }
  }

  const underflow = chartArea.top + 6 - sorted[0].y
  if (underflow > 0) {
    for (let i = 0; i < sorted.length; i += 1) {
      sorted[i].y += underflow
    }
  }

  return sorted
}

export function computeEndLabelRightPadding(candidatos: readonly string[]): number {
  const maxChars = Math.max(
    ...candidatos.map((nome) => legendDisplayName(nome).length),
    10
  )
  return Math.min(220, Math.max(108, Math.round(maxChars * 6.8)))
}

export function createPesquisaEndLineLabelsPlugin(options: {
  isHidden: (datasetIndex: number, label: string) => boolean
  isBold: (label: string) => boolean
}): Plugin<'line'> {
  return {
    id: 'pesquisaEndLineLabels',
    afterDatasetsDraw(chart: Chart<'line'>) {
      const { ctx, chartArea } = chart
      if (!chartArea) return

      const raw: EndLineLabelItem[] = []

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const label = String(dataset.label ?? '')
        if (!label || options.isHidden(datasetIndex, label)) return

        const meta = chart.getDatasetMeta(datasetIndex)
        if (meta.hidden || !chart.isDatasetVisible(datasetIndex)) return

        const data = dataset.data as (number | null | undefined)[]
        const idx = lastPointIndex(data)
        if (idx < 0) return

        const point = meta.data[idx]
        if (!point || point.x == null || point.y == null) return

        const value = data[idx] ?? null
        raw.push({
          y: point.y,
          name: legendDisplayName(label),
          value: typeof value === 'number' ? value : null,
          color: String(dataset.borderColor ?? '#888780'),
          bold: options.isBold(label),
        })
      })

      const labels = resolveEndLineLabelPositions(raw, chartArea)
      const x = chartArea.right + 10

      ctx.save()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'

      for (const item of labels) {
        ctx.font = item.bold
          ? '600 11.5px system-ui, -apple-system, sans-serif'
          : '500 11px system-ui, -apple-system, sans-serif'
        ctx.fillStyle = item.color
        ctx.fillText(item.name, x, item.y)

        if (item.value !== null) {
          const nameWidth = ctx.measureText(item.name).width
          ctx.font = '500 10px system-ui, -apple-system, sans-serif'
          ctx.fillStyle = '#888780'
          const valueText = `${item.value.toFixed(1).replace('.', ',')}%`
          ctx.fillText(valueText, x + nameWidth + 6, item.y)
        }
      }

      ctx.restore()
    },
  }
}
