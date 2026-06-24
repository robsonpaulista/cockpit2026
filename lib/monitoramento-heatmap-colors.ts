import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'

export type HeatmapScaleMode = 'individual' | 'comparative'

const EMPTY_CELL = '#EEF1F5'
/** Cor padrão do modo comparativo — alinhada à marca (sidebar / abas). */
const COMPARATIVE_BASE = SIDEBAR_BRAND_AMBER

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace('#', '')
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    }
  }
  if (raw.length !== 6) return null
  const n = parseInt(raw, 16)
  if (Number.isNaN(n)) return null
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mixRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number
): string {
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

/** Intensidade normalizada por scaleMax (linha ou global). */
export function heatmapCellColor(
  baseHex: string,
  value: number,
  scaleMax: number,
  mode: HeatmapScaleMode = 'individual'
): string {
  if (value <= 0) return EMPTY_CELL
  const colorHex = mode === 'comparative' ? COMPARATIVE_BASE : baseHex
  const base = parseHex(colorHex)
  if (!base) return EMPTY_CELL
  const empty = parseHex(EMPTY_CELL)!
  const t = scaleMax > 0 ? Math.min(1, value / scaleMax) : 1
  const intensity = 0.22 + t * 0.78
  return mixRgb(empty, base, intensity)
}

export function heatmapRowMax(values: number[]): number {
  return values.reduce((max, v) => (v > max ? v : max), 0)
}

export function heatmapGlobalMax(rows: number[][]): number {
  let max = 0
  for (const values of rows) {
    for (const value of values) {
      if (value > max) max = value
    }
  }
  return max
}

export function heatmapLegendBaseColor(mode: HeatmapScaleMode): string {
  return mode === 'comparative' ? COMPARATIVE_BASE : '#374151'
}
