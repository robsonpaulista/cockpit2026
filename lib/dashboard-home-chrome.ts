/** Rota exata da home do dashboard (sem subpaths). */
export function isDashboardHomePath(pathname: string): boolean {
  const n = (pathname || '').replace(/\/$/, '') || '/dashboard'
  return n === '/dashboard'
}

import { jarvisHudStyle, JARVIS_CSS_VARS } from '@/lib/jarvis-hud-tokens'

/** Fundo base da home — token `--color-void` do HUD Jarvis. */
export const DASHBOARD_HOME_BG = JARVIS_CSS_VARS.void

/** Classe compartilhada: gradiente + grid neural do HUD em toda a shell da home. */
export const DASHBOARD_HOME_SHELL_CLASS = 'jarvis-hud-grid-bg'

/** Variáveis CSS do HUD aplicadas na shell da home (sidebar + kanban + Jarvis). */
export const dashboardHomeShellStyle = jarvisHudStyle

/** @deprecated use DASHBOARD_HOME_SHELL_CLASS + dashboardHomeShellStyle */
export const DASHBOARD_HOME_ACCENT_GRADIENT = DASHBOARD_HOME_BG
