'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { pingSessionPresence } from '@/lib/services/auth-sessions'

const INTERVAL_MS = 2 * 60 * 1000

export function useSessionPresence() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const ping = async () => {
      if (cancelled || document.visibilityState === 'hidden') return
      try {
        const result = await pingSessionPresence(pathname || '/dashboard')
        if (cancelled || result !== 'expired') return
        const supabase = createClient()
        await supabase.auth.signOut()
        window.location.replace('/')
      } catch {
        // pulso falhou — tenta de novo no próximo intervalo
      }
    }

    void ping()
    const timer = window.setInterval(() => {
      void ping()
    }, INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void ping()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [pathname])
}
