/** Rota exata da home do dashboard (sem subpaths). */
export function isDashboardHomePath(pathname: string): boolean {
  const n = (pathname || '').replace(/\/$/, '') || '/dashboard'
  return n === '/dashboard'
}

import { JARVIS_CSS_VARS } from '@/lib/jarvis-hud-tokens'

/** Fundo da home — alinhado ao token `--color-void` do HUD Jarvis. */
export const DASHBOARD_HOME_BG = JARVIS_CSS_VARS.void

/** @deprecated use DASHBOARD_HOME_BG — mantido para o style do layout */
export const DASHBOARD_HOME_ACCENT_GRADIENT = DASHBOARD_HOME_BG
