export type HeatmapScaleMode = 'individual' | 'comparative'

const EMPTY_CELL = '#EDEDED'
/** Cor padrão do modo comparativo — paleta IPT (#f04b23). */
const COMPARATIVE_BASE = '#f04b23'
const TEXT_ON_LIGHT = '#20201f'
const TEXT_ON_DARK = '#ffffff'

type Rgb = { r: number; g: number; b: number }

function parseHex(hex: string): Rgb | null {
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

function parseCssColor(color: string): Rgb | null {
  const trimmed = color.trim()
  const hex = parseHex(trimmed)
  if (hex) return hex
  const m = trimmed.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/i,
  )
  if (!m) return null
  return {
    r: Math.round(Number(m[1])),
    g: Math.round(Number(m[2])),
    b: Math.round(Number(m[3])),
  }
}

function mixRgb(a: Rgb, b: Rgb, t: number): string {
  const r = Math.round(a.r + (b.r - a.r) * t)
  const g = Math.round(a.g + (b.g - a.g) * t)
  const bl = Math.round(a.b + (b.b - a.b) * t)
  return `rgb(${r}, ${g}, ${bl})`
}

function mixRgbValues(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

/** Luminância relativa WCAG (0–1). */
export function relativeLuminance(rgb: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

/**
 * Texto claro/escuro conforme o fundo real da célula.
 * Threshold ~0.4 favorece leitura de números pequenos sobre cinza médio.
 */
export function contrastingTextColor(
  background: string,
): typeof TEXT_ON_DARK | typeof TEXT_ON_LIGHT {
  const rgb = parseCssColor(background)
  if (!rgb) return TEXT_ON_LIGHT
  return relativeLuminance(rgb) < 0.4 ? TEXT_ON_DARK : TEXT_ON_LIGHT
}

function heatmapCellIntensity(value: number, scaleMax: number): number {
  if (value <= 0 || scaleMax <= 0) return 0
  const t = Math.min(1, value / scaleMax)
  return 0.22 + t * 0.78
}

/** Intensidade normalizada por scaleMax (linha ou global). */
export function heatmapCellColor(
  baseHex: string,
  value: number,
  scaleMax: number,
  mode: HeatmapScaleMode = 'individual',
  /** Sobrescreve a base do modo comparativo (ex.: azul WR no Copiloto). */
  comparativeBase: string = COMPARATIVE_BASE,
): string {
  if (value <= 0) return EMPTY_CELL
  const colorHex = mode === 'comparative' ? comparativeBase : baseHex
  const base = parseHex(colorHex)
  if (!base) return EMPTY_CELL
  const empty = parseHex(EMPTY_CELL)!
  const intensity = heatmapCellIntensity(value, scaleMax)
  return mixRgb(empty, base, intensity)
}

/** Cor do número na célula — lê a luminância do mesmo fundo do heatmap. */
export function heatmapCellTextColor(
  baseHex: string,
  value: number,
  scaleMax: number,
  mode: HeatmapScaleMode = 'individual',
  comparativeBase: string = COMPARATIVE_BASE,
): typeof TEXT_ON_DARK | typeof TEXT_ON_LIGHT {
  if (value <= 0) return TEXT_ON_LIGHT
  const bg = heatmapCellColor(baseHex, value, scaleMax, mode, comparativeBase)
  return contrastingTextColor(bg)
}

/** Mix estável em RGB (útil fora do CSS color-mix). */
export function mixHexColors(fromHex: string, toHex: string, t: number): string {
  const from = parseHex(fromHex)
  const to = parseHex(toHex)
  if (!from || !to) return fromHex
  const clamped = Math.max(0, Math.min(1, t))
  const mixed = mixRgbValues(from, to, clamped)
  return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`
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

export function heatmapLegendBaseColor(
  mode: HeatmapScaleMode,
  comparativeBase: string = COMPARATIVE_BASE,
): string {
  return mode === 'comparative' ? comparativeBase : '#374151'
}
