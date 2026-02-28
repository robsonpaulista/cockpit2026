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
  cenarioVotos?: 'aferido_jadyel' | 'promessa_lideranca'
  onChangeCenarioVotos?: (cenario: 'aferido_jadyel' | 'promessa_lideranca') => void
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
    return 'text-white/80'
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
    cenario: 'aferido_jadyel' | 'promessa_lideranca'
  ) => {
    event.stopPropagation()
    event.preventDefault()
    onChangeCenarioVotos?.(cenario)
  }

  const content = (
    <div
      className={cn(
        'relative p-5 rounded-[14px] bg-accent-gold border border-accent-gold',
        'shadow-[0_2px_8px_rgba(0,0,0,0.1)]',
        'hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] hover:-translate-y-[3px]',
        'transition-all duration-300 ease-out',
        href ? 'cursor-pointer group overflow-hidden' : 'group overflow-hidden'
      )}
    >
      {/* Layout horizontal */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-white/20 flex-shrink-0 animate-breathe">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white group-hover:text-white/90 transition-colors">
            {kpi.label}
          </p>
          {subtitle && !infoLines && (
            <p className="text-sm text-white/70">{subtitle}</p>
          )}
          {infoLines && infoLines.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              {infoLines.map((line, idx) => (
                <span
                  key={idx}
                  className={cn(
                    'text-xs font-medium flex items-center gap-1.5',
                    getInfoLineColor(line.type)
                  )}
                >
                  {getInfoLineIcon(line)}
                  {line.text}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-2 justify-end">
            <p className={cn(
              'text-4xl font-black text-white transition-all duration-300',
              !isValueVisible && 'select-none tracking-wider',
              isAnimating && 'scale-105'
            )}>
              {isValueVisible ? displayValue : '••••••'}
            </p>
            {hideValueByDefault && (
              <button
                type="button"
                onClick={handleToggleVisibility}
                className="p-1 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
                title={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
                aria-label={isValueVisible ? 'Ocultar valor' : 'Mostrar valor'}
              >
                {isValueVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
            {cenarioVotos && onChangeCenarioVotos && (
              <div className="inline-flex items-center rounded-md border border-white/30 bg-white/15 overflow-hidden ml-1">
                <button
                  type="button"
                  onClick={(event) => handleChangeCenario(event, 'aferido_jadyel')}
                  className={cn(
                    'px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
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
                    'px-1.5 py-0.5 text-[10px] font-semibold transition-colors',
                    cenarioVotos === 'promessa_lideranca'
                      ? 'bg-white text-accent-gold'
                      : 'text-white/85 hover:bg-white/20'
                  )}
                  title="Visão Lideranças"
                  aria-label="Visão Lideranças"
                >
                  L
                </button>
              </div>
            )}
            <span className="px-2 py-0.5 text-[10px] font-medium bg-white/20 text-white rounded border border-white/30">
              Hoje
            </span>
          </div>
          <span className="text-xs text-white/60">Fonte própria</span>
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
