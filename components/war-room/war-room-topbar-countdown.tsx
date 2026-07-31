'use client'

import { useEffect, useState } from 'react'

const TZ = 'America/Sao_Paulo'
/** 1º turno — abertura das urnas (horário de Brasília). */
export const WAR_ROOM_ELECTION_AT = new Date('2026-10-04T08:00:00-03:00')

export type ElectionCountdown = {
  days: number
  hours: number
  minutes: number
  seconds: number
  done: boolean
}

function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0')
}

export function getElectionCountdown(nowMs: number): ElectionCountdown {
  const diffMs = Math.max(0, WAR_ROOM_ELECTION_AT.getTime() - nowMs)
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

/**
 * Cronômetro do 1º turno — uma linha, mesmo peso tipográfico do título WAR ROOM.
 */
export function WarRoomTopbarCountdown() {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const countdown = getElectionCountdown(nowMs)
  const label = countdown.done
    ? 'Dia da eleição · 04/10'
    : `${countdown.days}d ${pad2(countdown.hours)}:${pad2(countdown.minutes)}:${pad2(countdown.seconds)}`
  const aria = countdown.done
    ? 'Eleições em andamento em 4 de outubro de 2026'
    : `${countdown.days} dias, ${countdown.hours} horas, ${countdown.minutes} minutos e ${countdown.seconds} segundos para as eleições de 4 de outubro de 2026`

  return (
    <time
      className="wr-topbar-clean__countdown text-base font-bold uppercase tracking-tight sm:text-lg"
      dateTime={WAR_ROOM_ELECTION_AT.toISOString()}
      title={`1º turno · 04/10/2026 · 08h (${TZ.replace('_', ' ')})`}
      aria-label={aria}
      aria-live="off"
    >
      <span className="wr-topbar-clean__countdown-label">Eleições</span>
      <span className="wr-topbar-clean__countdown-value tabular-nums">{label}</span>
    </time>
  )
}
