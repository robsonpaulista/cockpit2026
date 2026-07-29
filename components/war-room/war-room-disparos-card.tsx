'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconLoader2, IconSend } from '@tabler/icons-react'
import {
  WAR_ROOM_DISPAROS,
  type WarRoomDisparo,
  type WarRoomDisparoStatus,
} from '@/lib/war-room/mock-data'
import { formatWarRoomPct } from '@/lib/war-room/format'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomDisparoDetalheModal } from '@/components/war-room/war-room-disparo-detalhe-modal'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

const LIST_VISIBLE = 6

function barTone(status: WarRoomDisparoStatus | undefined): string {
  if (status === 'critico') return 'wr-disparos-clean__bar-fill--critico'
  if (status === 'atencao') return 'wr-disparos-clean__bar-fill--atencao'
  return 'wr-disparos-clean__bar-fill--ok'
}

/** Disparos recentes — campanhas reais via Fluxo 55Dynamics. */
export function WarRoomDisparosCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('disparos')
  const [rows, setRows] = useState<WarRoomDisparo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [periodoLabel, setPeriodoLabel] = useState<string | null>(null)
  const [detalheCampanha, setDetalheCampanha] = useState<{
    campanhaId: string | null
    titulo: string
  } | null>(null)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(`/api/fluxo/campanhas?limit=${LIST_VISIBLE}`, {
        cache: 'no-store',
      })
      const data = (await res.json()) as {
        disparos?: WarRoomDisparo[]
        error?: string
        configured?: boolean
        meta?: { periodoDe?: string | null; periodoAte?: string | null }
      }
      if (data.configured === false) {
        setConfigured(false)
        setPeriodoLabel(null)
        setRows(WAR_ROOM_DISPAROS.slice(0, LIST_VISIBLE))
        if (!silent) setError(null)
        return
      }
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar disparos')
      }
      setConfigured(true)
      const list = Array.isArray(data.disparos) ? data.disparos : []
      setRows(list)
      const de = data.meta?.periodoDe
      const ate = data.meta?.periodoAte
      if (de && ate) {
        const fmt = (iso: string) => {
          const d = new Date(iso)
          if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
          return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          })
        }
        const a = fmt(de)
        const b = fmt(ate)
        setPeriodoLabel(a === b ? a : `${a}–${b}`)
      } else {
        setPeriodoLabel(null)
      }
      if (list.length === 0 && !silent) {
        setError(null)
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar disparos')
        setRows([])
        setPeriodoLabel(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({ silent: false })
  }, [load])

  useEffect(() => {
    return register('disparos', async ({ silent }) => {
      await load({ silent })
    })
  }, [register, load])

  const snapshotLines = useMemo(
    () =>
      rows.map(
        (r) =>
          `${r.campanha}\t${r.enviados}\t${r.clicksPct}\t${r.cidade ?? ''}`,
      ),
    [rows],
  )

  useWarRoomSnapshot({
    cardId: 'disparos',
    lines: loading && rows.length === 0 ? null : snapshotLines,
    noun: 'campanha',
    ready: !loading || rows.length > 0,
  })

  return (
    <section
      id="wr-disparos"
      className={cn('wr-disparos-clean', 'wr-cell--disparos', className)}
      aria-label="Disparos recentes"
    >
      <header className="wr-disparos-clean__header">
        <div className="wr-disparos-clean__title-row">
          <div>
            <h2 className="wr-disparos-clean__heading">Disparos recentes</h2>
            <p className="wr-disparos-clean__sub">
              {configured
                ? periodoLabel
                  ? `Campanhas Fluxo · ${periodoLabel}`
                  : 'Campanhas Fluxo · taxa de envio'
                : 'Campanhas (mock · API não configurada)'}
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-disparos-clean__badge" />
          ) : null}
        </div>
      </header>

      {loading && rows.length === 0 ? (
        <div className="wr-disparos-clean__state">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando campanhas…
        </div>
      ) : error && rows.length === 0 ? (
        <p className="wr-disparos-clean__state wr-disparos-clean__state--erro">{error}</p>
      ) : rows.length === 0 ? (
        <p className="wr-disparos-clean__state">Nenhum disparo recente.</p>
      ) : (
        <ul className="wr-disparos-clean__list" aria-label="Últimos disparos">
          {rows.slice(0, LIST_VISIBLE).map((row) => (
            <li key={`${row.campanhaId ?? row.campanha}-${row.enviados}`}>
              <button
                type="button"
                className="wr-disparos-clean__row wr-disparos-clean__row--clickable"
                title={`${row.campanha} · ${row.publico}${row.cidade ? ` · ${row.cidade}` : ''} · ${row.enviados.toLocaleString('pt-BR')} envios · ${formatWarRoomPct(row.clicksPct)} ok · clique para detalhar`}
                onClick={() =>
                  setDetalheCampanha({
                    campanhaId: row.campanhaId ?? null,
                    titulo: row.campanha,
                  })
                }
              >
                <span className="wr-disparos-clean__icon" aria-hidden>
                  <IconSend className="h-3.5 w-3.5" stroke={1.6} />
                </span>
                <span className="wr-disparos-clean__label truncate">{row.campanha}</span>
                <span className="wr-disparos-clean__value tabular-nums">
                  {row.enviados.toLocaleString('pt-BR')}
                </span>
                <div
                  className="wr-disparos-clean__bar"
                  role="progressbar"
                  aria-valuenow={row.clicksPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.campanha}: taxa ${formatWarRoomPct(row.clicksPct)}`}
                >
                  <span
                    className={cn(
                      'wr-disparos-clean__bar-fill',
                      barTone(row.status),
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, row.clicksPct))}%` }}
                  />
                </div>
                <span className="wr-disparos-clean__pct tabular-nums">
                  {formatWarRoomPct(row.clicksPct)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dashboard/whatsapp" className="wr-disparos-clean__footer">
        <span>Ver todos</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>

      {detalheCampanha ? (
        <WarRoomDisparoDetalheModal
          campanhaId={detalheCampanha.campanhaId}
          titulo={detalheCampanha.titulo}
          onClose={() => setDetalheCampanha(null)}
        />
      ) : null}
    </section>
  )
}
