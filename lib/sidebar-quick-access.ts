import {
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  resumoEleicoesHubHref,
} from '@/lib/resumo-eleicoes-hub-route'

export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon: 'Activity' | 'Calendar' | 'ClipboardList'
  pageKey: string
}

/** Ordem alfabética por rótulo (pt-BR). */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-agenda',
    label: 'Agenda',
    href: '/dashboard/agenda',
    icon: 'Calendar',
    pageKey: 'agenda',
  },
  {
    id: 'quick-atendimentos',
    label: 'Atendimentos',
    href: resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_ATENDIMENTO),
    icon: 'ClipboardList',
    pageKey: 'resumo-eleicoes',
  },
  {
    id: 'quick-termometro',
    label: 'Termômetro',
    href: '/dashboard/war-room',
    icon: 'Activity',
    pageKey: 'war-room',
  },
]

export function isSidebarQuickAccessActive(
  item: SidebarQuickAccessItem,
  pathname: string,
  search: string,
): boolean {
  switch (item.id) {
    case 'quick-agenda':
      return pathname.startsWith('/dashboard/agenda')
    case 'quick-atendimentos': {
      if (!pathname.startsWith('/dashboard/resumo-eleicoes')) return false
      const tab = new URLSearchParams(search).get('tab')
      return !tab || tab === RESUMO_ELEICOES_TAB_ATENDIMENTO
    }
    case 'quick-termometro':
      return pathname.startsWith('/dashboard/war-room')
    default:
      return pathname === item.href
  }
}
