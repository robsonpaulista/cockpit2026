'use client'

import { cn } from '@/lib/utils'
import { KPI } from '@/types'
import Link from 'next/link'
import {
  TrendingUp,
  MapPin,
  Users,
  Vote,
  AlertTriangle,
  BarChart3,
  Sparkles,
  FileText,
  Target,
  MapPinned,
  UsersRound,
  BarChart2,
  BadgeCheck,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

interface KPIInfoLine {
  text: string
  type?: 'positive' | 'negative' | 'neutral'
}

interface KPICardProps {
  kpi: KPI
  href?: string
  subtitle?: string
  subtitleType?: 'positive' | 'negative' | 'neutral'
  infoLines?: KPIInfoLine[]
  /** Visual branco / ícones finos para tema Cockpit Vivo */
  variant?: 'default' | 'cockpit'
  /** Rodapé dentro do card (ex.: link que não deve ficar fora do vidro). Só Cockpit. */
  cockpitFooter?: ReactNode
}

const defaultIconMap: Record<string, LucideIcon> = {
  ife: TrendingUp,
  presenca: MapPin,
  base: Users,
  projecao: Vote,
  sentimento: BarChart3,
  risco: AlertTriangle,
  liderancas: Users,
  total: FileText,
  'expectativa-votos': Target,
  cidades: MapPin,
  posicao_chapa: Trophy,
}

/** Ícones mais leves e minimalistas no Cockpit */
const cockpitIconMap: Record<string, LucideIcon> = {
  ife: TrendingUp,
  presenca: MapPinned,
  base: UsersRound,
  projecao: BadgeCheck,
  sentimento: BarChart2,
  projecao_estadual: Sparkles,
  risco: AlertTriangle,
  liderancas: UsersRound,
  total: FileText,
  'expectativa-votos': Target,
  cidades: MapPinned,
  posicao_chapa: Trophy,
}

function getKpiIcon(id: string, variant: 'default' | 'cockpit') {
  const map = variant === 'cockpit' ? cockpitIconMap : defaultIconMap
  return map[id] || (variant === 'cockpit' ? BadgeCheck : Sparkles)
}

export function KPICard({
  kpi,
  href = '#',
  subtitle,
  subtitleType = 'neutral',
  infoLines,
  variant = 'default',
  cockpitFooter,
}: KPICardProps) {
  const Icon = getKpiIcon(kpi.id, variant)
  const isCockpit = variant === 'cockpit'
  const [displayValue, setDisplayValue] = useState<string | number>('0')
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    setIsAnimating(true)
    const numericValue = typeof kpi.value === 'string' 
      ? parseFloat(kpi.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
      : kpi.value || 0

    if (typeof numericValue === 'number' && numericValue > 0 && !kpi.value.toString().includes('/')) {
      const duration = 800
      const fps = 60
      const totalFrames = Math.round(duration / (1000 / fps))
      let frame = 0

      const timer = setInterval(() => {
        frame++
        // Easing: desacelera no final (easeOutCubic)
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

  /** Detalhes em microchips: visual mais limpo e consistente com o vidro do cockpit. */
  const getLineColorClass = (type?: 'positive' | 'negative' | 'neutral') => {
    if (isCockpit) {
      if (type === 'negative') return 'text-red-900/90'
      if (type === 'positive') return 'text-emerald-900/90'
      return 'text-[rgb(15,45,74)]/80'
    }
    if (type === 'negative') return 'text-red-700'
    if (type === 'positive') return 'text-emerald-700'
    return 'text-text-secondary'
  }

  const getLineDotClass = (type?: 'positive' | 'negative' | 'neutral') => {
    if (type === 'negative') return 'bg-red-500'
    if (type === 'positive') return 'bg-emerald-500'
    return 'bg-[rgb(var(--strategic-yellow))]'
  }

  const getLineBackgroundClass = (type?: 'positive' | 'negative' | 'neutral') => {
    if (type === 'negative') return 'border border-red-200/70 bg-red-50/80'
    if (type === 'positive') return 'border border-emerald-200/70 bg-emerald-50/80'
    return 'border border-slate-200/80 bg-white/90'
  }

  const cockpitLineChipClass = (type?: 'positive' | 'negative' | 'neutral') => {
    if (type === 'negative') return 'border border-red-300/45 bg-red-500/10'
    if (type === 'positive') return 'border border-emerald-300/45 bg-emerald-500/10'
    return 'border border-white/45 bg-white/45 supports-[backdrop-filter]:bg-white/35'
  }

  const detalhesBlock =
    infoLines && infoLines.length > 0 ? (
      <div className={cn('flex flex-col gap-1 w-full', isCockpit && 'items-center')}>
        {infoLines.map((line, idx) =>
          <div
            key={idx}
            className={cn(
              'inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
              isCockpit ? cockpitLineChipClass(line.type) : getLineBackgroundClass(line.type)
            )}
          >
            <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', getLineDotClass(line.type))} />
            <p
              className={cn(
                'max-w-full truncate text-[11px] font-medium leading-tight tracking-tight',
                getLineColorClass(line.type)
              )}
              title={line.text}
            >
              {line.text}
            </p>
          </div>
        )}
      </div>
    ) : subtitle ? (
      <span
        className={cn(
          'inline-flex w-fit max-w-full items-center justify-center rounded-lg px-2 py-1 text-[11px] font-medium leading-tight tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
          isCockpit
            ? cn(cockpitLineChipClass(subtitleType), getLineColorClass(subtitleType))
            : cn(getLineBackgroundClass(subtitleType), getLineColorClass(subtitleType))
        )}
      >
        {subtitle}
      </span>
    ) : null

  const content = (
    <div
      className={cn(
        'relative rounded-[14px] cursor-pointer group overflow-hidden',
        'transition-all duration-300 ease-out',
        'h-full flex flex-col',
        isCockpit ? 'min-h-0 p-3' : 'min-h-[100px] justify-between p-4',
        isCockpit
          ? cn(
              'min-w-0',
              'rounded-xl border border-white/40 bg-white/10 backdrop-blur-lg supports-[backdrop-filter]:bg-white/[0.07]',
              /* Mesma projeção do KPIHeroCard cockpit — borda inferior legível em TV/projetor */
              'shadow-[0_12px_40px_rgba(6,46,82,0.35),0_4px_24px_rgba(15,45,74,0.08),inset_0_1px_0_rgba(255,255,255,0.38)]',
              'hover:bg-white/16 hover:border-white/50 hover:shadow-[0_14px_44px_rgba(6,46,82,0.38),0_8px_28px_rgba(15,45,74,0.11),inset_0_1px_0_rgba(255,255,255,0.48)]',
              'hover:-translate-y-0.5'
            )
          : 'border border-border-card bg-bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]'
      )}
    >
      {isCockpit ? (
        <>
          <div className="flex shrink-0 flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-center sm:gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/45 bg-transparent transition-colors group-hover:border-white/55 group-hover:bg-white/[0.06]">
              <Icon className="h-4 w-4 text-accent-gold" strokeWidth={1.35} />
            </div>
            <p className="line-clamp-2 text-xs font-medium leading-snug text-[rgb(15,45,74)]/75 transition-colors group-hover:text-[rgb(15,45,74)] sm:text-sm">
              {kpi.label}
            </p>
          </div>
          {/* Valor logo abaixo do título — sem flex-1 aqui (evita empurrar detalhes para o rodapé) */}
          <div className="flex shrink-0 flex-col justify-center py-1">
            <p
              className={cn(
                'text-center text-xl font-bold tabular-nums text-text-primary transition-all duration-200 sm:text-2xl',
                'group-hover:text-accent-gold',
                isAnimating && 'scale-105'
              )}
            >
              {displayValue}
            </p>
          </div>
          {/* Detalhes colados no valor, padrão Média Pesquisas; flex-1 abaixo só preenche altura do grid */}
          <div className="flex shrink-0 flex-col items-center gap-1">
            {detalhesBlock}
            {cockpitFooter ? (
              <div
                className="w-full shrink-0"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                {cockpitFooter}
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1" aria-hidden />
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 rounded-lg bg-accent-gold-soft p-1.5 transition-transform group-hover:scale-110">
              <Icon className="h-4 w-4 text-accent-gold animate-breathe" strokeWidth={2} />
            </div>
            <p className="line-clamp-2 font-medium text-text-secondary transition-colors group-hover:text-text-primary">
              {kpi.label}
            </p>
          </div>
          <div className="mt-auto pt-2">
            <p
              className={cn(
                'text-2xl font-bold text-text-primary transition-all duration-200 group-hover:text-accent-gold',
                isAnimating && 'scale-105'
              )}
            >
              {displayValue}
            </p>
            <div className="mt-0.5 flex min-h-[2rem] items-start">{detalhesBlock}</div>
          </div>
        </>
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="flex h-full min-h-0 w-full min-w-0 flex-col">
        {content}
      </Link>
    )
  }

  return content
}

