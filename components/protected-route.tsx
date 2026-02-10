'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { preWarmUserIdCache } from '@/lib/chapasService'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string[]
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hasAuthRedirect, setHasAuthRedirect] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Verificar localStorage apenas no cliente após montar
  useEffect(() => {
    setMounted(true)
    const authRedirect = localStorage.getItem('auth_redirect')
    if (authRedirect === 'dashboard') {
      setHasAuthRedirect(true)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Verificar se há flag de redirecionamento após login
    const authRedirect = localStorage.getItem('auth_redirect')
    
    // Se não está carregando e não há usuário E não há flag de login, redirecionar
    if (!loading && !user && !authRedirect) {
      // Aguardar um pouco antes de redirecionar (evita redirecionar muito rápido)
      const timeout = setTimeout(() => {
        // Verificar novamente antes de redirecionar
        if (!user) {
          router.replace('/login')
        }
      }, 2000)
      return () => clearTimeout(timeout)
    }

    // Se há flag de login, limpar após um tempo
    if (authRedirect === 'dashboard') {
      const timeout = setTimeout(() => {
        localStorage.removeItem('auth_redirect')
        setHasAuthRedirect(false)
      }, 5000)
      return () => clearTimeout(timeout)
    }

    // Pré-aquecer cache do userId para evitar roundtrip de auth em chamadas Supabase
    if (user?.id) {
      preWarmUserIdCache(user.id)
    }

    // Verificar permissões de role se necessário
    if (user && requiredRole && user.profile) {
      const hasRole = requiredRole.includes(user.profile.role)
      if (!hasRole) {
        router.replace('/dashboard')
      }
    }
  }, [user, loading, router, requiredRole, mounted])

  // Durante a hidratação inicial, mostrar loading para evitar diferença servidor/cliente
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
          <p className="text-sm text-secondary">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se há flag de redirecionamento após login, permitir carregar imediatamente
  // Isso evita a tela de "Redirecionando..." e permite que o dashboard carregue
  if (hasAuthRedirect) {
    return <>{children}</>
  }

  // Se está carregando, mostrar loading apenas se não houver usuário
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
          <p className="text-sm text-secondary">Carregando...</p>
        </div>
      </div>
    )
  }

  // Se há usuário, mostrar conteúdo
  if (user) {
    return <>{children}</>
  }

  // Se não há usuário e não está carregando, mostrar conteúdo mesmo assim
  // O useEffect vai cuidar do redirecionamento se necessário
  return <>{children}</>
}

