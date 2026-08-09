'use client'

import { useEffect } from 'react'
import { Outfit } from 'next/font/google'

/** Fallback geométrico enquanto Lufga .woff2 não estiver em /public/fonts/lufga */
export const wrOutfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-wr-fallback',
  display: 'swap',
})

/**
 * Expõe --font-wr-fallback no <html> só enquanto a War Room está montada,
 * para body[data-war-room-clean] resolver a stack tipográfica.
 */
export function WarRoomFontBootstrap() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add(wrOutfit.variable)
    return () => {
      root.classList.remove(wrOutfit.variable)
    }
  }, [])

  return null
}
