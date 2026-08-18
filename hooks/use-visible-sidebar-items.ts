'use client'

import { useMemo } from 'react'
import { SIDEBAR_MENU_ITEMS, type SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'
import { filterItemsForDashboardKanban } from '@/lib/dashboard-kanban-filter'
import { isSidebarMenuItemHidden, isSidebarChildMenuItemHidden } from '@/lib/sidebar-hidden-items'
import { canAccessSidebarItem } from '@/lib/page-access'
import { usePermissions } from '@/hooks/use-permissions'

function filterVisibleSidebarItems(
  permLoading: boolean,
  canAccess: (page: string) => boolean,
  isAdmin: boolean
): SidebarMenuItemConfig[] {
  if (permLoading) return []

  return SIDEBAR_MENU_ITEMS.map((item) => {
    if (!item.children) return item
    const children = item.children.filter(
      (child) =>
        canAccessSidebarItem(canAccess, child.id) && !isSidebarChildMenuItemHidden(child.id),
    )
    return { ...item, children }
  }).filter((item) => {
    if (isSidebarMenuItemHidden(item.id)) return false
    if (item.id === 'usuarios') return isAdmin
    if (item.id === 'backup') return isAdmin
    if (item.id === 'log-system') return isAdmin
    if (item.id === 'ficha-atendimento') {
      return canAccess('ficha-atendimento')
    }
    if (item.id === 'territorio') {
      return canAccessSidebarItem(canAccess, 'territorio')
    }
    if (item.id === 'resumo-operacional') {
      return canAccess('resumo-operacional')
    }
    if (item.children) return item.children.length > 0
    return canAccessSidebarItem(canAccess, item.id)
  })
}

export function useVisibleSidebarItems(): {
  items: SidebarMenuItemConfig[]
  loading: boolean
} {
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()

  const items = useMemo(
    () => filterVisibleSidebarItems(permLoading, canAccess, isAdmin),
    [canAccess, isAdmin, permLoading]
  )

  return { items, loading: permLoading }
}

export function useVisibleKanbanItems(): {
  items: SidebarMenuItemConfig[]
  loading: boolean
} {
  const { items, loading } = useVisibleSidebarItems()

  const kanbanItems = useMemo(() => filterItemsForDashboardKanban(items), [items])

  return { items: kanbanItems, loading }
}
