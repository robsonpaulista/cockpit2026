'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Timeout de segurança para evitar loading infinito
    const timeout = setTimeout(() => {
      setLoading(false)
      router.replace('/login')
    }, 5000)

    // Verificar se usuário está autenticado
    supabase.auth.getUser()
      .then(({ data: { user }, error }) => {
        clearTimeout(timeout)
        setLoading(false)
        if (error) {
          console.error('Erro ao verificar autenticação:', error)
          router.replace('/login')
          return
        }
        if (user) {
          // Redirecionar para dashboard se autenticado
          router.replace('/dashboard')
        } else {
          // Redirecionar para login se não autenticado
          router.replace('/login')
        }
      })
      .catch((error) => {
        clearTimeout(timeout)
        setLoading(false)
        console.error('Erro ao verificar autenticação:', error)
        router.replace('/login')
      })
  }, [router, supabase])

  // Mostrar loading enquanto verifica autenticação
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

  return null
}
