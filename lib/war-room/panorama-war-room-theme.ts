import type { PanoramaModel } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'

/** Candidato próprio — charcoal da paleta premium WR. */
export const WR_PANORAMA_OWN_COLOR = '#20201F'

/** Base do heatmap “Todos” — cinza médio (sem azul institucional). */
export const WR_PANORAMA_HEATMAP_COMPARATIVE = '#686865'

/**
 * Demais atores — escala de cinza (Linear/Notion), do carvão ao cinza claro.
 * Sem petróleo/azul/âmbar.
 */
const WR_COMPETITOR_COLORS = [
  '#3F3F3C',
  '#52524F',
  '#686865',
  '#7A7A76',
  '#8E8E8A',
  '#969692',
  '#A8A8A4',
  '#B8B8B4',
]

function paintSlug(colorBySlug: Map<string, string>, slug: string, fallback: string): string {
  return colorBySlug.get(slug) ?? fallback
}

function remapChart(
  chart: PanoramaPlatformChart,
  colorBySlug: Map<string, string>
): PanoramaPlatformChart {
  return {
    ...chart,
    lines: chart.lines.map((line) => ({
      ...line,
      color: paintSlug(colorBySlug, line.slug, line.color),
    })),
    heatmapRows: chart.heatmapRows?.map((row) => ({
      ...row,
      color: paintSlug(colorBySlug, row.slug, row.color),
    })),
    instagramTable: chart.instagramTable?.map((row) => ({
      ...row,
      color: paintSlug(colorBySlug, row.slug, row.color),
    })),
    periodTotals: chart.periodTotals?.map((row) => ({
      ...row,
      color: paintSlug(colorBySlug, row.slug, row.color),
    })),
    searchContexts: chart.searchContexts?.map((row) => ({
      ...row,
      color: paintSlug(colorBySlug, row.slug, row.color),
    })),
  }
}

/**
 * Remapeia accent/série do Panorama (Radar = coral/âmbar) para cinzas WR.
 * Necessário porque strokes/fills SVG usam hex inline — CSS sozinho não cobre.
 */
export function remapPanoramaForWarRoom(panorama: PanoramaModel): PanoramaModel {
  let competitorIdx = 0
  const colorBySlug = new Map<string, string>()

  for (const col of panorama.columns) {
    const color =
      col.actorType === 'own_candidate'
        ? WR_PANORAMA_OWN_COLOR
        : WR_COMPETITOR_COLORS[competitorIdx++ % WR_COMPETITOR_COLORS.length]
    colorBySlug.set(col.slug, color)
  }

  return {
    ...panorama,
    columns: panorama.columns.map((col) => ({
      ...col,
      accentColor: paintSlug(colorBySlug, col.slug, col.accentColor),
    })),
    charts: panorama.charts.map((chart) => remapChart(chart, colorBySlug)),
  }
}
