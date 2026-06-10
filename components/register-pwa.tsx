'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker em produção para habilitar instalação PWA (atalho na tela inicial).
 * Em desenvolvimento fica desligado para evitar cache estranho com o hot reload.
 */
export function RegisterPwa() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      // SW de sessões anteriores (prod em localhost) pode servir HTML/chunks velhos.
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister())
      })
      return
    }

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
