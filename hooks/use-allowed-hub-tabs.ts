'use client'

import { useEffect, useMemo } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import { canAccessTab } from '@/lib/page-access'

export function useAllowedHubTabs<T extends { id: string }>(
  pageKey: string,
  tabs: readonly T[],
  activeTab: T['id'],
  onTabChange: (tabId: T['id']) => void,
): T[] {
  const { canAccess, isAdmin, loading } = usePermissions()

  const allowed = useMemo(() => {
    if (loading) return []
    if (isAdmin) return [...tabs]
    return tabs.filter((tab) => canAccessTab(canAccess, pageKey, tab.id))
  }, [canAccess, isAdmin, loading, pageKey, tabs])

  const firstAllowedId = allowed[0]?.id
  const activeAllowed = allowed.some((tab) => tab.id === activeTab)

  useEffect(() => {
    if (loading || !firstAllowedId || activeAllowed) return
    onTabChange(firstAllowedId)
  }, [activeAllowed, firstAllowedId, loading, onTabChange])

  return allowed
}
