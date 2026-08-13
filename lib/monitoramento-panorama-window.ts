/** Janela padrão do panorama (Radar Eleitoral / heatmap Google News). */
export const PANORAMA_WINDOW_DAYS = 30

const PANORAMA_ALLOWED_DAYS = new Set([7, 14, 28, 30, 60])

export function parsePanoramaWindowDays(raw: string | null | undefined): number {
  const n = Number(raw)
  if (Number.isFinite(n) && PANORAMA_ALLOWED_DAYS.has(n)) return n
  return PANORAMA_WINDOW_DAYS
}

export function panoramaWindowCutoffDate(days: number = PANORAMA_WINDOW_DAYS): Date {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

export function panoramaWindowCutoffIso(days: number = PANORAMA_WINDOW_DAYS): string {
  return panoramaWindowCutoffDate(days).toISOString()
}

export function panoramaWindowCutoffDay(days: number = PANORAMA_WINDOW_DAYS): string {
  return panoramaWindowCutoffDate(days).toISOString().slice(0, 10)
}

export function panoramaWindowLabel(days: number = PANORAMA_WINDOW_DAYS): string {
  return `últimos ${days} dias`
}

export function panoramaWindowSubtitleSuffix(days: number = PANORAMA_WINDOW_DAYS): string {
  return ` · ${panoramaWindowLabel(days)}`
}
