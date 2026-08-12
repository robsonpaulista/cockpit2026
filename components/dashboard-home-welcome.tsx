'use client'

import { useEffect, useState } from 'react'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { cn } from '@/lib/utils'
import {
  HOME_SCENE_CAR,
  HOME_SCENE_PETROL,
  REST_SCREEN_PETROL_MUTED,
} from '@/lib/rest-screen-chrome'
import { APP_BRAND_TAGLINE, brandWordmarkClass } from '@/lib/sidebar-brand-styles'

const SLOGAN = APP_BRAND_TAGLINE

/**
 * Home pós-login — painel glass legível sobre a cena do vídeo.
 * Entrada única (sem loop que some o conteúdo).
 */
interface DashboardHomeWelcomeProps {
  variant?: 'hero' | 'compact'
}

export function DashboardHomeWelcome({ variant = 'hero' }: DashboardHomeWelcomeProps) {
  const isCompact = variant === 'compact'
  const isGradientHome = useDashboardHomeChrome()
  const useGlass = isGradientHome && !isCompact
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setReady(true)
      return
    }
    const t = window.setTimeout(() => setReady(true), 80)
    return () => window.clearTimeout(t)
  }, [])

  const wordColor = HOME_SCENE_PETROL
  const yearColor = HOME_SCENE_CAR
  const sloganColor = useGlass ? 'rgba(2,43,58,0.72)' : HOME_SCENE_PETROL
  const leadColor = useGlass ? 'rgba(2,43,58,0.58)' : REST_SCREEN_PETROL_MUTED

  return (
    <div
      className={cn(
        'home-glass-welcome relative flex w-full flex-col items-center justify-center',
        isCompact ? 'min-h-0 flex-1 px-4 py-4 sm:py-6' : 'h-full min-h-0 flex-1 p-0',
      )}
    >
      <div
        className={cn(
          'relative z-[1] flex w-full flex-col items-center justify-center text-center',
          useGlass
            ? cn(
                'home-glass-panel home-glass-panel--fullscreen h-full min-h-0 w-full px-6 py-10 sm:px-10 sm:py-12',
                ready ? 'home-glass-panel--ready' : 'home-glass-panel--enter',
              )
            : cn(
                'mx-auto max-w-3xl overflow-hidden rounded-3xl border border-[rgb(var(--color-border-tertiary)/0.85)] px-6 py-4 shadow-card sm:px-10',
                isCompact && 'px-4 py-8 sm:px-6 sm:py-10',
              ),
        )}
      >
        <div
          className="relative z-[1] mb-5 flex flex-wrap items-baseline justify-center gap-x-2"
          aria-label="Cockpit 2026"
        >
          <span
            className={cn(brandWordmarkClass, 'home-glass-brand')}
            style={{ color: wordColor }}
          >
            COCKPIT
          </span>
          <span
            className={cn(brandWordmarkClass, 'home-glass-year')}
            style={{ color: yearColor }}
          >
            2026
          </span>
        </div>

        <div
          className="relative z-[1] mb-5 h-0.5 w-14 rounded-full"
          style={{ background: HOME_SCENE_CAR, opacity: 0.85 }}
        />

        <p
          className="home-glass-slogan relative z-[1] max-w-xl text-center font-sans font-medium uppercase"
          style={{ color: sloganColor }}
        >
          {SLOGAN}
        </p>

        <p
          className={cn(
            'home-glass-lead relative z-[1] max-w-sm text-center leading-relaxed',
            isCompact ? 'mt-6' : 'mt-6',
          )}
          style={{ color: leadColor }}
        >
          {isCompact
            ? 'Fale com a IA Cockpit ao lado — pesquisas, território, agenda e alertas em linguagem natural. O menu lateral leva aos módulos.'
            : 'Use o menu lateral ou o acesso rápido para abrir os módulos do sistema.'}
        </p>
      </div>
    </div>
  )
}
