import { TERRITORIO_CAMPO_TAB_BASE, territorioCampoHref } from '@/lib/territorio-campo-route'

export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon:
    | 'MapPin'
    | 'BarChart3'
    | 'FolderOpen'
    | 'FileSpreadsheet'
    | 'ScrollText'
  pageKey: string
}

/** Ordem alfabética por rótulo (pt-BR). */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-arquivos',
    label: 'Arquivos',
    href: '/dashboard/arquivos',
    icon: 'FolderOpen',
    pageKey: 'arquivos',
  },
  {
    id: 'quick-base-eleitoral',
    label: 'Base Eleitoral',
    href: territorioCampoHref(TERRITORIO_CAMPO_TAB_BASE),
    icon: 'MapPin',
    pageKey: 'territorio',
  },
  {
    id: 'quick-emendas',
    label: 'Emendas',
    href: '/dashboard/emendas',
    icon: 'FileSpreadsheet',
    pageKey: 'emendas',
  },
  {
    id: 'quick-pesquisas-opiniao',
    label: 'Pesquisas de Opinião',
    href: '/dashboard/pesquisa',
    icon: 'BarChart3',
    pageKey: 'pesquisa',
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
  const params = new URLSearchParams(search)

  switch (item.id) {
    case 'quick-base-eleitoral':
      return pathname.startsWith('/dashboard/territorio') && params.get('tab') === TERRITORIO_CAMPO_TAB_BASE
    case 'quick-pesquisas-opiniao':
      return pathname.startsWith('/dashboard/pesquisa')
    case 'quick-arquivos':
      return pathname.startsWith('/dashboard/arquivos')
    case 'quick-emendas':
      return pathname.startsWith('/dashboard/emendas')
    case 'quick-proposicoes':
      return pathname.startsWith('/dashboard/proposicoes')
    default:
      return pathname === item.href
  }
}
