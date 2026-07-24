'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconLoader2, IconTimeline } from '@tabler/icons-react'
import {
  alertaMissaoEvento,
  carregarEventosMissao,
  IPT_MISSAO_ALERTA_LABEL,
  labelSentidoMissao,
  leituraComparativoEvento,
  type IptMissaoEvento,
} from '@/lib/ipt-missao-evolucao'
import type { IptMissaoId } from '@/lib/ipt-missoes'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  WarRoomMiniPager,
  warRoomPageCount,
} from '@/components/war-room/war-room-mini-pager'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 5
const FETCH_LIMIT = 120

const FLUXO_MISSOES: Array<{ id: IptMissaoId; label: string }> = [
  { id: 'expectativa', label: 'Exp Votos' },
  { id: 'campo', label: 'Visitas' },
  { id: 'pesquisa', label: 'Pesquisas' },
]

type FluxoFiltro = IptMissaoId | 'todas'

const thClass =
  'pb-1 pr-1.5 font-medium text-[10px] uppercase tracking-wide text-[#a8a29e]'
const tdClass = 'h-7 py-0 pr-1.5 text-[12px]'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

type Props = {
  className?: string
}

/** Card secundário do bloco 1 — KPIs de fluxo (missões) + movimentos em tabela. */
export function WarRoomEvolucaoCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('evolucao')
  const [eventos, setEventos] = useState<IptMissaoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [missaoAtiva, setMissaoAtiva] = useState<FluxoFiltro>('todas')

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const lista = await carregarEventosMissao({ limit: FETCH_LIMIT })
      setEventos(lista)
      if (!silent) setPage(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar({ silent: false })
  }, [carregar])

  useEffect(() => {
    return register('evolucao', async ({ silent }) => {
      await carregar({ silent })
    })
  }, [register, carregar])

  const eventosFluxo = useMemo(
    () =>
      eventos.filter((e) =>
        FLUXO_MISSOES.some((m) => m.id === e.missao),
      ),
    [eventos],
  )

  const snapshotLines = useMemo(
    () =>
      eventosFluxo.map(
        (e) => `${e.id}\t${e.municipio}\t${e.missao}\t${e.sentido}\t${e.createdAt}`,
      ),
    [eventosFluxo],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'evolucao',
    lines: loading && eventos.length === 0 ? null : snapshotLines,
    noun: 'movimento',
    ready: !loading || eventos.length > 0,
  })

  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])

  const fluxoKpis = useMemo(() => {
    const porMissao = FLUXO_MISSOES.map((missao) => ({
      id: missao.id as FluxoFiltro,
      label: missao.label,
      total: eventosFluxo.filter((e) => e.missao === missao.id).length,
    }))
    return [
      {
        id: 'todas' as const,
        label: 'Todos',
        total: eventosFluxo.length,
      },
      ...porMissao,
    ]
  }, [eventosFluxo])

  const eventosFiltrados = useMemo(
    () =>
      missaoAtiva === 'todas'
        ? eventosFluxo
        : eventosFluxo.filter((e) => e.missao === missaoAtiva),
    [eventosFluxo, missaoAtiva],
  )

  useEffect(() => {
    setPage(0)
  }, [missaoAtiva])

  useEffect(() => {
    const max = warRoomPageCount(eventosFiltrados.length, PAGE_SIZE) - 1
    if (page > max) setPage(Math.max(0, max))
  }, [page, eventosFiltrados.length])

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE
    return eventosFiltrados.slice(start, start + PAGE_SIZE)
  }, [eventosFiltrados, page])

  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#ebe8e4] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] md:p-4',
        className,
      )}
      aria-label="Evolução das missões"
    >
      <div className="mb-2.5 flex shrink-0 items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#57534e]">
          <IconTimeline
            className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]"
            stroke={1.5}
            aria-hidden
          />
          <span className="truncate">Evolução</span>
          <WarRoomChangeBadge change={change} />
        </h2>
        <Link
          href="/dashboard/territorio/ipt"
          className="shrink-0 text-[12px] font-medium text-[rgb(var(--color-primary))] transition-opacity hover:opacity-80"
        >
          Ver no IPT
        </Link>
      </div>

      {loading && eventos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-4 text-[12px] text-[#78716c]">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando movimentos…
        </div>
      ) : (
        <>
          <div
            className="wr-funnel wr-funnel--vivid mb-3 shrink-0"
            role="tablist"
            aria-label="Filtrar por missão"
          >
            {fluxoKpis.map((step) => {
              const ativo = missaoAtiva === step.id
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  className={cn(
                    'wr-funnel__step wr-funnel__step--btn',
                    ativo && 'wr-funnel__step--accent',
                  )}
                  onClick={() => setMissaoAtiva(step.id)}
                >
                  <span className="wr-funnel__label">{step.label}</span>
                  <span className="wr-funnel__value">{step.total}</span>
                </button>
              )
            })}
          </div>

          {eventosFiltrados.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-[#78716c]">
              Nenhum movimento nesta missão.
            </p>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto border-t border-[#f0eeea] pt-2">
                <table className="w-full min-w-[320px] text-left" aria-label="Movimentos recentes">
                  <thead>
                    <tr className="border-b border-[#ebe8e4]">
                      <th className={cn(thClass, 'text-left')}>Impacto</th>
                      <th className={cn(thClass, 'text-left')}>Município</th>
                      <th className={cn(thClass, 'text-left')}>Mov.</th>
                      <th className={cn(thClass, 'text-left')}>Atual</th>
                      <th className={cn(thClass, 'pr-0 text-right')}>Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((evento) => {
                      const alerta = alertaMissaoEvento(evento)
                      const comp = leituraComparativoEvento(evento)
                      const entrou = evento.sentido === 'entrou'
                      return (
                        <tr
                          key={evento.id}
                          className={cn(
                            'border-b border-[#f3f1ec] last:border-0',
                            changedSet.has(evento.id) && 'wr-row--changed',
                          )}
                        >
                          <td className={cn(tdClass, 'align-middle')}>
                            <span
                              className={cn(
                                'wr-evolucao-tag',
                                `wr-evolucao-tag--${alerta.nivel}`,
                              )}
                              title={alerta.titulo}
                            >
                              {IPT_MISSAO_ALERTA_LABEL[alerta.nivel]}
                            </span>
                          </td>
                          <td
                            className={cn(
                              tdClass,
                              'max-w-[88px] truncate font-medium text-[#1c1917]',
                            )}
                            title={evento.municipio}
                          >
                            {evento.municipio}
                          </td>
                          <td className={cn(tdClass, 'align-middle')}>
                            <span
                              className={cn(
                                'wr-evolucao-badge',
                                entrou
                                  ? 'wr-evolucao-badge--in'
                                  : 'wr-evolucao-badge--out',
                              )}
                            >
                              {labelSentidoMissao(evento.sentido)}
                            </span>
                          </td>
                          <td
                            className={cn(
                              tdClass,
                              'max-w-[110px] truncate font-medium text-[#1c1917]',
                            )}
                            title={`${comp.metrica}: ${comp.anterior} → ${comp.atual}`}
                          >
                            {comp.atual}
                          </td>
                          <td
                            className={cn(
                              tdClass,
                              'pr-0 text-right tabular-nums text-[#78716c]',
                            )}
                          >
                            {formatWhen(evento.createdAt)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <WarRoomMiniPager
                className="mt-1.5"
                page={page}
                total={eventosFiltrados.length}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}
    </section>
  )
}
