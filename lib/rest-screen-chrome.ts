/** Âmbar da marca alinhado à paleta IPT (#ff9800). */
export const REST_SCREEN_AMBER = '#ff9800'
export const REST_SCREEN_AMBER_DARK = '#e28000'
export const REST_SCREEN_AMBER_RGB = '255, 152, 0'
export const REST_SCREEN_AMBER_DARK_RGB = '226, 128, 0'

export const REST_SCREEN_GRADIENT = `linear-gradient(145deg, ${REST_SCREEN_AMBER} 0%, ${REST_SCREEN_AMBER} 40%, ${REST_SCREEN_AMBER_DARK} 100%)`

export const REST_SCREEN_RADIAL_GLOW =
  'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 50%)'

/** Shell da home — laranja sólido (sem faixas do gradiente/radial). */
export const dashboardHomeShellStyle = {
  background: REST_SCREEN_AMBER,
} as const

export const DASHBOARD_HOME_SHELL_CLASS = 'relative'

/** Classe CSS (globals) — fundo laranja do topbar em viewports menores que lg. */
export const dashboardMobilePageHeaderClass = 'dashboard-mobile-page-header'
