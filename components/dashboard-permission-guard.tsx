'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'

const PAGE_KEYS = new Set([
  'dashboard', 'fases', 'narrativas', 'campo', 'agenda', 'territorio',
  'ficha-atendimento', 'chapas', 'conteudo', 'noticias', 'mobilizacao', 'whatsapp',
  'pesquisa', 'operacao', 'juridico', 'obras', 'usuarios', 'gestao_pesquisas',
  'emendas', 'proposicoes', 'sei-pesquisa',
])

function canAccessPageKey(
  key: string,
  canAccess: (pageKey: string) => boolean,
): boolean {
  if (key === 'ficha-atendimento') {
    return canAccess('ficha-atendimento') || canAccess('territorio')
  }
  return canAccess(key)
}

function getPageKey(pathname: string): string | null {
  if (!pathname?.startsWith('/dashboard')) return null
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard'
  if (pathname.startsWith('/dashboard/gestao-pesquisas')) return 'gestao_pesquisas'
  // A página de Emendas usa a chave própria 'emendas' (mesma que a sidebar usa
  // em `pageKeyForItem`). Anteriormente esta rota era tratada como 'juridico',
  // o que fazia o guard redirecionar para /dashboard quando o usuário tinha
  // apenas 'emendas' liberado nas permissões.
  if (pathname.startsWith('/dashboard/emendas')) return 'emendas'
  if (pathname.startsWith('/dashboard/ficha-atendimento')) return 'ficha-atendimento'
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
    if (!isAdmin && !canAccessPageKey(key, canAccess)) router.replace('/dashboard')
  }, [pathname, loading, isAdmin, canAccess, router])

  return <>{children}</>
}
