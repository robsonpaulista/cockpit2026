/** Design tokens HUD JARVIS — Cockpit 2026 (sala de guerra futurista). */
export const JARVIS_CSS_VARS = {
  void: '#020B14',
  deep: '#051525',
  surface: '#0A2237',
  core: '#00D4FF',
  pulse: '#0066FF',
  alert: '#FF6B35',
  grid: 'rgba(0, 212, 255, 0.06)',
  textPrimary: '#E8F4FD',
  textDim: 'rgba(148, 195, 220, 0.6)',
  textCode: '#00D4FF',
  online: '#00FF88',
} as const

export const jarvisHudStyle: Record<string, string> = {
  ['--color-void' as string]: JARVIS_CSS_VARS.void,
  ['--color-deep' as string]: JARVIS_CSS_VARS.deep,
  ['--color-surface' as string]: JARVIS_CSS_VARS.surface,
  ['--color-core' as string]: JARVIS_CSS_VARS.core,
  ['--color-pulse' as string]: JARVIS_CSS_VARS.pulse,
  ['--color-alert' as string]: JARVIS_CSS_VARS.alert,
  ['--color-grid' as string]: JARVIS_CSS_VARS.grid,
  ['--color-text-primary' as string]: JARVIS_CSS_VARS.textPrimary,
  ['--color-text-dim' as string]: JARVIS_CSS_VARS.textDim,
  ['--color-text-code' as string]: JARVIS_CSS_VARS.textCode,
  ['--color-online' as string]: JARVIS_CSS_VARS.online,
}

/** @deprecated use JARVIS_CSS_VARS */
export const JARVIS = {
  bg: JARVIS_CSS_VARS.void,
  panel: JARVIS_CSS_VARS.deep,
  border: 'rgba(0, 212, 255, 0.22)',
  borderBright: 'rgba(0, 212, 255, 0.45)',
  cyan: JARVIS_CSS_VARS.core,
  cyanDim: '#0099CC',
  cyanGlow: '0 0 16px rgba(0, 102, 255, 0.35)',
  textGlow: 'none',
  green: JARVIS_CSS_VARS.online,
  greenGlow: '0 0 8px rgba(0, 255, 136, 0.5)',
  text: JARVIS_CSS_VARS.textPrimary,
  textMuted: JARVIS_CSS_VARS.textDim,
  log: JARVIS_CSS_VARS.textPrimary,
} as const

export const jarvisPanelClass =
  'jarvis-panel rounded bg-[var(--color-deep)] backdrop-blur-sm transition-[box-shadow] duration-200'

/** Painéis sem fundo — System Log */
export const jarvisPanelGhostClass = 'jarvis-panel'

export const jarvisLabelClass =
  'font-jarvis-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-dim)]'
