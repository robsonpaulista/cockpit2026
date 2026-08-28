/** Accent coral da marca (paleta Copiloto) — UI legado /login página. */
export const REST_SCREEN_AMBER = '#f04b23'
export const REST_SCREEN_AMBER_DARK = '#c43d1c'
export const REST_SCREEN_AMBER_RGB = '240, 75, 35'
export const REST_SCREEN_AMBER_DARK_RGB = '196, 61, 28'
export const REST_SCREEN_PETROL = '#022b3a'
export const REST_SCREEN_PETROL_MUTED = '#6b7280'

/** Cena home pré/pós-login — paleta gelo + amarelo logo + preto. */
export const HOME_SCENE_CAR = '#f2d06b'
export const HOME_SCENE_CAR_HOVER = '#e0bc4f'
export const HOME_SCENE_PETROL = '#2b2d31'
export const HOME_SCENE_ICE = '#e5e6e8'
export const HOME_SCENE_GREY_SOFT = '#b3b6bb'
export const HOME_SCENE_GREY = '#70737a'
export const HOME_SCENE_VIDEO = '/videocarronovo.mp4'
/** Fallback se metadata ainda não carregou (home-scene-backdrop usa duração real do vídeo). */
export const HOME_SCENE_VIDEO_END_SEC = 8.3

/** Painel glass gelo/branco — home e superfícies sobre a cena. */
export const homeGlassPanelStyle = {
  background: 'rgba(229, 230, 232, 0.72)',
  backdropFilter: 'blur(32px) saturate(140%)',
  WebkitBackdropFilter: 'blur(32px) saturate(140%)',
  border: '1px solid rgba(255, 255, 255, 0.9)',
  boxShadow:
    '0 1px 0 rgba(255,255,255,0.9) inset, 0 22px 48px rgba(43,45,49,0.1)',
  borderRadius: '18px',
} as const

/** @deprecated use HOME_SCENE / glass — mantido p/ imports legados */
export const REST_SCREEN_GRADIENT = HOME_SCENE_PETROL

export const REST_SCREEN_RADIAL_GLOW =
  'radial-gradient(circle at 50% 42%, rgba(240, 192, 0, 0.12) 0%, transparent 55%)'

/** Shell da home pós-login — branco sólido. */
export const dashboardHomeShellStyle = {
  background: '#ffffff',
} as const

export const DASHBOARD_HOME_SHELL_CLASS = 'relative'

/** Classe CSS (globals) — fundo accent do topbar em viewports menores que lg. */
export const dashboardMobilePageHeaderClass = 'dashboard-mobile-page-header'
