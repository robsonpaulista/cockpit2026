'use client'

import { SplashScreen } from '@/components/splash-screen/splash-screen'
import { useIdleSplash } from '@/contexts/idle-splash-context'

/**
 * Tela de descanso por inatividade — mesma splash cinematográfica
 * usada no botão "Tela de descanso" da sidebar.
 */
export function IdleSplashOverlay() {
  const { ativo, dispensar } = useIdleSplash()

  if (!ativo) return null

  return <SplashScreen onComplete={dispensar} autoEnter={false} idleLoopMs={120000} />
}

/** @deprecated use IdleSplashOverlay dentro do layout do dashboard */
export function IdleSplash() {
  return <IdleSplashOverlay />
}
