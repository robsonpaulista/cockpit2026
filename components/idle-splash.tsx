'use client'

import { PreviewHomeScreen } from '@/components/preview-home/preview-home-screen'
import { useIdleSplash } from '@/contexts/idle-splash-context'

/**
 * Tela de descanso por inatividade — mesma home preview
 * usada no botão "Tela de descanso" da sidebar.
 */
export function IdleSplashOverlay() {
  const { ativo, dispensar } = useIdleSplash()

  if (!ativo) return null

  return <PreviewHomeScreen mode="rest" onEnter={dispensar} />
}

/** @deprecated use IdleSplashOverlay dentro do layout do dashboard */
export function IdleSplash() {
  return <IdleSplashOverlay />
}
