/** Janela única do panorama (alinhada ao heatmap Google News). */
export const PANORAMA_WINDOW_DAYS = 30

export function panoramaWindowCutoffDate(): Date {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - PANORAMA_WINDOW_DAYS)
  return d
}

export function panoramaWindowCutoffIso(): string {
  return panoramaWindowCutoffDate().toISOString()
}

export function panoramaWindowCutoffDay(): string {
  return panoramaWindowCutoffDate().toISOString().slice(0, 10)
}

export function panoramaWindowLabel(): string {
  return `últimos ${PANORAMA_WINDOW_DAYS} dias`
}

export function panoramaWindowSubtitleSuffix(): string {
  return ` · ${panoramaWindowLabel()}`
}
