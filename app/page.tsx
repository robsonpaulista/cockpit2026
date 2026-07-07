'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SplashScreen } from '@/components/splash-screen'

type HomePhase = 'checking' | 'splash'

export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<HomePhase>('checking')

  useEffect(() => {
    let active = true

    // Timeout de segurança: se a verificação travar, mostra a splash mesmo assim
    const timeout = setTimeout(() => {
      if (active) setPhase('splash')
    }, 5000)

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return
        clearTimeout(timeout)
        const user = session?.user || null
        if (error) {
          console.error('Erro ao verificar autenticação:', error)
          setPhase('splash')
          return
        }
        if (user) {
          // Já autenticado → direto para o dashboard (sem splash)
          router.replace('/dashboard')
        } else {
          // Não autenticado → splash como tela pré-login
          setPhase('splash')
        }
      })
      .catch((error) => {
        if (!active) return
        clearTimeout(timeout)
        console.error('Erro ao verificar autenticação:', error)
        setPhase('splash')
      })

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [router, supabase])

  const handleEnter = useCallback(() => {
    router.replace('/login')
  }, [router])

  if (phase === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
          <p className="text-sm text-secondary">Carregando...</p>
        </div>
      </div>
    )
  }

  // Splash pré-login: o botão "Entrar no Cockpit" chama a tela de login.
  // Sem interação por 2 min na cena final, a animação reinicia (fica mais viva).
  return <SplashScreen onComplete={handleEnter} autoEnter={false} idleLoopMs={120000} />
}
