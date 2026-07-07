'use client'

import { useEffect, useRef, useState } from 'react'
import {
  calcularObrasMandatoSplashStats,
  formatMetrosQuadradosMandato,
  formatValorMandatoCompacto,
  type ObrasMandatoSplashStats,
} from '@/lib/obras-mapa-splash-stats'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import { cn } from '@/lib/utils'

const SPLASH_MS = 5000

const KPI_STAGGER_MS = [400, 900, 1400, 1900, 2400] as const

type SplashFase = 'inicio' | 'titulo' | 'kpis' | 'saida'

/** Contador que sobe rápido e depois oscila — sensação de painel ao vivo. */
function useContadorPopulacaoAoVivo(target: number, active: boolean): number {
  const [display, setDisplay] = useState(0)
  const displayRef = useRef(0)

  useEffect(() => {
    if (!active || target <= 0) {
      setDisplay(active ? target : 0)
      displayRef.current = active ? target : 0
      return
    }

    displayRef.current = Math.floor(target * 0.58)
    setDisplay(displayRef.current)

    const inicio = Date.now()
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - inicio

      if (elapsed < 1500) {
        const t = Math.min(1, elapsed / 1500)
        const eased = 1 - (1 - t) ** 3
        displayRef.current = Math.floor(target * (0.58 + eased * 0.38))
      } else {
        const piso = Math.floor(target * 0.988)
        const teto = Math.floor(target * 1.006)
        const roll = Math.random()

        if (roll < 0.62) {
          displayRef.current += Math.floor(Math.random() * 52) + 4
        } else if (roll < 0.78) {
          displayRef.current -= Math.floor(Math.random() * 28) + 2
        } else {
          displayRef.current += Math.floor(Math.random() * 18) + 1
        }

        if (displayRef.current < piso) {
          displayRef.current = piso + Math.floor(Math.random() * 60) + 8
        }
        if (displayRef.current > teto) {
          displayRef.current = teto - Math.floor(Math.random() * 35) - 3
        }
        if (displayRef.current < target && Math.random() < 0.45) {
          displayRef.current = Math.min(teto, displayRef.current + Math.floor(Math.random() * 24) + 3)
        }
      }

      setDisplay(displayRef.current)
    }, 85)

    return () => clearInterval(interval)
  }, [active, target])

  return display
}

function useAnimatedNumber(target: number, active: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active || target <= 0) {
      setValue(active ? target : 0)
      return
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, target, durationMs])

  return value
}

interface MapaObrasSplashProps {
  obras: ObraMapaRow[]
  onConcluir: () => void
  className?: string
}

export function MapaObrasSplash({ obras, onConcluir, className }: MapaObrasSplashProps) {
  const stats: ObrasMandatoSplashStats = calcularObrasMandatoSplashStats(obras)
  const [fase, setFase] = useState<SplashFase>('inicio')
  const [kpiVisivel, setKpiVisivel] = useState<boolean[]>([false, false, false, false, false])
  const concluiuRef = useRef(false)
  const onConcluirRef = useRef(onConcluir)
  onConcluirRef.current = onConcluir

  const concluir = () => {
    if (concluiuRef.current) return
    concluiuRef.current = true
    setFase('saida')
    window.setTimeout(() => onConcluirRef.current(), 480)
  }

  useEffect(() => {
    const timers: number[] = []
    timers.push(window.setTimeout(() => setFase('titulo'), 120))
    timers.push(window.setTimeout(() => setFase('kpis'), 500))
    KPI_STAGGER_MS.forEach((ms, i) => {
      timers.push(
        window.setTimeout(() => {
          setKpiVisivel((prev) => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }, ms)
      )
    })
    timers.push(window.setTimeout(concluir, SPLASH_MS))

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [])

  const obrasAnim = useAnimatedNumber(stats.totalObras, kpiVisivel[0])
  const municipiosAnim = useAnimatedNumber(stats.totalMunicipios, kpiVisivel[1])
  const valorAnim = useAnimatedNumber(stats.valorTotal, kpiVisivel[2], 1100)
  const m2Anim = useAnimatedNumber(stats.metrosQuadradosPavimentados, kpiVisivel[3], 1100)
  const populacaoAoVivo = useContadorPopulacaoAoVivo(stats.populacaoImpactada, kpiVisivel[4])

  const kpis = [
    {
      visivel: kpiVisivel[0],
      valor: `${obrasAnim} obras`,
      delay: 0,
    },
    {
      visivel: kpiVisivel[1],
      valor: `${municipiosAnim} municípios`,
      delay: 0,
    },
    {
      visivel: kpiVisivel[2],
      valor: formatValorMandatoCompacto(valorAnim),
      delay: 0,
    },
    {
      visivel: kpiVisivel[3],
      valor: formatMetrosQuadradosMandato(m2Anim),
      delay: 0,
    },
  ]

  return (
    <div
      role="presentation"
      onClick={concluir}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') concluir()
      }}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center overflow-hidden px-6 py-10',
        className
      )}
      style={{
        background: '#ffffff',
        opacity: fase === 'saida' ? 0 : 1,
        transform: fase === 'saida' ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 0.48s cubic-bezier(0.4, 0, 0.2, 1), transform 0.48s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className="relative z-[1] flex w-full max-w-xl flex-col items-center text-center">
        <p
          className="font-sans text-xs font-medium uppercase tracking-[0.32em] text-black/60 transition-[opacity,transform] duration-700 sm:text-sm"
          style={{
            opacity: fase !== 'inicio' ? 1 : 0,
            transform: fase !== 'inicio' ? 'translateY(0)' : 'translateY(12px)',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          Mandato
        </p>

        <div
          className="my-6 h-px w-16 rounded-full bg-black/15 transition-[opacity,transform] duration-700 sm:my-8"
          style={{
            opacity: fase === 'titulo' || fase === 'kpis' ? 1 : 0,
            transform: fase === 'titulo' || fase === 'kpis' ? 'scaleX(1)' : 'scaleX(0)',
          }}
        />

        <div className="flex w-full flex-col gap-5 sm:gap-7">
          {kpis.map((kpi, i) => (
            <p
              key={i}
              className="font-sans text-[2rem] font-semibold leading-tight tracking-tight text-black transition-[opacity,transform] duration-700 sm:text-[2.75rem] lg:text-[3rem]"
              style={{
                opacity: kpi.visivel ? 1 : 0,
                transform: kpi.visivel ? 'translateY(0)' : 'translateY(18px)',
                transitionDelay: `${i * 40}ms`,
                transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {kpi.valor}
            </p>
          ))}
        </div>

        <div
          className="mt-8 w-full transition-[opacity,transform] duration-700 sm:mt-10"
          style={{
            opacity: kpiVisivel[4] ? 1 : 0,
            transform: kpiVisivel[4] ? 'translateY(0)' : 'translateY(18px)',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <p
            className="font-sans text-[2rem] font-semibold tabular-nums leading-tight tracking-tight text-black sm:text-[2.75rem] lg:text-[3rem]"
            aria-live="polite"
            aria-atomic="true"
          >
            {populacaoAoVivo.toLocaleString('pt-BR')}
          </p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-sans text-xs uppercase tracking-[0.2em] text-black/55 sm:text-sm">
            <span>População impactada</span>
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-black/45">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-black/60"
                style={{ animation: 'mapa-obras-splash-pulse 1.1s ease-in-out infinite' }}
              />
              atualizando…
            </span>
          </p>
        </div>

        <p
          className="mt-12 font-sans text-xs tracking-[0.08em] text-black/45 transition-opacity duration-1000 sm:mt-16 sm:text-sm"
          style={{ opacity: fase === 'kpis' ? 1 : 0, transitionDelay: '2.2s' }}
        >
          Clique para ir ao mapa
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10">
        <div
          className="h-full bg-black/40"
          style={{
            animation: `mapa-obras-splash-progress ${SPLASH_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes mapa-obras-splash-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes mapa-obras-splash-pulse {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export const MAPA_OBRAS_SPLASH_MS = SPLASH_MS
