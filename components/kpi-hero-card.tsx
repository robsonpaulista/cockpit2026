'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import { TrendingUp, TrendingDown, Trophy, Eye, EyeOff } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'

interface InfoLine {
  text: string
  type?: 'positive' | 'negative' | 'neutral'
  icon?: 'trending' | 'trophy'
}

interface KPIHeroCardProps {
  kpi: KPI
  subtitle?: string
  infoLines?: InfoLine[]
  href?: string
  hideValueByDefault?: boolean
  cenarioVotos?: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
  onChangeCenarioVotos?: (cenario: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior') => void
}

export function KPIHeroCard({
  kpi,
  subtitle,
  infoLines,
  href = '#',
  hideValueByDefault = false,
  cenarioVotos,
  onChangeCenarioVotos,
}: KPIHeroCardProps) {
  const router = useRouter()
  const [displayValue, setDisplayValue] = useState<string | number>('0')
  const [isAnimating, setIsAnimating] = useState(false)
  const [isValueVisible, setIsValueVisible] = useState(!hideValueByDefault)

  useEffect(() => {
    setIsValueVisible(!hideValueByDefault)
  }, [hideValueByDefault, kpi.id])

  useEffect(() => {
    setIsAnimating(true)
    const numericValue = typeof kpi.value === 'string' 
      ? parseFloat(kpi.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
      : kpi.value || 0

    if (typeof numericValue === 'number' && numericValue > 0 && !kpi.value.toString().includes('/')) {
      const duration = 900 // mais lento = mais impactante
      const fps = 60
      const totalFrames = Math.round(duration / (1000 / fps))
      let frame = 0

      const timer = setInterval(() => {
        frame++
        // Easing: desacelera no final (easeOutExpo)
        const progress = 1 - Math.pow(1 - frame / totalFrames, 3)
        const current = Math.floor(numericValue * progress)
        setDisplayValue(current.toLocaleString('pt-BR'))

        if (frame >= totalFrames) {
          clearInterval(timer)
          setDisplayValue(kpi.value)
          setIsAnimating(false)
        }
      }, 1000 / fps)
      
      return () => clearInterval(timer)
    } else {
      setDisplayValue(kpi.value)
      setIsAnimating(false)
    }
  }, [kpi.value])

  const getInfoLineColor = (_type?: 'positive' | 'negative' | 'neutral') => {
    if (_type === 'positive') return 'text-emerald-100'
    if (_type === 'negative') return 'text-red-100'
    return 'text-[rgb(var(--strategic-yellow))]'
  }

  const getInfoLineIcon = (line: InfoLine) => {
    if (line.icon === 'trophy') return <Trophy className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'positive') return <TrendingUp className="w-4 h-4 flex-shrink-0" />
    if (line.icon === 'trending' && line.type === 'negative') return <TrendingDown className="w-4 h-4 flex-shrink-0" />
    return null
  }

  const handleToggleVisibility = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    setIsValueVisible((prev) => !prev)
  }

  const handleChangeCenario = (
    event: MouseEvent<HTMLButtonElement>,
    cenario: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
  ) => {
    event.stopPropagation()
    event.preventDefault()
    onChangeCenarioVotos?.(cenario)
  }

  const content = (
    <div
      className={cn(
        'relative rounded-[14px] border border-accent-gold bg-accent-gold p-4 sm:p-5',
        'shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
        'hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] hover:-translate-y-[3px]',
        'transition-all duration-300 ease-out',
        href ? 'cursor-pointer group overflow-hidden' : 'group overflow-hidden'
      )}
    >
      {/* Mobile: coluna; desktop: linha — evita sobreposição do valor com os textos */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-5">
        <div className="flex min-w-0 gap-3 sm:gap-4 lg:flex-1 lg:items-center">
          <div className="animate-breathe flex-shrink-0 rounded-xl bg-white/20 p-3">
            <TrendingUp className="h-7 w-7 text-white sm:h-8 sm:w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug text-white transition-colors group-hover:text-white/90">
              {kpi.label}
            </p>
            {subtitle && !infoLines && (
              <p className="mt-1 text-sm text-white/70">{subtitle}</p>
            )}
            {infoLines && infoLines.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {infoLines.map((line, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'flex items-start gap-2 text-xs font-medium leading-relaxed sm:items-center',
                      getInfoLineColor(line.type)
                    )}
                  >
                    <span className="mt-0.5 flex-shrink-0 sm:mt-0">{getInfoLineIcon(line)}</span>
                    <span className="min-w-0 break-words">{line.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-white/15 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 lg:justify-end">
            <span
              className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-[rgb(var(--strategic-yellow))]"
              style={{ boxShadow: '0 0 0 3px rgba(242, 201, 76, 0.22)' }}
              title="Indicador estratégico"
            />
            <p
              className={cn(
                'min-w-0 text-3xl font-black tabular-nums text-white transition-all duration-300 sm:text-4xl',
                !isValueVisible && 'select-none tracking-wider',
                isAnimating && 'scale-105'
              )}
            >
              {isValueVisible ? displayValue : '••••••'}
            </p>
            {hideValueByDefault && (
              <button
                type="button"
                onClick={handleToggleVisibility}
                className="rounded-md bg-white/20 p-1.5 text-white transition-colors hover:bg-white/30"
                title={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
                aria-label={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
              >
                {isValueVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
            {cenarioVotos && onChangeCenarioVotos && (
              <div className="inline-flex flex-shrink-0 overflow-hidden rounded-md border border-white/30 bg-white/15">
                <button
                  type="button"
                  onClick={(event) => handleChangeCenario(event, 'aferido_jadyel')}
                  className={cn(
                    'px-2 py-1 text-[10px] font-semibold transition-colors',
                    cenarioVotos === 'aferido_jadyel'
                      ? 'bg-white text-accent-gold'
                      : 'text-white/85 hover:bg-white/20'
                  )}
                  title="Visão Jadyel"
                  aria-label="Visão Jadyel"
                >
                  J
                </button>
                <button
                  type="button"
                  onClick={(event) => handleChangeCenario(event, 'promessa_lideranca')}
                  className={cn(
                    'px-2 py-1 text-[10px] font-semibold transition-colors',
                    cenarioVotos === 'promessa_lideranca'
                      ? 'bg-white text-accent-gold'
                      : 'text-white/85 hover:bg-white/20'
                  )}
                  title="Visão Lideranças"
                  aria-label="Visão Lideranças"
                >
                  L
                </button>
                <button
                  type="button"
                  onClick={(event) => handleChangeCenario(event, 'legado_anterior')}
                  className={cn(
                    'px-2 py-1 text-[10px] font-semibold transition-colors',
                    cenarioVotos === 'legado_anterior'
                      ? 'bg-white text-accent-gold'
                      : 'text-white/85 hover:bg-white/20'
                  )}
                  title="Visão Anterior"
                  aria-label="Visão Anterior"
                >
                  A
                </button>
              </div>
            )}
            <span className="rounded border border-white/30 bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white">
              Hoje
            </span>
          </div>
          <span className="text-[11px] text-white/60 lg:text-right">Fonte própria</span>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => router.push(href)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            router.push(href)
          }
        }}
      >
        {content}
      </div>
    )
  }

  return content
}
