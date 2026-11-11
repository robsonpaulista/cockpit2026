/** Rota exata da home do dashboard (sem subpaths). */
export function isDashboardHomePath(pathname: string): boolean {
  const n = (pathname || '').replace(/\/$/, '') || '/dashboard'
  return n === '/dashboard'
}

/** War Room / Copiloto — sidebar glass gelo. A home (/dashboard) usa o chrome TSE padrão. */
export function isIceGlassSidebarPath(pathname: string): boolean {
  const n = (pathname || '').replace(/\/$/, '') || '/dashboard'
  return n === '/dashboard/war-room' || n.startsWith('/dashboard/war-room/')
}

export {
  DASHBOARD_HOME_SHELL_CLASS,
  dashboardHomeShellStyle,
  REST_SCREEN_AMBER,
  REST_SCREEN_AMBER_DARK,
  REST_SCREEN_GRADIENT,
  REST_SCREEN_RADIAL_GLOW,
} from '@/lib/rest-screen-chrome'
