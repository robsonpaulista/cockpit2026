'use client'

import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowRight,
  IconArrowUp,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export type WarRoomHBarTone = 'teal' | 'violet' | 'blue' | 'warn' | 'positive' | 'critical'

const H_BAR_TONE_COLOR: Record<WarRoomHBarTone, string> = {
  teal: 'var(--wr-teal)',
  violet: 'var(--wr-violet)',
  blue: 'var(--wr-blue)',
  warn: 'var(--wr-warn)',
  positive: 'var(--wr-positive)',
  critical: 'var(--wr-critical)',
}

type WarRoomHBarProps = {
  pct: number
  tone?: WarRoomHBarTone
  className?: string
}

/** Barra horizontal compacta de progresso — usada em KPIs e metas. */
export function WarRoomHBar({ pct, tone = 'teal', className }: WarRoomHBarProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[var(--wr-border)]', className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${clamped}%`, background: H_BAR_TONE_COLOR[tone] }}
      />
    </div>
  )
}

const RING_STROKE_COLOR = 'var(--wr-teal)'

type WarRoomRingProps = {
  pct: number
  size?: number
  label?: string
  sublabel?: string
  className?: string
}

/** Anel de progresso (SVG) — traço teal, único padrão de uso na War Room. */
export function WarRoomRing({ pct, size = 72, label, sublabel, className }: WarRoomRingProps) {
  const clamped = Math.min(100, Math.max(0, pct))
  const strokeWidth = Math.max(4, Math.round(size * 0.09))
  const radius = size / 2 - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div
      className={cn('inline-flex flex-col items-center gap-1.5', className)}
      role="img"
      aria-label={`${label ?? 'Progresso'}: ${Math.round(clamped)}%`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--wr-border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={RING_STROKE_COLOR}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-semibold tabular-nums text-[var(--wr-text)]">
            {label ?? `${Math.round(clamped)}%`}
          </span>
        </div>
      </div>
      {sublabel ? (
        <span className="max-w-[11rem] text-center text-[12px] text-[var(--wr-muted)]">
          {sublabel}
        </span>
      ) : null}
    </div>
  )
}

export type WarRoomTrendDirection = 'up' | 'down' | 'flat' | 'warn'

const TREND_ICON: Record<WarRoomTrendDirection, typeof IconArrowUp> = {
  up: IconArrowUp,
  down: IconArrowDown,
  flat: IconArrowRight,
  warn: IconAlertTriangle,
}

const TREND_COLOR_CLASS: Record<WarRoomTrendDirection, string> = {
  up: 'text-[var(--wr-positive)]',
  down: 'text-[var(--wr-critical)]',
  flat: 'text-[var(--wr-muted)]',
  warn: 'text-[var(--wr-warn)]',
}

type WarRoomTrendProps = {
  direction: WarRoomTrendDirection
  className?: string
}

/** Seta compacta de tendência (alta / baixa / estável / atenção). */
export function WarRoomTrend({ direction, className }: WarRoomTrendProps) {
  const Icon = TREND_ICON[direction]
  return (
    <Icon
      className={cn('h-3.5 w-3.5 shrink-0', TREND_COLOR_CLASS[direction], className)}
      stroke={2}
      aria-hidden
    />
  )
}

export type WarRoomStatusTone = 'positive' | 'warn' | 'critical' | 'info' | 'muted'

const STATUS_TONE_BY_KEYWORD: Record<string, WarRoomStatusTone> = {
  ok: 'positive',
  entregue: 'positive',
  positivo: 'positive',
  atencao: 'warn',
  baixo: 'warn',
  em_campo: 'warn',
  alta: 'warn',
  critico: 'critical',
  critica: 'critical',
  atrasada: 'critical',
  info: 'info',
  processando: 'info',
  planejada: 'info',
  media: 'info',
  sem_dados: 'muted',
  atualizando: 'info',
}

const STATUS_TONE_CLASS: Record<WarRoomStatusTone, string> = {
  positive: 'bg-[var(--wr-positive-tint)] text-[var(--wr-positive)]',
  warn: 'bg-[var(--wr-orange-tint)] text-[var(--wr-orange)]',
  critical: 'bg-[var(--wr-critical-tint)] text-[var(--wr-critical)]',
  info: 'bg-[var(--wr-blue-tint)] text-[var(--wr-blue)]',
  muted: 'bg-[var(--wr-border)] text-[var(--wr-muted)]',
}

function resolveStatusTone(status: string): WarRoomStatusTone {
  return STATUS_TONE_BY_KEYWORD[status.toLowerCase()] ?? 'muted'
}

type WarRoomStatusBadgeProps = {
  status: string
  label?: string
  tone?: WarRoomStatusTone
  className?: string
}

/** Selo compacto de status textual, com tom resolvido automaticamente. */
export function WarRoomStatusBadge({ status, label, tone, className }: WarRoomStatusBadgeProps) {
  const resolvedTone = tone ?? resolveStatusTone(status)
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        STATUS_TONE_CLASS[resolvedTone],
        className,
      )}
    >
      {label ?? status}
    </span>
  )
}
