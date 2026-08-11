/**
 * Rotas com shell visual premium clean (War Room / Copiloto / Cidades):
 * `body[data-war-room-clean]`, Lucide na sidebar, tipografia Inter, topbar clean.
 * Todo o `/dashboard` compartilha o mesmo tema.
 */
export function isWarRoomCleanRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/dashboard' || path.startsWith('/dashboard/')
}
