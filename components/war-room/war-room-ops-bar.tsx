'use client'

import { BarChart3, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const TZ = 'America/Sao_Paulo'

type Props = {
  alertCount: number
  lastRefreshAt: number | null
  desempenhoActive?: boolean
  onToggleDesempenho?: () => void
  className?: string
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

function resolveAlertLevel(alertCount: number): {
  label: string
  tone: 'ok' | 'moderado' | 'critico'
} {
  if (alertCount >= 2) return { label: 'Crítico', tone: 'critico' }
  if (alertCount >= 1) return { label: 'Moderado', tone: 'moderado' }
  return { label: 'Estável', tone: 'ok' }
}

/** Barra de status operacional — segmentos clean (cronômetro fica na top bar). */
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
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const nowLabel = formatDateTime(nowMs)
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
        <span className="wr-status-bar__label">Clima político</span>
        <span className="wr-status-bar__value">
          <Sun className="wr-status-bar__icon wr-status-bar__icon--sun" strokeWidth={1.5} aria-hidden />
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
          <BarChart3 className="wr-status-bar__icon" strokeWidth={1.5} aria-hidden />
          {desempenhoActive ? 'Ativo' : 'Padrão'}
        </span>
      </button>
    </div>
  )
}
