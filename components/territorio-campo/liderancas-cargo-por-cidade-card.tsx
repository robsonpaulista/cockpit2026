'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  cargoColumnsFromResumo,
  countCargoNaCidade,
  type CidadeLiderancasCargoRow,
  type LiderancasCargoPorCidadeResumo,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import { cargoTierDotClass } from '@/lib/cargo-tier-color'
import { cn } from '@/lib/utils'

const thClass =
  'sticky top-0 z-10 border-b border-[rgb(var(--color-border-tertiary)/0.55)] bg-bg-surface px-1 py-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted'
const thStickyLeft =
  'sticky left-0 z-20 border-b border-r border-[rgb(var(--color-border-tertiary)/0.55)] bg-bg-surface px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-text-muted'
const tdClass = 'border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-1 py-1 align-middle text-[10px] tabular-nums'
const tdStickyLeft =
  'sticky left-0 z-[1] border-b border-r border-[rgb(var(--color-border-tertiary)/0.35)] bg-bg-surface px-1.5 py-1 text-[10px] font-medium text-text-primary'

/** Área da tabela: cabeçalho + N linhas visíveis antes da barra de rolagem. */
const LIDERANCAS_TABELA_LINHAS_VISIVEIS = 10
const LIDERANCAS_TABELA_ALTURA_HEADER_PX = 28
const LIDERANCAS_TABELA_ALTURA_LINHA_PX = 26
const LIDERANCAS_TABELA_AREA_MAX_HEIGHT_PX =
  LIDERANCAS_TABELA_ALTURA_HEADER_PX + LIDERANCAS_TABELA_ALTURA_LINHA_PX * LIDERANCAS_TABELA_LINHAS_VISIVEIS

/** Título, resumo, busca, padding — mesma altura do card comparativo ao lado. */
const LIDERANCAS_CARD_CHROME_PX = 118
const LIDERANCAS_CARD_MAX_HEIGHT_PX = LIDERANCAS_CARD_CHROME_PX + LIDERANCAS_TABELA_AREA_MAX_HEIGHT_PX

const liderancasCardClassName =
  'flex min-h-0 flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-2'

export function LiderancasCargoPorCidadeCard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<LiderancasCargoPorCidadeResumo | null>(null)
  const [rows, setRows] = useState<CidadeLiderancasCargoRow[]>([])
  const [busca, setBusca] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/territorio/liderancas-por-cargo-cidade')
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string }
          setError(payload.error ?? 'Não foi possível carregar lideranças por cargo.')
          setResumo(null)
          setRows([])
          return
        }
        const data = (await res.json()) as {
          resumo?: LiderancasCargoPorCidadeResumo
          rows?: CidadeLiderancasCargoRow[]
        }
        setResumo(data.resumo ?? null)
        setRows(data.rows ?? [])
      } catch {
        setError('Erro ao carregar lideranças por cargo.')
        setResumo(null)
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const cargoColunas = useMemo(
    () => (resumo ? cargoColumnsFromResumo(resumo.cargosEstado) : []),
    [resumo]
  )

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.cidade.toLowerCase().includes(q) ||
        row.cargos.some((c) => c.cargo.toLowerCase().includes(q))
    )
  }, [rows, busca])

  if (loading) {
    return (
      <section
        className={liderancasCardClassName}
        style={{ maxHeight: LIDERANCAS_CARD_MAX_HEIGHT_PX }}
      >
        <div className="flex flex-1 items-center justify-center gap-2 py-4 text-xs text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Carregando lideranças…
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className={liderancasCardClassName}
        style={{ maxHeight: LIDERANCAS_CARD_MAX_HEIGHT_PX }}
      >
        <h2 className="text-xs font-semibold text-text-primary">Lideranças 2026 por cargo</h2>
        <p className="mt-1 text-xs text-text-secondary">{error}</p>
      </section>
    )
  }

  return (
    <section
      className={liderancasCardClassName}
      style={{ maxHeight: LIDERANCAS_CARD_MAX_HEIGHT_PX }}
    >
      <div className="shrink-0 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold leading-tight text-text-primary">Lideranças 2026 por cargo</h2>
          <p className="text-[10px] leading-tight text-text-muted">Por município — mesma base da aba Base</p>
        </div>
        {resumo ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] tabular-nums text-text-secondary">
            <span>
              <strong className="text-text-primary">{resumo.totalLiderancas.toLocaleString('pt-BR')}</strong>{' '}
              lideranças
            </span>
            <span className="text-text-muted">·</span>
            <span>
              <strong className="text-text-primary">{resumo.totalCidades}</strong> cidades
            </span>
          </div>
        ) : null}
      </div>

      <label className="relative mt-1.5 block shrink-0">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" aria-hidden />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município ou cargo…"
          className="w-full rounded-md border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-app py-1 pl-6 pr-1.5 text-[10px] text-text-primary outline-none focus:border-[rgb(var(--color-primary))]"
        />
      </label>

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr>
              <th className={cn(thStickyLeft, 'min-w-[7rem] max-w-[9rem]')}>Município</th>
              <th className={cn(thClass, 'w-9 text-center')}>Tot</th>
              {cargoColunas.map((cargo) => (
                <th
                  key={cargo}
                  className={cn(thClass, 'max-w-[4.5rem] min-w-[2.5rem] text-center normal-case')}
                  title={cargo}
                >
                  <span className="inline-flex max-w-full flex-col items-center gap-0.5">
                    <span
                      className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cargoTierDotClass(cargo))}
                      aria-hidden
                    />
                    <span className="line-clamp-2 text-[8px] font-semibold leading-tight text-text-secondary">
                      {cargo}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={2 + cargoColunas.length} className="py-4 text-center text-xs text-text-secondary">
                  Nenhum registro neste filtro.
                </td>
              </tr>
            ) : (
              rowsFiltradas.map((row) => (
                <tr key={row.cidade} className="group hover:bg-bg-app/50">
                  <td className={cn(tdStickyLeft, 'max-w-[9rem] truncate group-hover:bg-bg-app/50')}>
                    {row.cidade}
                  </td>
                  <td className={cn(tdClass, 'text-center font-semibold text-text-primary')}>{row.total}</td>
                  {cargoColunas.map((cargo) => {
                    const qtd = countCargoNaCidade(row, cargo)
                    return (
                      <td
                        key={cargo}
                        className={cn(
                          tdClass,
                          'text-center',
                          qtd > 0 ? 'font-medium text-text-primary' : 'text-text-muted/40'
                        )}
                      >
                        {qtd > 0 ? qtd : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
          {resumo && rowsFiltradas.length > 0 ? (
            <tfoot>
              <tr className="bg-bg-app/80 font-semibold">
                <td className={cn(tdStickyLeft, 'text-[9px] uppercase text-text-muted')}>Total PI</td>
                <td className={cn(tdClass, 'text-center text-text-primary')}>
                  {resumo.totalLiderancas.toLocaleString('pt-BR')}
                </td>
                {cargoColunas.map((cargo) => {
                  const total = resumo.cargosEstado.find((c) => c.cargo === cargo)?.total ?? 0
                  return (
                    <td key={cargo} className={cn(tdClass, 'text-center text-text-primary')}>
                      {total > 0 ? total : '—'}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  )
}
