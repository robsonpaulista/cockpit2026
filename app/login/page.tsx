'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CockpitHome } from '@/components/home/cockpit-home'

/**
 * Rota legada `/login` — mesma home pública, com o cartão de login já aberto.
 */
export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        router.replace('/dashboard')
      }
    }

    void checkAuth()
  }, [router, supabase])

  return <CockpitHome loginInicial />
}
