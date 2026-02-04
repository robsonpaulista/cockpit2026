'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useNavigationLoading } from '@/contexts/navigation-loading-context'

const MIN_VISIBLE_MS = 280

export function NavigationLoadingBar() {
  const pathname = usePathname()
  const { navigating, setNavigating } = useNavigationLoading()
  const prevPathnameRef = useRef(pathname)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pathname === prevPathnameRef.current) return
    prevPathnameRef.current = pathname

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    const elapsed = 0
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)
    hideTimeoutRef.current = setTimeout(() => {
      setNavigating(false)
      hideTimeoutRef.current = null
    }, remaining)
  }, [pathname, setNavigating])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  if (!navigating) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-accent-gold/90 overflow-hidden"
      role="progressbar"
      aria-label="Carregando página"
    >
      <div className="h-full w-1/3 bg-white/80 navigation-loading-shimmer" />
    </div>
  )
}
