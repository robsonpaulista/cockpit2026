'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconLoader2, IconMapPin } from '@tabler/icons-react'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

const LOOKBACK_DAYS = 7
const LIST_VISIBLE = 6

type MunicipioVisitas = {
  municipio: string
  visitas: number
}

type ForaDoMapa = {
  cidade: string
  visitas: number
}

type VisitasResumoPayload = {
  error?: string
  municipios?: MunicipioVisitas[]
  foraDoMapaTd?: ForaDoMapa[]
  totalVisitas?: number
}

type CidadeRow = {
  key: string
  cidade: string
  visitas: number
}

type Props = {
  className?: string
}

/** Visitas (check-ins) realizadas nos últimos 7 dias, agregadas por cidade. */
export function WarRoomVisitasCidadeCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('visitas-cidade')
  const [rows, setRows] = useState<CidadeRow[]>([])
  const [totalVisitas, setTotalVisitas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVisitas = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/campo/visitas-resumo-td?days=${LOOKBACK_DAYS}`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as VisitasResumoPayload
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar as visitas')
      }

      const byCity = new Map<string, CidadeRow>()
      for (const m of data.municipios ?? []) {
        if (!m.visitas || m.visitas <= 0) continue
        const key = m.municipio.trim().toLocaleLowerCase('pt-BR')
        byCity.set(key, {
          key,
          cidade: m.municipio.trim(),
          visitas: m.visitas,
        })
      }
      for (const f of data.foraDoMapaTd ?? []) {
        if (!f.visitas || f.visitas <= 0) continue
        const cidade = f.cidade.trim()
        const key = cidade.toLocaleLowerCase('pt-BR')
        const prev = byCity.get(key)
        byCity.set(key, {
          key,
          cidade: prev?.cidade ?? cidade,
          visitas: (prev?.visitas ?? 0) + f.visitas,
        })
      }

      const sorted = [...byCity.values()].sort((a, b) => {
        if (b.visitas !== a.visitas) return b.visitas - a.visitas
        return a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' })
      })

      setRows(sorted)
      setTotalVisitas(
        typeof data.totalVisitas === 'number'
          ? data.totalVisitas
          : sorted.reduce((acc, r) => acc + r.visitas, 0),
      )
      setError(null)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar visitas')
        setRows([])
        setTotalVisitas(0)
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

  const visibleRows = useMemo(() => rows.slice(0, LIST_VISIBLE), [rows])
  const hiddenCount = Math.max(0, rows.length - LIST_VISIBLE)

  const snapshotLines = useMemo(
    () => rows.map((r) => `${r.key}\t${r.visitas}\t${r.cidade}`),
    [rows],
  )

  useWarRoomSnapshot({
    cardId: 'visitas-cidade',
    lines: loading && rows.length === 0 ? null : snapshotLines,
    noun: 'cidade',
    ready: !loading || rows.length > 0 || error != null,
  })

  const initialLoading = loading && rows.length === 0 && !error

  return (
    <section
      id="wr-visitas-cidade"
      className={cn('wr-visitas-cidade', 'wr-cell--visitas-cidade', className)}
      aria-label="Visitas por cidade"
    >
      <header className="wr-visitas-cidade__header">
        <div className="wr-visitas-cidade__title-row">
          <div>
            <h2 className="wr-visitas-cidade__heading">Visitas por cidade</h2>
            <p className="wr-visitas-cidade__sub">
              {totalVisitas > 0
                ? `${formatWarRoomNumber(totalVisitas)} check-ins · últimos ${LOOKBACK_DAYS} dias`
                : `Últimos ${LOOKBACK_DAYS} dias`}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-visitas-cidade__badge" />
          ) : null}
        </div>
      </header>

      {initialLoading ? (
        <div className="wr-visitas-cidade__state">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando visitas…
        </div>
      ) : error && rows.length === 0 ? (
        <p className="wr-visitas-cidade__state wr-visitas-cidade__state--erro">{error}</p>
      ) : rows.length === 0 ? (
        <p className="wr-visitas-cidade__state">
          Nenhuma visita nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <>
          <ul className="wr-visitas-cidade__list" aria-label="Visitas por cidade">
            <li className="wr-visitas-cidade__row wr-visitas-cidade__row--head" aria-hidden>
              <span>Cidade</span>
              <span className="text-right">Visitas</span>
            </li>
            {visibleRows.map((row) => (
              <li
                key={row.key}
                className="wr-visitas-cidade__row"
                title={`${row.cidade} · ${formatWarRoomNumber(row.visitas)} visitas`}
              >
                <span className="wr-visitas-cidade__cidade truncate">
                  <IconMapPin
                    className="h-3 w-3 shrink-0 opacity-60"
                    stroke={1.75}
                    aria-hidden
                  />
                  {row.cidade}
                </span>
                <span className="wr-visitas-cidade__count tabular-nums">
                  {formatWarRoomNumber(row.visitas)}
                </span>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <p className="wr-visitas-cidade__more">
              +{hiddenCount} {hiddenCount === 1 ? 'cidade' : 'cidades'}
            </p>
          ) : null}
        </>
      )}

      <Link href="/dashboard/campo" className="wr-visitas-cidade__footer">
        <span>Abrir Campo</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
