'use client'

import { useMemo } from 'react'
import { SIDEBAR_MENU_ITEMS, type SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'
import { filterItemsForDashboardKanban } from '@/lib/dashboard-kanban-filter'
import { pageKeyForSidebarItem } from '@/lib/sidebar-page-key'
import { usePermissions } from '@/hooks/use-permissions'

function filterVisibleSidebarItems(
  permLoading: boolean,
  canAccess: (page: string) => boolean,
  isAdmin: boolean
): SidebarMenuItemConfig[] {
  if (permLoading) return SIDEBAR_MENU_ITEMS

  return SIDEBAR_MENU_ITEMS.map((item) => {
    if (!item.children) return item
    const children = item.children.filter((child) => canAccess(pageKeyForSidebarItem(child.id)))
    return { ...item, children }
  }).filter((item) => {
    if (item.id === 'home') return false
    if (item.id === 'usuarios') return isAdmin
    if (item.id === 'log-system') return isAdmin
    if (item.id === 'ficha-atendimento') {
      return canAccess('ficha-atendimento') || canAccess('territorio')
    }
    if (item.id === 'territorio') {
      return canAccess('territorio') || canAccess('campo') || canAccess('agenda')
    }
    if (item.id === 'resumo-operacional') {
      return (
        canAccess('resumo-operacional') ||
        canAccess('campo') ||
        canAccess('operacao') ||
        canAccess('mobilizacao') ||
        canAccess('conteudo')
      )
    }
    if (item.children) return item.children.length > 0
    return canAccess(pageKeyForSidebarItem(item.id))
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
