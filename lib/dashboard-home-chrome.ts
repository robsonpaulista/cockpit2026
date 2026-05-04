/** Rota exata da home do dashboard (sem subpaths). */
export function isDashboardHomePath(pathname: string): boolean {
  const n = (pathname || '').replace(/\/$/, '') || '/dashboard'
  return n === '/dashboard'
}

export const DASHBOARD_HOME_ACCENT_GRADIENT =
  'linear-gradient(145deg, rgb(var(--accent-gold)) 0%, rgb(var(--accent-gold)) 40%, rgb(var(--accent-gold-dark)) 100%)'
