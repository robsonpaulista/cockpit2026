'use client'

import { useCallback, useEffect, useState } from 'react'
import { SplashScreen } from '@/components/splash-screen/splash-screen'
import { SPLASH_PREVIEW_EVENT } from '@/lib/splash-screen-config'

/**
 * Renderiza a splash nova como "tela de descanso" quando acionada pela sidebar.
 * Diferente da entrada em `/`, aqui o "Entrar no Cockpit" apenas fecha o overlay
 * e devolve o usuário ao dashboard — sem redirecionar para o login.
 */
export function SplashScreenRestHost() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const abrir = () => setVisible(true)
    window.addEventListener(SPLASH_PREVIEW_EVENT, abrir)
    return () => window.removeEventListener(SPLASH_PREVIEW_EVENT, abrir)
  }, [])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const fechar = useCallback(() => setVisible(false), [])

  if (!visible) return null

  return <SplashScreen onComplete={fechar} autoEnter={false} idleLoopMs={120000} />
}
