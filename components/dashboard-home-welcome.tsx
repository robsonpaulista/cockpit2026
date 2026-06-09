'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { cn } from '@/lib/utils'

const SLOGAN = 'Comando Central de Eleições Dep Fed Jadyel Alencar'

const CICLO_MS = {
  mostrarC: 200,
  mostrarNome: 1600,
  mostrarSlogan: 3400,
  fadeOut: 6800,
  reinicio: 8000,
} as const

type Fase = 'inicio' | 'c' | 'nome' | 'slogan'

/**
 * Conteúdo visual equivalente à splash por inatividade (IdleSplash):
 * gradiente com variáveis de acento do tema, logótipo animado e slogan.
 * Respeita tema (agentes / republicanos) e aparência claro/escuro via CSS vars.
 */
interface DashboardHomeWelcomeProps {
  /** hero = tela cheia central; compact = coluna ao lado do Jarvis na Visão geral */
  variant?: 'hero' | 'compact'
}

export function DashboardHomeWelcome({ variant = 'hero' }: DashboardHomeWelcomeProps) {
  const isCompact = variant === 'compact'
  const { appearance } = useTheme()
  const isGradientHome = useDashboardHomeChrome()
  const isDark = appearance === 'dark'
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

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center px-4',
        isCompact ? 'py-4 sm:py-6' : 'py-10 sm:py-14',
        isGradientHome && !isCompact && 'py-6 sm:py-10'
      )}
    >
      <div
        className={cn(
          'relative flex w-full flex-col items-center justify-center',
          isCompact ? 'px-4 py-8 sm:px-6 sm:py-10' : 'px-6 py-14 sm:px-10 sm:py-16',
          isGradientHome ? 'overflow-visible' : 'overflow-hidden max-w-3xl rounded-3xl border shadow-xl',
          !isGradientHome && (isDark ? 'border-white/10 shadow-black/25' : 'border-border-card shadow-card')
        )}
        style={
          isGradientHome
            ? undefined
            : {
                background:
                  'linear-gradient(145deg, rgb(var(--accent-gold)) 0%, rgb(var(--accent-gold)) 40%, rgb(var(--accent-gold-dark)) 100%)',
              }
        }
      >
        {!isGradientHome ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 50%)',
            }}
          />
        ) : null}

        <div className="relative z-[1] mb-7 flex items-baseline justify-center gap-0">
          <span
            className={cn(
              'font-sans font-extrabold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[opacity,transform] duration-700',
              isCompact ? 'text-[2.5rem] sm:text-[3.5rem]' : 'text-[3.25rem] sm:text-[5.5rem]'
            )}
            style={{
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
              'font-sans font-extrabold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[opacity,transform,letter-spacing] duration-700',
              isCompact ? 'text-[2.5rem] sm:text-[3.5rem]' : 'text-[3.25rem] sm:text-[5.5rem]'
            )}
            style={{
              opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
              transform:
                fase === 'nome' || fase === 'slogan' ? 'translateX(0)' : 'translateX(-20px)',
              letterSpacing: fase === 'nome' || fase === 'slogan' ? '0.05em' : '0.3em',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            ockpit
          </span>
          <span
            className="ml-2 self-end pb-1 font-sans text-[1.1rem] font-light leading-none text-white/60 transition-[opacity,transform] duration-700 sm:ml-3 sm:pb-2 sm:text-[2rem]"
            style={{
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
            'relative z-[1] mb-5 h-0.5 w-14 rounded-full bg-white/40',
            isGradientHome
              ? 'transition-opacity duration-700'
              : 'transition-[opacity,transform] duration-700'
          )}
          style={
            isGradientHome
              ? { opacity: fase === 'slogan' ? 1 : 0 }
              : {
                  opacity: fase === 'slogan' ? 1 : 0,
                  transform: fase === 'slogan' ? 'scaleX(1)' : 'scaleX(0)',
                }
          }
        />

        <p
          className="relative z-[1] max-w-xl text-center font-sans text-[0.7rem] font-medium uppercase tracking-[0.12em] text-white/90 transition-[opacity,transform] duration-700 sm:text-[1.05rem] sm:tracking-[0.15em]"
          style={{
            opacity: fase === 'slogan' ? 1 : 0,
            transform: fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
          }}
        >
          {SLOGAN}
        </p>

        <p
          className={cn(
            'relative z-[1] max-w-md text-center text-xs leading-relaxed text-white/55 sm:text-sm',
            isCompact ? 'mt-6' : 'mt-10'
          )}
          style={{
            opacity: fase === 'slogan' ? 1 : 0,
            transition: 'opacity 1s ease 0.4s',
          }}
        >
          {isCompact
            ? 'Fale com o Jarvis ao lado — pesquisas, território, agenda e alertas em linguagem natural. O menu lateral leva aos módulos.'
            : 'Navegue pelo menu à esquerda para aceder aos módulos do sistema.'}
        </p>
      </div>
    </div>
  )
}
