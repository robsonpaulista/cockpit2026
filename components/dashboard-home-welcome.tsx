'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { cn } from '@/lib/utils'
import {
  REST_SCREEN_GRADIENT,
  REST_SCREEN_PETROL,
  REST_SCREEN_AMBER,
  REST_SCREEN_PETROL_MUTED,
  REST_SCREEN_RADIAL_GLOW,
} from '@/lib/rest-screen-chrome'
import { APP_BRAND_TAGLINE, brandWordmarkClass } from '@/lib/sidebar-brand-styles'

const SLOGAN = APP_BRAND_TAGLINE

const CICLO_MS = {
  mostrarC: 200,
  mostrarNome: 1600,
  mostrarSlogan: 3400,
  fadeOut: 6800,
  reinicio: 8000,
} as const

type Fase = 'inicio' | 'c' | 'nome' | 'slogan'

/**
 * Conteúdo visual da home / splash de boas-vindas:
 * fundo branco, tipografia petróleo + coral (#2026).
 */
interface DashboardHomeWelcomeProps {
  /** hero = tela cheia central; compact = coluna ao lado do Jarvis na Visão geral */
  variant?: 'hero' | 'compact'
}

export function DashboardHomeWelcome({ variant = 'hero' }: DashboardHomeWelcomeProps) {
  const isCompact = variant === 'compact'
  const isGradientHome = useDashboardHomeChrome()
  const [fase, setFase] = useState<Fase>('inicio')
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const limparTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  useEffect(() => {
    let cancelado = false

    const iniciarCiclo = () => {
      if (cancelado) return
      setFase('inicio')

      const t1 = setTimeout(() => {
        if (!cancelado) setFase('c')
      }, CICLO_MS.mostrarC)
      const t2 = setTimeout(() => {
        if (!cancelado) setFase('nome')
      }, CICLO_MS.mostrarNome)
      const t3 = setTimeout(() => {
        if (!cancelado) setFase('slogan')
      }, CICLO_MS.mostrarSlogan)
      const t4 = setTimeout(() => {
        if (!cancelado) setFase('inicio')
      }, CICLO_MS.fadeOut)
      const t5 = setTimeout(() => {
        if (!cancelado) iniciarCiclo()
      }, CICLO_MS.reinicio)

      timersRef.current = [t1, t2, t3, t4, t5]
    }

    iniciarCiclo()
    return () => {
      cancelado = true
      limparTimers()
    }
  }, [limparTimers])

  const titleClass = cn(
    brandWordmarkClass,
    'transition-[opacity,transform] duration-700',
    isCompact ? 'text-[2.5rem] sm:text-[3.5rem]' : 'text-[3.25rem] sm:text-[5.5rem]',
  )

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center px-4',
        isCompact
          ? 'min-h-0 flex-1 py-4 sm:py-6'
          : 'h-full min-h-0 flex-1',
      )}
    >
      <div
        className={cn(
          'relative mx-auto flex w-full max-w-3xl flex-col items-center justify-center text-center',
          isCompact ? 'px-4 py-8 sm:px-6 sm:py-10' : 'px-6 py-4 sm:px-10',
          isGradientHome
            ? 'overflow-visible'
            : 'overflow-hidden rounded-3xl border border-[rgb(var(--color-border-tertiary)/0.85)] shadow-card',
        )}
        style={
          isGradientHome
            ? undefined
            : {
                background: REST_SCREEN_GRADIENT,
              }
        }
      >
        {!isGradientHome ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: REST_SCREEN_RADIAL_GLOW }}
          />
        ) : null}

        <div
          className="relative z-[1] mb-7 flex items-baseline justify-center gap-0"
          aria-label="Cockpit 2026"
        >
          <span
            className={titleClass}
            style={{
              color: REST_SCREEN_PETROL,
              opacity: fase !== 'inicio' ? 1 : 0,
              transform:
                fase !== 'inicio' ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-15deg)',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            C
          </span>
          <span
            className={cn(
              titleClass,
              'transition-[opacity,transform,letter-spacing] duration-700',
            )}
            style={{
              color: REST_SCREEN_PETROL,
              opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
              transform:
                fase === 'nome' || fase === 'slogan' ? 'translateX(0)' : 'translateX(-20px)',
              letterSpacing: fase === 'nome' || fase === 'slogan' ? '-0.01em' : '0.3em',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            OCKPIT
          </span>
          <span
            className={cn(
              brandWordmarkClass,
              'ml-2 self-end pb-1 text-[1.1rem] font-medium transition-[opacity,transform] duration-700 sm:ml-3 sm:pb-2 sm:text-[2rem]',
            )}
            style={{
              color: REST_SCREEN_AMBER,
              opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
              transform: fase === 'nome' || fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
              transitionDelay: '0.3s',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            2026
          </span>
        </div>

        <div
          className={cn(
            'relative z-[1] mb-5 h-0.5 w-14 rounded-full',
            isGradientHome
              ? 'transition-opacity duration-700'
              : 'transition-[opacity,transform] duration-700',
          )}
          style={
            isGradientHome
              ? { background: REST_SCREEN_AMBER, opacity: fase === 'slogan' ? 0.55 : 0 }
              : {
                  background: REST_SCREEN_AMBER,
                  opacity: fase === 'slogan' ? 0.55 : 0,
                  transform: fase === 'slogan' ? 'scaleX(1)' : 'scaleX(0)',
                }
          }
        />

        <p
          className="relative z-[1] max-w-xl text-center font-sans text-[0.7rem] font-medium uppercase tracking-[0.12em] transition-[opacity,transform] duration-700 sm:text-[1.05rem] sm:tracking-[0.15em]"
          style={{
            color: REST_SCREEN_PETROL,
            opacity: fase === 'slogan' ? 1 : 0,
            transform: fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
          }}
        >
          {SLOGAN}
        </p>

        <p
          className={cn(
            'relative z-[1] max-w-md text-center text-xs leading-relaxed sm:text-sm',
            isCompact ? 'mt-6' : 'mt-10',
          )}
          style={{
            color: REST_SCREEN_PETROL_MUTED,
            opacity: fase === 'slogan' ? 1 : 0,
            transition: 'opacity 1s ease 0.4s',
          }}
        >
          {isCompact
            ? 'Fale com a IA Cockpit ao lado — pesquisas, território, agenda e alertas em linguagem natural. O menu lateral leva aos módulos.'
            : 'Use o menu lateral ou o acesso rápido para abrir os módulos do sistema.'}
        </p>
      </div>
    </div>
  )
}
