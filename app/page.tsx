'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CockpitHome } from '@/components/home/cockpit-home'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'

type HomePhase = 'checking' | 'guest'

/**
 * Entrada pública: home amarela do Cockpit X (Entrar abre o cartão de login).
 * Se já autenticado → `/dashboard`.
 */
export default function HomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [phase, setPhase] = useState<HomePhase>('checking')

  useEffect(() => {
    let active = true

    const timeout = setTimeout(() => {
      if (active) setPhase('guest')
    }, 5000)

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!active) return
        clearTimeout(timeout)
        if (error) {
          console.error('Erro ao verificar autenticação:', error)
          setPhase('guest')
          return
        }
        if (session?.user) {
          router.replace('/dashboard')
          return
        }
        setPhase('guest')
      })
      .catch((error) => {
        if (!active) return
        clearTimeout(timeout)
        console.error('Erro ao verificar autenticação:', error)
        setPhase('guest')
      })

    return () => {
      active = false
      clearTimeout(timeout)
    }
  }, [router, supabase])

  if (phase === 'checking') {
    return <div className="min-h-screen bg-[var(--tse-yellow)]" style={TSE_TOKENS} aria-busy="true" />
  }

  return <CockpitHome />
}
