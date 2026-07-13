'use client'

import { useCallback, useEffect, useState } from 'react'
import { SplashScreen } from '@/components/splash-screen/splash-screen'
import { useIdleSplash } from '@/contexts/idle-splash-context'
import { SPLASH_PREVIEW_EVENT } from '@/lib/splash-screen-config'

/**
 * Única host da splash cinematográfica no dashboard:
 * - botão "Tela de descanso" (evento)
 * - inatividade / lock de sessão (idle ativo)
 *
 * Em ambos os casos o "Entrar no Cockpit" só fecha o overlay.
 */
export function SplashScreenRestHost() {
  const [visible, setVisible] = useState(false)
  const { ativo: idleAtivo, dispensar: dispensarIdle } = useIdleSplash()

  useEffect(() => {
    const abrir = () => setVisible(true)
    window.addEventListener(SPLASH_PREVIEW_EVENT, abrir)
    return () => window.removeEventListener(SPLASH_PREVIEW_EVENT, abrir)
  }, [])

  // Idle / restore de sessão → mesma splash do botão de descanso.
  useEffect(() => {
    if (idleAtivo) setVisible(true)
  }, [idleAtivo])

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

  if (!visible) return null

  return <SplashScreen onComplete={fechar} autoEnter={false} idleLoopMs={120000} />
}
