/**
 * Rotas que usam o shell visual premium da War Room / Copiloto
 * (`body[data-war-room-clean]`, Lucide na sidebar, tipografia Inter).
 */
export function isWarRoomCleanRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const path = pathname.replace(/\/$/, '') || '/'
  return (
    path.startsWith('/dashboard/war-room') ||
    path.startsWith('/dashboard/noticias/monitoramento') ||
    path === '/dashboard/pesquisa' ||
    path === '/dashboard/conteudo/redes' ||
    path === '/dashboard/territorio'
  )
}
