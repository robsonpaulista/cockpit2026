'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, FileSpreadsheet } from 'lucide-react'
import { cn, formatDateShort } from '@/lib/utils'
import {
  emendaEstaPaga,
  filtrarEmendasPorMunicipio,
  totaisEmendas,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function trZebra(rowIndex: number): string {
  return rowIndex % 2 === 0 ? 'bg-background/45' : 'bg-surface/25'
}

function ResumoValor({
  label,
  valor,
  destaque,
}: {
  label: string
  valor: number
  destaque?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 min-w-[7.5rem] flex-1',
        destaque ? 'border-accent-gold/30 bg-accent-gold-soft/40' : 'border-card bg-background/60',
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={cn('mt-0.5 text-sm font-bold tabular-nums text-text-primary', destaque && 'text-accent-gold')}>
        {formatMoney(valor)}
      </p>
    </div>
  )
}

export function FichaAtendimentoEmendasMandato({ municipio }: { municipio: string }) {
  const [todas, setTodas] = useState<EmendaRegistro[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/emendas')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar emendas')
      setTodas(Array.isArray(data.emendas) ? data.emendas : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar emendas')
      setTodas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const filtradas = useMemo(
    () => filtrarEmendasPorMunicipio(todas, municipio),
    [todas, municipio],
  )

  const totais = useMemo(() => totaisEmendas(filtradas), [filtradas])

  const pagas = useMemo(() => filtradas.filter(emendaEstaPaga).length, [filtradas])

  const ordenadas = useMemo(
    () =>
      [...filtradas].sort((a, b) => {
        const exA = a.exercicio ?? 0
        const exB = b.exercicio ?? 0
        if (exB !== exA) return exB - exA
        return (a.emenda || '').localeCompare(b.emenda || '', 'pt-BR')
      }),
    [filtradas],
  )

  return (
    <section className="min-w-0 rounded-2xl border border-card bg-surface p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-accent-gold mt-0.5" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Emendas do mandato</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Emendas com município/beneficiário <strong className="text-text-primary">{municipio}</strong>
              {' '}
              (mesma base da página Emendas)
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/emendas"
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent-gold hover:underline"
        >
          Abrir cadastro de Emendas
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-accent-gold" />
          Carregando emendas…
        </div>
      )}

      {error && !loading && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {!loading && !error && (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-xs text-text-secondary">
            <span className="rounded-md bg-background px-2 py-1 border border-card">
              <strong className="text-text-primary">{filtradas.length}</strong> emenda(s)
            </span>
            <span className="rounded-md bg-background px-2 py-1 border border-card">
              <strong className="text-text-primary">{pagas}</strong> paga(s)
            </span>
            <span className="rounded-md bg-background px-2 py-1 border border-card">
              <strong className="text-text-primary">{filtradas.length - pagas}</strong> em aberto
            </span>
          </div>

          {filtradas.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <ResumoValor label="Valor indicado" valor={totais.valorIndicado} destaque />
              <ResumoValor label="Valor empenhado" valor={totais.valorEmpenhado} />
              <ResumoValor label="Valor pago" valor={totais.valorPago} destaque />
              <ResumoValor label="A empenhar" valor={totais.valorAEmpenhar} />
              <ResumoValor label="A ser pago" valor={totais.valorASerPago} />
            </div>
          )}

          {filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              Nenhuma emenda cadastrada para este município como beneficiário.
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-xl border border-card bg-white">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead>
                  <tr className="border-b border-card bg-background/80 text-xs text-text-secondary">
                    <th className="px-3 py-2 font-medium">Exerc.</th>
                    <th className="px-3 py-2 font-medium">Emenda</th>
                    <th className="px-3 py-2 font-medium">Bloco</th>
                    <th className="px-3 py-2 font-medium text-right">Indicado</th>
                    <th className="px-3 py-2 font-medium text-right">Empenhado</th>
                    <th className="px-3 py-2 font-medium text-right">Pago</th>
                    <th className="px-3 py-2 font-medium">Pagamento</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium min-w-[12rem]">Objeto</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((r, rowIndex) => {
                    const paga = emendaEstaPaga(r)
                    return (
                      <tr
                        key={r.id}
                        className={cn('border-b border-card/60 text-text-primary', trZebra(rowIndex))}
                      >
                        <td className="px-3 py-2.5 tabular-nums">{r.exercicio ?? '—'}</td>
                        <td className="px-3 py-2.5 font-medium max-w-[10rem] truncate" title={r.emenda}>
                          {r.emenda}
                        </td>
                        <td className="px-3 py-2.5 text-xs">{r.bloco || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {formatMoney(r.valor_indicado)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {formatMoney(r.valor_empenhado)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                          {formatMoney(r.valor_pago)}
                        </td>
                        <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                          {r.data_pagamento ? formatDateShort(r.data_pagamento) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              paga
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {paga ? 'Paga' : 'Em aberto'}
                          </span>
                        </td>
                        <td
                          className="px-3 py-2.5 text-xs text-text-secondary max-w-[16rem] truncate"
                          title={r.objeto || ''}
                        >
                          {r.objeto || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-card bg-background/90 font-semibold text-text-primary text-xs">
                    <td className="px-3 py-2" colSpan={3}>
                      TOTAL ({filtradas.length})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totais.valorIndicado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totais.valorEmpenhado)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totais.valorPago)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
