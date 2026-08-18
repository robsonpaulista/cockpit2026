'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { DASHBOARD_GUARD_PAGE_KEYS } from '@/lib/page-permissions-catalog'
import { canAccessDashboardPage } from '@/lib/page-access'

function getPageKey(pathname: string): string | null {
  if (!pathname?.startsWith('/dashboard')) return null
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard'
  if (pathname.startsWith('/dashboard/gestao-pesquisas')) return 'gestao_pesquisas'
  if (pathname.startsWith('/dashboard/log-system')) return 'log_system'
  if (pathname.startsWith('/dashboard/territorio/ipt')) return 'ipt'
  if (pathname.startsWith('/dashboard/cobertura')) return 'conteudo'
  if (pathname.startsWith('/dashboard/war-room')) return 'war-room'
  if (pathname.startsWith('/dashboard/material-campanha')) return 'material-campanha'
  if (pathname.startsWith('/dashboard/radar-224')) return 'noticias'
  if (pathname.startsWith('/dashboard/emendas')) return 'emendas'
  if (pathname.startsWith('/dashboard/ficha-atendimento')) return 'ficha-atendimento'
  if (pathname.startsWith('/dashboard/resumo-eleicoes')) return 'resumo-eleicoes'
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/')
  const first = segments[0]
  return first && DASHBOARD_GUARD_PAGE_KEYS.has(first) ? first : null
}

export function DashboardPermissionGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { canAccess, isAdmin, loading } = usePermissions()

  useEffect(() => {
    if (loading) return
    const key = pathname ? getPageKey(pathname) : null
    if (!key || key === 'dashboard') return

    if (key === 'usuarios' || key === 'backup' || key === 'log_system') {
      if (!isAdmin) router.replace('/dashboard')
      return
    }
    if (!isAdmin && !canAccessDashboardPage(canAccess, key, pathname ?? '')) {
      router.replace('/dashboard')
    }
  }, [pathname, loading, isAdmin, canAccess, router])

  return <>{children}</>
}
