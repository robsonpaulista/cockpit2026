'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'

/** Pesquisadores não utilizam o Cockpit — só a app de campo. */
export function DashboardPesquisadorRedirect() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user?.profile?.role === 'pesquisadores') {
      router.replace('/pesquisador')
    }
  }, [user, loading, router])

  return null
}
