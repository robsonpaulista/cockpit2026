'use client'

import { useEffect, useState } from 'react'
import {
  IconChartBar,
  IconSunHigh,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { WAR_ROOM_AUTO_REFRESH_MS } from '@/lib/war-room/change-snapshots'

const TZ = 'America/Sao_Paulo'
const NEXT_REFRESH_MINUTES = Math.round(WAR_ROOM_AUTO_REFRESH_MS / 60_000)

type Props = {
  alertCount: number
  lastRefreshAt: number | null
  desempenhoActive?: boolean
  onToggleDesempenho?: () => void
  className?: string
}

function formatDateTime(timeZone = TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .replace(',', '')
}

function formatTime(ts: number, timeZone = TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ts))
}

function resolveAlertLevel(alertCount: number): {
  label: string
  tone: 'ok' | 'moderado' | 'critico'
} {
  if (alertCount >= 2) return { label: 'Crítico', tone: 'critico' }
  if (alertCount >= 1) return { label: 'Moderado', tone: 'moderado' }
  return { label: 'Estável', tone: 'ok' }
}

/** Barra de status operacional — 6 segmentos clean. */
export function WarRoomOpsBar({
  alertCount,
  lastRefreshAt,
  desempenhoActive = false,
  onToggleDesempenho,
  className,
}: Props) {
  const [nowLabel, setNowLabel] = useState(() => formatDateTime())

  useEffect(() => {
    const tick = () => setNowLabel(formatDateTime())
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [])

  const nextUpdate = lastRefreshAt
    ? formatTime(lastRefreshAt + NEXT_REFRESH_MINUTES * 60_000)
    : '—'
  const alertLevel = resolveAlertLevel(alertCount)

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

      <div className="wr-status-bar__item">
        <span className="wr-status-bar__label">Próxima atualização</span>
        <span className="wr-status-bar__value tabular-nums">{nextUpdate}</span>
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
