/** Âmbar da marca (sidebar / CTAs) — independente de `--accent-gold` do tema republicanos. */
export const REST_SCREEN_AMBER = '#C8900A'
export const REST_SCREEN_AMBER_DARK = '#A87308'
export const REST_SCREEN_AMBER_RGB = '200, 144, 10'
export const REST_SCREEN_AMBER_DARK_RGB = '168, 115, 8'

export const REST_SCREEN_GRADIENT = `linear-gradient(145deg, ${REST_SCREEN_AMBER} 0%, ${REST_SCREEN_AMBER} 40%, ${REST_SCREEN_AMBER_DARK} 100%)`

export const REST_SCREEN_RADIAL_GLOW =
  'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 50%)'

/** Shell da home — âmbar sólido (sem faixas do gradiente/radial). */
export const dashboardHomeShellStyle = {
  background: REST_SCREEN_AMBER,
} as const

export const DASHBOARD_HOME_SHELL_CLASS = 'relative'
