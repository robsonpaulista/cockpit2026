import type { MenuItem } from '@/types'
import { canAccessDashboardPage, canAccessSidebarItem, type CanAccessFn } from '@/lib/page-access'
import { isSidebarChildMenuItemHidden, isSidebarMenuItemHidden } from '@/lib/sidebar-hidden-items'
import { SIDEBAR_MENU_ITEMS } from '@/lib/sidebar-nav-routes'
import { SIDEBAR_QUICK_ACCESS_ITEMS } from '@/lib/sidebar-quick-access'

const SOMENTE_ADMIN = new Set(['usuarios', 'backup', 'log-system'])
const CHAVE_DIRETA = new Set(['ficha-atendimento', 'resumo-operacional'])

const porRotulo = (a: MenuItem, b: MenuItem) =>
  a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })

/**
 * Primeira tela do menu que o usuário pode abrir, na ordem em que a sidebar aparece:
 * Acesso rápido primeiro, depois os itens do menu em ordem alfabética.
 */
export function rotaInicialDashboard(canAccess: CanAccessFn, isAdmin: boolean): string | null {
  for (const item of SIDEBAR_QUICK_ACCESS_ITEMS) {
    if (canAccessDashboardPage(canAccess, item.pageKey, item.href)) return item.href
  }

  const itens = SIDEBAR_MENU_ITEMS.filter((item) => !isSidebarMenuItemHidden(item.id)).sort(porRotulo)
  for (const item of itens) {
    if (SOMENTE_ADMIN.has(item.id)) {
      if (isAdmin) return item.href
      continue
    }
    if (item.children?.length) {
      const filho = item.children
        .filter((c) => !isSidebarChildMenuItemHidden(c.id) && canAccessSidebarItem(canAccess, c.id))
        .sort(porRotulo)[0]
      if (filho) return filho.href
      continue
    }
    const liberado = CHAVE_DIRETA.has(item.id)
      ? canAccess(item.id)
      : canAccessSidebarItem(canAccess, item.id)
    if (liberado) return item.href
  }

  return null
}
