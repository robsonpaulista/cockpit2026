'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Rota legada — redireciona sem animação (splash pós-login removida). */
export default function SplashRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const authRedirect = localStorage.getItem('auth_redirect')
    if (authRedirect === 'pesquisador') {
      router.replace('/pesquisador')
      return
    }
    if (authRedirect === 'dashboard') {
      router.replace('/dashboard')
      return
    }
    router.replace('/login')
  }, [router])

  return null
}
