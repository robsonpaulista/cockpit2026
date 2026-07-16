'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'

const PAGE_KEYS = new Set([
  'dashboard', 'fases', 'narrativas', 'campo', 'agenda', 'territorio', 'ipt',
  'ficha-atendimento', 'chapas', 'conteudo', 'noticias', 'mobilizacao', 'whatsapp',
  'pesquisa', 'operacao', 'juridico', 'obras', 'usuarios', 'log_system', 'gestao_pesquisas',
  'emendas', 'proposicoes', 'sei-pesquisa', 'resumo-operacional', 'resumo-eleicoes', 'arquivos',
])

function canAccessPageKey(
  key: string,
  canAccess: (pageKey: string) => boolean,
): boolean {
  if (key === 'ficha-atendimento') {
    return canAccess('ficha-atendimento') || canAccess('territorio')
  }
  if (key === 'ipt') {
    return (
      canAccess('ipt') ||
      canAccess('territorio') ||
      canAccess('campo') ||
      canAccess('agenda')
    )
  }
  if (key === 'territorio' || key === 'campo' || key === 'agenda') {
    return canAccess('territorio') || canAccess('campo') || canAccess('agenda')
  }
  if (key === 'resumo-operacional') {
    return (
      canAccess('resumo-operacional') ||
      canAccess('campo') ||
      canAccess('operacao') ||
      canAccess('mobilizacao') ||
      canAccess('conteudo')
    )
  }
  return canAccess(key)
}

function getPageKey(pathname: string): string | null {
  if (!pathname?.startsWith('/dashboard')) return null
  if (pathname === '/dashboard' || pathname === '/dashboard/') return 'dashboard'
  if (pathname.startsWith('/dashboard/gestao-pesquisas')) return 'gestao_pesquisas'
  if (pathname.startsWith('/dashboard/log-system')) return 'log_system'
  // Diagnóstico IPT: chave própria (antes caía em `territorio` e não aparecia no modal).
  if (pathname.startsWith('/dashboard/territorio/ipt')) return 'ipt'
  // A página de Emendas usa a chave própria 'emendas' (mesma que a sidebar usa
  // em `pageKeyForItem`). Anteriormente esta rota era tratada como 'juridico',
  // o que fazia o guard redirecionar para /dashboard quando o usuário tinha
  // apenas 'emendas' liberado nas permissões.
  if (pathname.startsWith('/dashboard/emendas')) return 'emendas'
  if (pathname.startsWith('/dashboard/ficha-atendimento')) return 'ficha-atendimento'
  if (pathname.startsWith('/dashboard/resumo-eleicoes')) return 'resumo-eleicoes'
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
    if (key === 'log_system') {
      if (!isAdmin) router.replace('/dashboard')
      return
    }
    if (!isAdmin && !canAccessPageKey(key, canAccess)) router.replace('/dashboard')
  }, [pathname, loading, isAdmin, canAccess, router])

  return <>{children}</>
}
