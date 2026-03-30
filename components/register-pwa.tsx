'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker em produção para habilitar instalação PWA (atalho na tela inicial).
 * Em desenvolvimento fica desligado para evitar cache estranho com o hot reload.
 */
export function RegisterPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // silencioso: rede / política pode bloquear
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
