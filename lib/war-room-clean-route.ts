/**
 * Shell visual premium clean (`body[data-war-room-clean]`): tipografia/tema
 * compartilhado em todo o `/dashboard`.
 */
export function isWarRoomCleanRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

/** Página do Termômetro / War Room (não confundir com o tema clean global). */
export function isWarRoomPage(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/dashboard/war-room' || path.startsWith('/dashboard/war-room/')
}
