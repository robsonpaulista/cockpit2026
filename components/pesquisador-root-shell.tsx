'use client'

import { useEffect } from 'react'

export function PesquisadorRootShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw-pesquisador.js', { scope: '/pesquisador/' })
      .catch(() => {
        /* PWA opcional */
      })
  }, [])

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {children}
    </div>
  )
}
