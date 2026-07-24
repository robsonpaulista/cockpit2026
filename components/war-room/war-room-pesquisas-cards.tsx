'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  IconChartDots3,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardList,
  IconLoader2,
  type Icon,
} from '@tabler/icons-react'
import { WAR_ROOM_PESQUISAS_ANDAMENTO } from '@/lib/war-room/mock-data'
import {
  buildWarRoomPesquisasConsolidadas,
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'
import {
  resolveCandidatoIpt,
  type PollIptRow,
} from '@/lib/ipt-pesquisa'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

const PAGE_SIZE_CONSOLIDADAS = 10
const PAGE_SIZE_ANDAMENTO = 4

function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

function MiniPager({
  page,
  total,
  pageSize,
  onChange,
  className,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  className?: string
}) {
  const pages = pageCount(total, pageSize)
  if (total <= pageSize) {
    return null
  }

  return (
    <div
      className={cn(
        'flex h-7 shrink-0 items-center justify-end gap-1.5',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 0}
        onClick={() => onChange(page - 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
      >
        <IconChevronLeft className="h-3.5 w-3.5" stroke={1.5} />
      </button>
      <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-[#78716c]">
        {page + 1}/{pages}
      </span>
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
      >
        <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
      </button>
    </div>
  )
}

function formatPct1(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatDiffPp(value: number): string {
  const abs = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  if (value > 0) return `+${abs} pp`
  if (value < 0) return `-${abs} pp`
  return `0,0 pp`
}

function CardHead({
  title,
  href,
  linkLabel,
  icon: Icon,
  badge,
}: {
  title: string
  href: string
  linkLabel: string
  icon: Icon
  badge?: ReactNode
}) {
  return (
    <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#57534e]">
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]"
          stroke={1.5}
          aria-hidden
        />
        <span className="truncate">{title}</span>
        {badge}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-[12px] font-medium text-[rgb(var(--color-primary))] transition-opacity hover:opacity-80"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

const thClass =
  'pb-1 pr-1.5 font-medium text-[10px] uppercase tracking-wide text-[#a8a29e]'
const tdClass = 'h-7 py-0 pr-1.5 text-[12px]'

type CardShellProps = {
  className?: string
  children: ReactNode
  'aria-label': string
}

function CardShell({ className, children, 'aria-label': ariaLabel }: CardShellProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-[#ebe8e4] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] md:p-4',
        className,
      )}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  )
}

/** Card 1 do bloco 2 — pesquisas consolidadas (API real). */
export function WarRoomPesquisasConsolidadasCard({ className }: { className?: string }) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('pesquisas')
  const [rows, setRows] = useState<WarRoomPesquisaConsolidadaReal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [candidato, setCandidato] = useState(() => resolveCandidatoIpt())
  const [page, setPage] = useState(0)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const foco = resolveCandidatoIpt()
      setCandidato(foco)
      const res = await fetch('/api/pesquisa?limit=5000', { cache: 'no-store' })
      if (!res.ok) throw new Error('pesquisa')
      const data = (await res.json()) as PollIptRow[]
      const built = buildWarRoomPesquisasConsolidadas(
        Array.isArray(data) ? data : [],
        foco,
        200,
      )
      setRows(built)
      if (!silent) setPage(0)
    } catch {
      if (!silent) {
        setRows([])
        setError('Não foi possível carregar as pesquisas.')
        setPage(0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({ silent: false })
  }, [load])

  useEffect(() => {
    return register('pesquisas', async ({ silent }) => {
      await load({ silent })
    })
  }, [register, load])

  const snapshotLines = useMemo(
    () =>
      rows.map(
        (r) =>
          `${r.id}\t${r.cidade}\t${r.jadyelPct ?? ''}\t${r.liderPct}\t${r.diferencaPp ?? ''}`,
      ),
    [rows],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'pesquisas',
    lines: loading && rows.length === 0 ? null : snapshotLines,
    noun: 'pesquisa',
    ready: !loading || rows.length > 0,
  })
  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])

  useEffect(() => {
    const max = pageCount(rows.length, PAGE_SIZE_CONSOLIDADAS) - 1
    if (page > max) setPage(Math.max(0, max))
  }, [page, rows.length])

  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE_CONSOLIDADAS
    return rows.slice(start, start + PAGE_SIZE_CONSOLIDADAS)
  }, [rows, page])

  return (
    <CardShell className={cn('h-auto', className)} aria-label="Pesquisas consolidadas">
      <CardHead
        title="Pesquisas consolidadas"
        href="/dashboard/pesquisa"
        linkLabel="Ver todos"
        icon={IconChartDots3}
        badge={<WarRoomChangeBadge change={change} />}
      />
      {loading && rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <IconLoader2 className="h-5 w-5 animate-spin text-[#a8a29e]" stroke={1.5} />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[#78716c]">
          {error ?? 'Nenhuma pesquisa consolidada no momento.'}
        </p>
      ) : (
        <>
          <div className="min-h-0 shrink overflow-x-auto">
            <table className="w-full min-w-[360px] text-left">
              <thead>
                <tr className="border-b border-[#ebe8e4]">
                  <th className={cn(thClass, 'text-left')}>Cidade</th>
                  <th className={cn(thClass, 'text-left')}>Instituto</th>
                  <th className={cn(thClass, 'text-left')}>Data</th>
                  <th className={cn(thClass, 'text-left')}>Cen.</th>
                  <th className={cn(thClass, 'text-right')}>Jadyel</th>
                  <th className={cn(thClass, 'text-right')}>Líder</th>
                  <th className={cn(thClass, 'pr-0 text-right')}>Diferença</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const jadyelNaFrente =
                    row.jadyelPct != null &&
                    row.diferencaPp != null &&
                    row.diferencaPp >= 0
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-[#f3f1ec] last:border-0',
                        changedSet.has(row.id) && 'wr-row--changed',
                      )}
                    >
                      <td className={cn(tdClass, 'max-w-[88px] truncate font-medium text-[#1c1917]')}>
                        {row.cidade}
                      </td>
                      <td className={cn(tdClass, 'max-w-[100px] truncate text-[#78716c]')}>
                        {row.instituto}
                      </td>
                      <td className={cn(tdClass, 'tabular-nums text-[#78716c]')}>
                        {row.dataLabel}
                      </td>
                      <td className={cn(tdClass, 'text-[#78716c]')} title={row.cenario}>
                        {row.cenario === 'Estimulada' ? 'Est.' : 'Esp.'}
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'text-right tabular-nums font-semibold',
                          jadyelNaFrente
                            ? 'wr-pesquisa-cell--lider text-[var(--wr-blue)]'
                            : 'text-[#1c1917]',
                        )}
                      >
                        {row.jadyelPct != null ? formatPct1(row.jadyelPct) : '—'}
                      </td>
                      <td
                        className={cn(tdClass, 'text-right tabular-nums font-semibold text-[#1c1917]')}
                        title={row.liderNome}
                      >
                        {formatPct1(row.liderPct)}
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'pr-0 text-right tabular-nums font-semibold',
                          row.diferencaPp == null
                            ? 'text-[#78716c]'
                            : row.diferencaPp < 0
                              ? 'text-[#dc2626]'
                              : 'text-[var(--wr-blue)]',
                        )}
                      >
                        {row.diferencaPp != null ? formatDiffPp(row.diferencaPp) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 flex shrink-0 items-center justify-between gap-2">
            <p
              className={cn(
                'min-w-0 truncate text-[11px]',
                error ? 'text-[#dc2626]' : 'text-[#a8a29e]',
              )}
            >
              {error ?? `${rows.length} onda(s) · foco ${candidato}`}
            </p>
            <MiniPager
              page={page}
              total={rows.length}
              pageSize={PAGE_SIZE_CONSOLIDADAS}
              onChange={setPage}
            />
          </div>
        </>
      )}
    </CardShell>
  )
}

/** Card 2 do bloco 2 — pesquisas em andamento (mock). */
export function WarRoomPesquisasAndamentoCard({ className }: { className?: string }) {
  const [page, setPage] = useState(0)
  const total = WAR_ROOM_PESQUISAS_ANDAMENTO.length
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE_ANDAMENTO
    return WAR_ROOM_PESQUISAS_ANDAMENTO.slice(start, start + PAGE_SIZE_ANDAMENTO)
  }, [page])

  useEffect(() => {
    const max = pageCount(total, PAGE_SIZE_ANDAMENTO) - 1
    if (page > max) setPage(Math.max(0, max))
  }, [page, total])

  return (
    <CardShell className={cn('h-auto', className)} aria-label="Pesquisas em andamento">
      <CardHead
        title="Pesquisas em andamento"
        href="/dashboard/pesquisa"
        linkLabel="Ver todas"
        icon={IconClipboardList}
      />
      <div className="wr-andamento-table min-h-0 shrink overflow-x-auto">
        <table className="w-full min-w-[260px] text-left">
          <thead>
            <tr className="border-b border-[#ebe8e4]">
              <th className={cn(thClass, 'text-left')}>Cidade</th>
              <th className={cn(thClass, 'text-left')}>Instituto</th>
              <th className={cn(thClass, 'text-right')}>Término</th>
              <th className={cn(thClass, 'pr-0 text-right')}>Entrega</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={`${row.cidade}-${row.instituto}-${row.termino}`}
                className="wr-andamento-table__row border-b border-[#f3f1ec] last:border-0"
              >
                <td className={cn(tdClass, 'font-medium text-[#1c1917]')}>{row.cidade}</td>
                <td className={cn(tdClass, 'text-[#78716c]')}>{row.instituto}</td>
                <td className={cn(tdClass, 'text-right tabular-nums text-[#78716c]')}>
                  {row.termino}
                </td>
                <td className={cn(tdClass, 'pr-0 text-right tabular-nums text-[#78716c]')}>
                  {row.entrega}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MiniPager
        className="mt-1.5"
        page={page}
        total={total}
        pageSize={PAGE_SIZE_ANDAMENTO}
        onChange={setPage}
      />
    </CardShell>
  )
}
