'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'cockpit:chunk-reload-attempt'

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false
  const msg =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : String(reason)
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|_next\/undefined|_next\/static/i.test(
    msg,
  )
}

/**
 * Em dev, HMR às vezes deixa referências a chunks antigos (404 em /_next/static).
 * Um reload automático (uma vez por sessão) evita precisar reiniciar o servidor manualmente.
 */
export function DevChunkRecovery() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const tryReloadOnce = (reason: unknown) => {
      if (!isChunkLoadError(reason)) return
      try {
        if (sessionStorage.getItem(RELOAD_KEY) === '1') return
        sessionStorage.setItem(RELOAD_KEY, '1')
      } catch {
        return
      }
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      tryReloadOnce(event.error ?? event.message)
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      tryReloadOnce(event.reason)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
