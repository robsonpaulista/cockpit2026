'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Outfit } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'
import { PreviewHomeScreen } from '@/components/preview-home/preview-home-screen'
import '@/app/dashboard/war-room/war-room-fonts.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-preview-home',
})

type HomePhase = 'checking' | 'guest'

/**
 * Entrada pública: home cinematográfica (Entrar abre o login flutuante).
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0b0d]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#f2d06b]" />
          <p className="text-sm text-white/60">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={outfit.variable}
      style={{ fontFamily: 'var(--font-preview-home), Outfit, sans-serif' }}
    >
      <PreviewHomeScreen />
    </div>
  )
}
