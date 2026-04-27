'use client'

import { useSyncExternalStore } from 'react'
import { useSidebar } from '@/contexts/sidebar-context'

const LG_MEDIA = '(min-width: 1024px)'

function getIsLargeViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(LG_MEDIA).matches
}

/**
 * Topbar do dashboard visível quando a navegação lateral está “retraída”:
 * - Desktop (lg+): sidebar recolhida (`collapsed`)
 * - Mobile: drawer fechado (`!mobileOpen`), pois a sidebar não está à vista
 */
export function useDashboardTopbarVisible(): boolean {
  const { collapsed, mobileOpen } = useSidebar()

  const isLg = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia(LG_MEDIA)
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    getIsLargeViewport,
    () => false
  )

  return isLg ? collapsed : !mobileOpen
}
