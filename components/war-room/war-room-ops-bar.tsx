'use client'

import { useEffect, useState } from 'react'
import {
  IconChartBar,
  IconSunHigh,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

const TZ = 'America/Sao_Paulo'
/** 1º turno — abertura das urnas (horário de Brasília). */
const ELECTION_AT = new Date('2026-10-04T08:00:00-03:00')

type Props = {
  alertCount: number
  lastRefreshAt: number | null
  desempenhoActive?: boolean
  onToggleDesempenho?: () => void
  className?: string
}

type ElectionCountdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

function pad2(n: number | null | undefined): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  return String(v).padStart(2, '0')
}

function formatDateTime(nowMs: number, timeZone = TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(nowMs))
    .replace(',', '')
}

function getElectionCountdown(nowMs: number): ElectionCountdown {
  const diffMs = Math.max(0, ELECTION_AT.getTime() - nowMs)
  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true }
  }
  const totalSeconds = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds, done: false }
}

function resolveAlertLevel(alertCount: number): {
  label: string
  tone: 'ok' | 'moderado' | 'critico'
} {
  if (alertCount >= 2) return { label: 'Crítico', tone: 'critico' }
  if (alertCount >= 1) return { label: 'Moderado', tone: 'moderado' }
  return { label: 'Estável', tone: 'ok' }
}

function ChronoUnit({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <span className="wr-chrono__unit">
      <span className="wr-chrono__digits tabular-nums">{value}</span>
      <span className="wr-chrono__unit-label">{label}</span>
    </span>
  )
}

/** Barra de status operacional — 6 segmentos clean. */
export function WarRoomOpsBar({
  alertCount,
  lastRefreshAt: _lastRefreshAt,
  desempenhoActive = false,
  onToggleDesempenho,
  className,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setNowMs(Date.now())
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const nowLabel = formatDateTime(nowMs)
  const countdown = getElectionCountdown(nowMs)
  const alertLevel = resolveAlertLevel(alertCount)
  const countdownAria = countdown.done
    ? 'Eleições em andamento em 4 de outubro de 2026'
    : `${countdown.days} dias, ${countdown.hours} horas, ${countdown.minutes} minutos e ${countdown.seconds} segundos para as eleições de 4 de outubro de 2026`

  return (
    <div
      className={cn('wr-status-bar', className)}
      role="status"
      aria-live="polite"
    >
      <div className="wr-status-bar__item">
        <span className="wr-status-bar__label">Status operacional</span>
        <span className="wr-status-bar__value">
          <span className="wr-status-bar__dot" aria-hidden />
          Em operação
        </span>
      </div>

      <div className="wr-status-bar__item">
        <span className="wr-status-bar__label">Data e hora</span>
        <span className="wr-status-bar__value tabular-nums">{nowLabel}</span>
      </div>

      <div
        className="wr-status-bar__item wr-status-bar__item--countdown"
        title="1º turno · 04/10/2026 · 08h (Brasília)"
      >
        <span className="wr-status-bar__label">Eleições · 04/10</span>
        {countdown.done ? (
          <span className="wr-status-bar__value wr-status-bar__countdown">
            Dia da eleição
          </span>
        ) : (
          <span
            className="wr-chrono"
            aria-label={countdownAria}
            aria-live="off"
          >
            <ChronoUnit value={String(countdown.days)} label="d" />
            <span className="wr-chrono__sep" aria-hidden>
              :
            </span>
            <ChronoUnit value={pad2(countdown.hours)} label="h" />
            <span className="wr-chrono__sep" aria-hidden>
              :
            </span>
            <ChronoUnit value={pad2(countdown.minutes)} label="m" />
            <span className="wr-chrono__sep" aria-hidden>
              :
            </span>
            <ChronoUnit value={pad2(countdown.seconds)} label="s" />
          </span>
        )}
      </div>

      <div className="wr-status-bar__item">
        <span className="wr-status-bar__label">Clima político</span>
        <span className="wr-status-bar__value">
          <IconSunHigh className="wr-status-bar__icon wr-status-bar__icon--sun" stroke={1.75} aria-hidden />
          Favorável
        </span>
      </div>

      <div className="wr-status-bar__item">
        <span className="wr-status-bar__label">Nível de alerta</span>
        <span
          className={cn(
            'wr-status-bar__badge',
            `wr-status-bar__badge--${alertLevel.tone}`,
          )}
        >
          {alertLevel.label}
        </span>
      </div>

      <button
        type="button"
        className={cn(
          'wr-status-bar__item wr-status-bar__item--action',
          desempenhoActive && 'wr-status-bar__item--desempenho-ativo',
        )}
        aria-pressed={desempenhoActive}
        onClick={() => onToggleDesempenho?.()}
      >
        <span className="wr-status-bar__label">Desempenho</span>
        <span className="wr-status-bar__value">
          <IconChartBar className="wr-status-bar__icon" stroke={1.75} aria-hidden />
          {desempenhoActive ? 'Ativo' : 'Padrão'}
        </span>
      </button>
    </div>
  )
}
