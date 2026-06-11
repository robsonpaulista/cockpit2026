'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'cockpit:chunk-reload-attempt'

function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false
  const msg =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : String(reason)
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|_next\/undefined|_next\/static|layout\.css|\.css\?v=/i.test(
    msg,
  )
}

function isNextStaticAsset(url: string): boolean {
  return /\/_next\/static\//i.test(url)
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
      const target = event.target
      if (target instanceof HTMLElement) {
        const href =
          target instanceof HTMLLinkElement
            ? target.href
            : target instanceof HTMLScriptElement
              ? target.src
              : ''
        if (href && isNextStaticAsset(href)) {
          tryReloadOnce(new Error(`Failed to load ${href}`))
          return
        }
      }
      tryReloadOnce(event.error ?? event.message)
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      tryReloadOnce(event.reason)
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
