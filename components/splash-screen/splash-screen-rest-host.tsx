'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Outfit } from 'next/font/google'
import { PreviewHomeScreen } from '@/components/preview-home/preview-home-screen'
import { useIdleSplash } from '@/contexts/idle-splash-context'
import { SPLASH_PREVIEW_EVENT } from '@/lib/splash-screen-config'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-preview-home',
})

function isRestScreenDisabled(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname === '/dashboard/resumo-eleicoes' ||
    pathname.startsWith('/dashboard/resumo-eleicoes/')
  )
}

/**
 * Host da tela de descanso no dashboard (nova home preview):
 * - botão "Tela de descanso" (evento)
 * - inatividade / lock de sessão (idle ativo)
 *
 * Em ambos os casos "Entrar no Cockpit" só fecha o overlay.
 * Em /dashboard/resumo-eleicoes a splash nunca abre.
 */
export function SplashScreenRestHost() {
  const pathname = usePathname()
  const restDisabled = isRestScreenDisabled(pathname)
  const [visible, setVisible] = useState(false)
  const { ativo: idleAtivo, dispensar: dispensarIdle } = useIdleSplash()

  useEffect(() => {
    if (restDisabled) {
      setVisible(false)
      return
    }
    const abrir = () => setVisible(true)
    window.addEventListener(SPLASH_PREVIEW_EVENT, abrir)
    return () => window.removeEventListener(SPLASH_PREVIEW_EVENT, abrir)
  }, [restDisabled])

  useEffect(() => {
    if (restDisabled) {
      setVisible(false)
      return
    }
    if (idleAtivo) setVisible(true)
  }, [idleAtivo, restDisabled])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVisible(false)
        if (idleAtivo) dispensarIdle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, idleAtivo, dispensarIdle])

  const fechar = useCallback(() => {
    setVisible(false)
    if (idleAtivo) dispensarIdle()
  }, [idleAtivo, dispensarIdle])

  if (restDisabled || !visible) return null

  return (
    <div className={outfit.variable}>
      <PreviewHomeScreen mode="rest" onEnter={fechar} />
    </div>
  )
}
