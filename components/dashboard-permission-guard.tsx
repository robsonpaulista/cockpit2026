'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'

const PAGE_KEYS = new Set([
  'dashboard', 'fases', 'narrativas', 'campo', 'agenda', 'territorio',
  'chapas', 'conteudo', 'noticias', 'mobilizacao', 'whatsapp', 'pesquisa',
  'operacao', 'juridico', 'obras', 'usuarios',
])

function getPageKey(pathname: string): string | null {
  if (!pathname?.startsWith('/dashboard')) return null
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard'
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/')
  const first = segments[0]
  return first && PAGE_KEYS.has(first) ? first : null
}

export function DashboardPermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { canAccess, isAdmin, loading } = usePermissions()

  useEffect(() => {
    if (loading) return
    const key = pathname ? getPageKey(pathname) : null
    if (!key || key === 'dashboard') return

    if (key === 'usuarios') {
      if (!isAdmin) router.replace('/dashboard')
      return
    }
    if (!isAdmin && !canAccess(key)) router.replace('/dashboard')
  }, [pathname, loading, isAdmin, canAccess, router])

  return <>{children}</>
}
