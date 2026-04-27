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
import { useTheme } from '@/contexts/theme-context'

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
  /** Barra horizontal 0–100 (ex.: cobertura territorial — referência Visão Geral). Só Cockpit. */
  cockpitProgressPct?: number
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
  projecao: Target,
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

/** Uma linha de status como na referência Cockpit (texto verde/azul ou pill vermelha “Margem”). */
function CockpitReferenceStatus({
  kpi,
  subtitle,
  subtitleType = 'neutral',
  infoLines,
  cockpitDark,
}: {
  kpi: KPI
  subtitle?: string
  subtitleType?: 'positive' | 'negative' | 'neutral'
  infoLines?: KPIInfoLine[]
  cockpitDark: boolean
}) {
  const text = subtitle?.trim() || infoLines?.[0]?.text?.trim()
  if (!text) return null

  const tone = subtitle ? subtitleType : infoLines?.[0]?.type ?? 'neutral'
  const isMargemPill =
    kpi.id === 'projecao' && /^margem\s*:/i.test(text.trim())

  if (isMargemPill) {
    return (
      <span className="inline-flex max-w-full justify-center rounded-full bg-[#ef4444] px-3 py-1 text-center text-[11px] font-semibold leading-tight text-white shadow-sm">
        {text}
      </span>
    )
  }

  const isLiderancaSky =
    kpi.id === 'base' || text.toLowerCase().includes('lideranças')
  const isRankGreen = kpi.id === 'sentimento'

  const textClass = (() => {
    if (!cockpitDark) {
      if (tone === 'negative') return 'text-rose-700'
      if (tone === 'positive')
        return isLiderancaSky ? 'text-sky-600' : isRankGreen ? 'text-emerald-600' : 'text-emerald-600'
      return 'text-slate-600'
    }
    if (tone === 'negative') return 'text-rose-300'
    if (tone === 'positive') {
      if (isLiderancaSky) return 'text-[#38bdf8]'
      if (isRankGreen) return 'text-emerald-400'
      return 'text-emerald-400'
    }
    return 'text-slate-400'
  })()

  return (
    <p className={cn('max-w-full px-1 text-center text-xs font-medium leading-snug', textClass)}>{text}</p>
  )
}

export function KPICard({
  kpi,
  href = '#',
  subtitle,
  subtitleType = 'neutral',
  infoLines,
  variant = 'default',
  cockpitProgressPct,
  cockpitFooter,
}: KPICardProps) {
  const { appearance } = useTheme()
  const Icon = getKpiIcon(kpi.id, variant)
  const isCockpit = variant === 'cockpit'
  const cockpitDark = isCockpit && appearance === 'dark'
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

  const getLineColorClass = (type?: 'positive' | 'negative' | 'neutral') => {
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

  const detalhesBlock =
    infoLines && infoLines.length > 0 ? (
      <div className="flex w-full flex-col items-center gap-1.5">
        {infoLines.map((line, idx) => (
          <div
            key={idx}
            className={cn(
              'inline-flex w-fit max-w-full items-center gap-1.5 rounded-lg px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
              getLineBackgroundClass(line.type)
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
        ))}
      </div>
    ) : subtitle ? (
      <span
        className={cn(
          'inline-flex w-fit max-w-full items-center justify-center rounded-lg px-2 py-1 text-[11px] font-medium leading-tight tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
          getLineBackgroundClass(subtitleType),
          getLineColorClass(subtitleType)
        )}
      >
        {subtitle}
      </span>
    ) : null

  const content = (
    <div
      className={cn(
        'relative cursor-pointer overflow-hidden rounded-[14px]',
        !isCockpit && 'group',
        'transition-all duration-300 ease-out',
        'h-full flex flex-col',
        isCockpit ? 'min-h-0 px-2.5 py-2' : 'min-h-[100px] justify-between p-4',
        isCockpit
          ? cn(
              'min-w-0 rounded-xl border',
              cockpitDark
                ? 'border-gray-800/90 bg-[#111827] shadow-[0_4px_20px_rgba(0,0,0,0.45)]'
                : 'border-slate-200/90 bg-white shadow-md shadow-slate-900/5'
            )
          : 'border border-border-card bg-bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]'
      )}
    >
      {isCockpit ? (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 text-center">
          <Icon
            className={cn(
              'h-5 w-5 shrink-0 stroke-[1.25]',
              cockpitDark ? 'text-[#38bdf8]' : 'text-[#0e74bc]'
            )}
            aria-hidden
          />
          <p
            className={cn(
              'line-clamp-2 min-h-[2.25rem] max-w-full text-[13px] font-medium leading-snug',
              cockpitDark ? 'text-gray-400' : 'text-slate-600'
            )}
          >
            {kpi.label}
          </p>
          <p
            className={cn(
              'text-[1.6rem] font-bold tabular-nums leading-none tracking-tight sm:text-[1.7rem]',
              cockpitDark ? 'text-white' : 'text-slate-900',
              isAnimating && 'scale-[1.02] transition-transform'
            )}
          >
            {displayValue}
          </p>
          {cockpitProgressPct !== undefined && cockpitProgressPct >= 0 ? (
            <div
              className={cn(
                'h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full',
                cockpitDark ? 'bg-white/10' : 'bg-slate-200/90'
              )}
              aria-hidden
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-500',
                  cockpitDark ? 'bg-[#38bdf8]' : 'bg-[#0e74bc]'
                )}
                style={{ width: `${Math.min(100, Math.max(0, cockpitProgressPct))}%` }}
              />
            </div>
          ) : null}
          <CockpitReferenceStatus
            kpi={kpi}
            subtitle={subtitle}
            subtitleType={subtitleType}
            infoLines={infoLines}
            cockpitDark={cockpitDark}
          />
          {cockpitFooter ? (
            <div
              className="mt-0.5 w-full shrink-0"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {cockpitFooter}
            </div>
          ) : null}
        </div>
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

