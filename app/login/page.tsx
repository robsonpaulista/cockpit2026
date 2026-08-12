'use client'

import { useEffect } from 'react'
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

/**
 * Rota legada `/login` — mesma home cinematográfica, com o formulário já aberto.
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

  return (
    <div
      className={outfit.variable}
      style={{ fontFamily: 'var(--font-preview-home), Outfit, sans-serif' }}
    >
      <PreviewHomeScreen initialLoginOpen />
    </div>
  )
}
