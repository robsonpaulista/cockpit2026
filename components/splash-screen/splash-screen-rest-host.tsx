'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { CockpitHome } from '@/components/home/cockpit-home'
import { useIdleSplash } from '@/contexts/idle-splash-context'
import { SPLASH_PREVIEW_EVENT } from '@/lib/splash-screen-config'

function isRestScreenDisabled(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname === '/dashboard/resumo-eleicoes' ||
    pathname.startsWith('/dashboard/resumo-eleicoes/')
  )
}

/**
 * Host da tela de descanso no dashboard (home amarela Cockpit X):
 * - botão "Tela de descanso" (evento), em qualquer página do dashboard
 * - inatividade / lock de sessão (idle ativo)
 *
 * Em ambos os casos "Entrar" só fecha o overlay.
 * Em /dashboard/resumo-eleicoes a inatividade não abre a home; o botão abre.
 */
export function SplashScreenRestHost() {
  const pathname = usePathname()
  const restDisabled = isRestScreenDisabled(pathname)
  const [abertoPeloBotao, setAbertoPeloBotao] = useState<boolean>(false)
  const { ativo: idleAtivo, dispensar: dispensarIdle } = useIdleSplash()
  const visivel = abertoPeloBotao || (!restDisabled && idleAtivo)

  useEffect(() => {
    const abrir = () => setAbertoPeloBotao(true)
    window.addEventListener(SPLASH_PREVIEW_EVENT, abrir)
    return () => window.removeEventListener(SPLASH_PREVIEW_EVENT, abrir)
  }, [])

  useEffect(() => {
    if (!visivel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbertoPeloBotao(false)
        if (idleAtivo) dispensarIdle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visivel, idleAtivo, dispensarIdle])

  const fechar = useCallback(() => {
    setAbertoPeloBotao(false)
    if (idleAtivo) dispensarIdle()
  }, [idleAtivo, dispensarIdle])

  if (!visivel) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto" role="dialog" aria-modal aria-label="Tela de descanso">
      <CockpitHome onEntrar={fechar} />
    </div>,
    document.body,
  )
}
