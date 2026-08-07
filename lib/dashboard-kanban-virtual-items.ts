import type { SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'

/** Cards só do kanban da home — não entram na sidebar. */
export const DASHBOARD_KANBAN_VIRTUAL_ITEMS: Record<string, SidebarMenuItemConfig> = {
  'jarvis-assistant': {
    id: 'jarvis-assistant',
    label: 'IA Cockpit',
    icon: 'Bot',
    href: '/dashboard',
  },
  'radar-eleitoral': {
    id: 'radar-eleitoral',
    label: 'Radar Eleitoral',
    icon: 'Radar',
    href: '/dashboard/noticias/monitoramento',
  },
}

export function resolveKanbanMenuItem(
  id: string,
  itemsById: Map<string, SidebarMenuItemConfig>
): SidebarMenuItemConfig | undefined {
  return itemsById.get(id) ?? DASHBOARD_KANBAN_VIRTUAL_ITEMS[id]
}
