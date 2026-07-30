'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconLoader2 } from '@tabler/icons-react'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

/** Comparativo geral de viagens — 3 semanas (21 dias). */
const WEEK_COUNT = 3
const LOOKBACK_DAYS = WEEK_COUNT * 7

/** Ordem de exibição: da mais antiga → atual. API: índice 0 = semana atual. */
const WEEK_CARDS = [
  { label: 'Há 2 sem.', short: '−2', apiIndex: 2 },
  { label: 'Há 1 sem.', short: '−1', apiIndex: 1 },
  { label: 'Esta sem.', short: 'Atual', apiIndex: 0 },
] as const

type VisitasResumoPayload = {
  error?: string
  totalVisitas?: number
  totalPorSemana?: number[] | null
}

type Props = {
  className?: string
}

function emptyWeeks(): number[] {
  return Array.from({ length: WEEK_COUNT }, () => 0)
}

function deltaLabel(atual: number, anterior: number): string | null {
  if (anterior <= 0 && atual <= 0) return null
  if (anterior <= 0) return atual > 0 ? '+100%' : null
  const pct = ((atual - anterior) / anterior) * 100
  const rounded = Math.round(pct)
  if (rounded === 0) return '0%'
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

/** Comparativo geral de check-ins nas últimas 3 semanas (não por cidade). */
export function WarRoomVisitasCidadeCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('visitas-cidade')
  const [totalVisitas, setTotalVisitas] = useState(0)
  const [totalPorSemana, setTotalPorSemana] = useState<number[]>(emptyWeeks)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVisitas = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(
        `/api/campo/visitas-resumo-td?weeks=${WEEK_COUNT}`,
        { cache: 'no-store' },
      )
      const data = (await res.json()) as VisitasResumoPayload
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar as visitas')
      }

      const semanas =
        Array.isArray(data.totalPorSemana) && data.totalPorSemana.length === WEEK_COUNT
          ? data.totalPorSemana
          : emptyWeeks()
      const total =
        typeof data.totalVisitas === 'number'
          ? data.totalVisitas
          : semanas.reduce((a, b) => a + b, 0)

      setTotalPorSemana(semanas)
      setTotalVisitas(total)
      setError(null)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar visitas')
        setTotalVisitas(0)
        setTotalPorSemana(emptyWeeks())
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVisitas({ silent: false })
  }, [loadVisitas])

  useEffect(() => {
    return register('visitas-cidade', async ({ silent }) => {
      await loadVisitas({ silent })
    })
  }, [register, loadVisitas])

  const snapshotLines = useMemo(
    () => [
      `total\t${totalVisitas}`,
      ...WEEK_CARDS.map(
        (w) => `sem:${w.apiIndex}\t${totalPorSemana[w.apiIndex] ?? 0}`,
      ),
    ],
    [totalPorSemana, totalVisitas],
  )

  useWarRoomSnapshot({
    cardId: 'visitas-cidade',
    lines: loading && totalVisitas === 0 && !error ? null : snapshotLines,
    noun: 'viagem',
    ready: !loading || totalVisitas > 0 || error != null,
  })

  const inicial = loading && totalVisitas === 0 && !error
  const atual = totalPorSemana[0] ?? 0
  const anterior = totalPorSemana[1] ?? 0
  const vsAnterior = deltaLabel(atual, anterior)

  return (
    <section
      id="wr-visitas-cidade"
      className={cn('wr-visitas-cidade', 'wr-cell--visitas-cidade', className)}
      aria-label="Comparativo de viagens"
    >
      <header className="wr-visitas-cidade__header">
        <div className="wr-visitas-cidade__title-row">
          <div>
            <h2 className="wr-visitas-cidade__heading">Visitas</h2>
            <p className="wr-visitas-cidade__sub">
              {totalVisitas > 0
                ? `${formatWarRoomNumber(totalVisitas)} viagens · 3 semanas (${LOOKBACK_DAYS}d)`
                : `Comparativo geral · 3 semanas (${LOOKBACK_DAYS} dias)`}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-visitas-cidade__badge" />
          ) : null}
        </div>
      </header>

      {inicial ? (
        <div className="wr-visitas-cidade__state">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando visitas…
        </div>
      ) : error && totalVisitas === 0 ? (
        <p className="wr-visitas-cidade__state wr-visitas-cidade__state--erro">{error}</p>
      ) : totalVisitas === 0 ? (
        <p className="wr-visitas-cidade__state">
          Nenhuma viagem nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <div
          className="wr-visitas-cidade__kpis"
          aria-label="Comparativo de viagens por semana"
        >
          {WEEK_CARDS.map((week, idx) => {
            const value = totalPorSemana[week.apiIndex] ?? 0
            const isAtual = week.apiIndex === 0
            return (
              <div
                key={week.short}
                className={cn(
                  'wr-visitas-cidade__kpi',
                  isAtual && 'wr-visitas-cidade__kpi--atual',
                )}
                title={`${week.label}: ${formatWarRoomNumber(value)} viagens`}
              >
                <span className="wr-visitas-cidade__kpi-value tabular-nums">
                  {formatWarRoomNumber(value)}
                </span>
                <span className="wr-visitas-cidade__kpi-label">{week.label}</span>
                {isAtual && vsAnterior ? (
                  <span
                    className={cn(
                      'wr-visitas-cidade__kpi-delta tabular-nums',
                      atual > anterior && 'wr-visitas-cidade__kpi-delta--up',
                      atual < anterior && 'wr-visitas-cidade__kpi-delta--down',
                    )}
                  >
                    {vsAnterior} vs sem. ant.
                  </span>
                ) : idx === 0 ? (
                  <span className="wr-visitas-cidade__kpi-delta wr-visitas-cidade__kpi-delta--muted">
                    14–20 dias
                  </span>
                ) : (
                  <span className="wr-visitas-cidade__kpi-delta wr-visitas-cidade__kpi-delta--muted">
                    7–13 dias
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="wr-visitas-cidade__footer-bar">
        <Link href="/dashboard/campo" className="wr-visitas-cidade__footer">
          <span>Abrir Campo</span>
          <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
        </Link>
      </div>
    </section>
  )
}
