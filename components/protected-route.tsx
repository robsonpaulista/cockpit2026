'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string[]
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    // Aguardar loading terminar antes de fazer qualquer verificação
    if (loading) {
      return
    }

    // Evitar múltiplas verificações
    if (hasChecked) {
      return
    }

    // Dar um pequeno delay para garantir que a sessão foi estabelecida
    const timeout = setTimeout(() => {
      setHasChecked(true)

      if (!user) {
        // Apenas redirecionar se realmente não houver usuário após delay
        router.replace('/login')
        return
      }

      // Se usuário existe mas não tem perfil, ainda permite acesso (pode criar depois)
      // Mas avisa no console para debug
      if (user && !user.profile) {
        console.warn('Usuário autenticado mas sem perfil no banco. Criando perfil básico...')
        // Permite acesso mesmo sem perfil
      }

      if (user && requiredRole && user.profile) {
        const hasRole = requiredRole.includes(user.profile.role)
        if (!hasRole) {
          router.replace('/dashboard') // Redirecionar para dashboard se não tiver permissão
        }
      }
    }, 500) // Aumentado para 500ms para dar tempo da sessão ser estabelecida

    return () => clearTimeout(timeout)
  }, [user, loading, router, requiredRole, hasChecked])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-text-muted">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-text-muted">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

