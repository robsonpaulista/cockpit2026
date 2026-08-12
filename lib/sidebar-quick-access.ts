export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon: 'FileSpreadsheet' | 'ScrollText'
  pageKey: string
}

/** Ordem alfabética por rótulo (pt-BR). */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-emendas',
    label: 'Emendas',
    href: '/dashboard/emendas',
    icon: 'FileSpreadsheet',
    pageKey: 'emendas',
  },
  {
    id: 'quick-proposicoes',
    label: 'Proposições',
    href: '/dashboard/proposicoes',
    icon: 'ScrollText',
    pageKey: 'proposicoes',
  },
]

export function isSidebarQuickAccessActive(
  item: SidebarQuickAccessItem,
  pathname: string,
  search: string,
): boolean {
  void search

  switch (item.id) {
    case 'quick-emendas':
      return pathname.startsWith('/dashboard/emendas')
    case 'quick-proposicoes':
      return pathname.startsWith('/dashboard/proposicoes')
    default:
      return pathname === item.href
  }
}
