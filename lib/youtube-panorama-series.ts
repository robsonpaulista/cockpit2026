import type { PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'
import { panoramaWindowLabel } from '@/lib/monitoramento-panorama-window'

export type YoutubePanoramaViewMode = 'volume' | 'movimento'

export type YoutubePanoramaChartRow = { date: string } & Record<string, number | string>

export function youtubePanoramaPeaksBySlug(chart: PanoramaPlatformChart): Map<string, number> {
  const peaks = new Map<string, number>()
  for (const line of chart.lines) {
    let peak = 0
    for (const row of chart.chartData) {
      peak = Math.max(peak, Number(row[line.slug] ?? 0))
    }
    peaks.set(line.slug, peak)
  }
  return peaks
}

/** Views absolutas por dia — dataset de Volume. */
export function buildYoutubeAbsoluteSeries(chart: PanoramaPlatformChart): YoutubePanoramaChartRow[] {
  return chart.chartData.map((row) => ({ ...row }))
}

export type YoutubePanoramaHeatmapRow = {
  slug: string
  name: string
  color: string
  values: number[]
  normalizedValues: number[]
  peak: number
}

/** Linhas do heatmap de Movimento: views absolutas + intensidade normalizada (0–1) por pico individual. */
export function buildYoutubeMovimentoHeatmap(chart: PanoramaPlatformChart): {
  dates: string[]
  rows: YoutubePanoramaHeatmapRow[]
} {
  const dates = chart.chartData.map((row) => row.date)
  const peaks = youtubePanoramaPeaksBySlug(chart)

  const rows = chart.lines.map((line) => {
    const values = chart.chartData.map((row) => Number(row[line.slug] ?? 0))
    const peak = peaks.get(line.slug) ?? 0
    const normalizedValues = values.map((value) => (peak > 0 ? value / peak : 0))
    return {
      slug: line.slug,
      name: line.name,
      color: line.color,
      values,
      normalizedValues,
      peak,
    }
  })

  return { dates, rows }
}

export function youtubePanoramaSubtitle(mode: YoutubePanoramaViewMode): string {
  if (mode === 'volume') {
    return `Visualizações por dia de publicação · ${panoramaWindowLabel()}`
  }
  return `Mapa de calor — movimento por candidato e dia · normalizado pelo pico individual · ${panoramaWindowLabel()}`
}
