'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Verificar se já está autenticado ao carregar a página
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        router.replace('/dashboard')
      }
    }

    checkAuth()
  }, [router, supabase])

  return (
    <>
      <style jsx global>{`
        /* Fundo laranja na página de login (evita flash branco) */
        html, body {
          background: #de5a12 !important;
        }
        /* Placeholders brancos nos inputs de login */
        input::placeholder {
          color: rgba(255, 255, 255, 0.45) !important;
        }
      `}</style>
      <LoginForm />
    </>
  )
}
