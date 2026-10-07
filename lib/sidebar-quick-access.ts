import { AGENDA_HREF, ATENDIMENTO_HREF } from '@/lib/resumo-eleicoes-hub-route'

const RESULTADO_2026_HREF = '/dashboard/resumo-eleicoes/resultado-2026'

export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon: 'Activity' | 'Calendar' | 'ClipboardList' | 'Vote'
  pageKey: string
}

/** Resultado 2026 fixo no topo; os demais em ordem alfabética por rótulo (pt-BR). */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-resultado-2026',
    label: 'Resultado 2026',
    href: RESULTADO_2026_HREF,
    icon: 'Vote',
    pageKey: 'resumo-eleicoes',
  },
  {
    id: 'quick-agenda',
    label: 'Agenda',
    href: AGENDA_HREF,
    icon: 'Calendar',
    pageKey: 'agenda',
  },
  {
    id: 'quick-atendimentos',
    label: 'Atendimentos',
    href: ATENDIMENTO_HREF,
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

export function isSidebarQuickAccessActive(item: SidebarQuickAccessItem, pathname: string): boolean {
  switch (item.id) {
    case 'quick-agenda':
      return pathname.startsWith(AGENDA_HREF)
    case 'quick-termometro':
      return pathname.startsWith('/dashboard/war-room')
    default:
      return pathname === item.href
  }
}
