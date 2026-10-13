'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import {
  TseCard,
  TseCarregando,
  TseErro,
  TseStatus,
  TseThOrdenavel,
  TseVazio,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { cn, formatDateShort } from '@/lib/utils'
import {
  emendaEstaPaga,
  filtrarEmendasPorMunicipio,
  totaisEmendas,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import { formatarMoedaFicha } from '@/lib/ficha-lideranca-resumo'
import { fetchEmendas } from '@/lib/services/emendas-client'

type SortCol =
  | 'exercicio'
  | 'emenda'
  | 'bloco'
  | 'valor_indicado'
  | 'valor_empenhado'
  | 'valor_pago'
  | 'data_pagamento'
  | 'status'
  | 'objeto'

const COR_PAGA = 'var(--tse-green)'
const COR_ABERTO = 'var(--tse-zero)'

function cmpNullableNumber(a: number | null | undefined, b: number | null | undefined): number {
  const na = a != null && Number.isFinite(Number(a)) ? Number(a) : null
  const nb = b != null && Number.isFinite(Number(b)) ? Number(b) : null
  if (na === null && nb === null) return 0
  if (na === null) return 1
  if (nb === null) return -1
  return na - nb
}

function cmpNullableString(a: string | null | undefined, b: string | null | undefined): number {
  const sa = (a ?? '').trim()
  const sb = (b ?? '').trim()
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  return sa.localeCompare(sb, 'pt-BR', { sensitivity: 'base' })
}

function cmpNullableDate(a: string | null | undefined, b: string | null | undefined): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  return cmpNullableNumber(Number.isFinite(ta) ? ta : null, Number.isFinite(tb) ? tb : null)
}

function compararEmendas(a: EmendaRegistro, b: EmendaRegistro, col: SortCol, asc: boolean): number {
  let base = 0
  switch (col) {
    case 'exercicio':
      base = cmpNullableNumber(a.exercicio, b.exercicio)
      break
    case 'emenda':
      base = cmpNullableString(a.emenda, b.emenda)
      break
    case 'bloco':
      base = cmpNullableString(a.bloco, b.bloco)
      break
    case 'valor_indicado':
      base = cmpNullableNumber(a.valor_indicado, b.valor_indicado)
      break
    case 'valor_empenhado':
      base = cmpNullableNumber(a.valor_empenhado, b.valor_empenhado)
      break
    case 'valor_pago':
      base = cmpNullableNumber(a.valor_pago, b.valor_pago)
      break
    case 'data_pagamento':
      base = cmpNullableDate(a.data_pagamento, b.data_pagamento)
      break
    case 'status':
      base = Number(emendaEstaPaga(a)) - Number(emendaEstaPaga(b))
      break
    case 'objeto':
      base = cmpNullableString(a.objeto, b.objeto)
      break
  }
  if (base === 0 && col !== 'emenda') base = cmpNullableString(a.emenda, b.emenda)
  return asc ? base : -base
}

function ResumoValor({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="min-w-[8rem] flex-1 rounded-xl bg-[var(--tse-bar)] px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</div>
      <div className="mt-0.5 text-[15px] font-black tabular-nums">{formatarMoedaFicha(valor)}</div>
    </div>
  )
}

export function FichaAtendimentoEmendasMandato({ municipio }: { municipio: string }) {
  const [todas, setTodas] = useState<EmendaRegistro[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('exercicio')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortAsc((v) => !v)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTodas(await fetchEmendas())
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

  const filtradas = useMemo(() => filtrarEmendasPorMunicipio(todas, municipio), [todas, municipio])
  const totais = useMemo(() => totaisEmendas(filtradas), [filtradas])
  const pagas = useMemo(() => filtradas.filter(emendaEstaPaga).length, [filtradas])
  const ordenadas = useMemo(
    () => [...filtradas].sort((a, b) => compararEmendas(a, b, sortCol, sortAsc)),
    [filtradas, sortCol, sortAsc],
  )

  const th = (col: SortCol, rotulo: string, alinhar: 'left' | 'right' = 'left') => (
    <TseThOrdenavel col={col} sortCol={sortCol} sortAsc={sortAsc} onSort={handleSort} alinhar={alinhar}>
      {rotulo}
    </TseThOrdenavel>
  )

  return (
    <TseCard
      titulo="Emendas do mandato"
      subtitulo={
        <>
          Emendas com município/beneficiário <strong className="text-[var(--tse-text)]">{municipio}</strong> (mesma
          base da página Emendas)
        </>
      }
      acao={
        <Link href="/dashboard/emendas" className={cn(tseLinkAcaoClass, 'inline-flex shrink-0 items-center gap-1')}>
          Abrir Emendas
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="mt-4">
        {loading ? (
          <TseCarregando texto="Carregando emendas…" className="min-h-[12rem]" />
        ) : error ? (
          <TseErro>{error}</TseErro>
        ) : filtradas.length === 0 ? (
          <TseVazio>Nenhuma emenda cadastrada para este município como beneficiário.</TseVazio>
        ) : (
          <>
            <div className="mb-3 text-[12px] text-[var(--tse-muted)]">
              <strong className="text-[var(--tse-text)]">{filtradas.length}</strong>{' '}
              {filtradas.length === 1 ? 'emenda' : 'emendas'} ·{' '}
              <strong className="text-[var(--tse-text)]">{pagas}</strong> {pagas === 1 ? 'paga' : 'pagas'} ·{' '}
              <strong className="text-[var(--tse-text)]">{filtradas.length - pagas}</strong> em aberto
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <ResumoValor rotulo="Valor indicado" valor={totais.valorIndicado} />
              <ResumoValor rotulo="Valor empenhado" valor={totais.valorEmpenhado} />
              <ResumoValor rotulo="Valor pago" valor={totais.valorPago} />
              <ResumoValor rotulo="A empenhar" valor={totais.valorAEmpenhar} />
              <ResumoValor rotulo="A ser pago" valor={totais.valorASerPago} />
            </div>
            <div className={cn(tseTabela.container, 'shadow-none ring-1 ring-[#EEEEEE]')}>
              <table className={cn(tseTabela.table, 'min-w-[880px]')} data-tse-tabela>
                <thead className={tseTabela.thead}>
                  <tr>
                    {th('exercicio', 'Exerc.')}
                    {th('emenda', 'Emenda')}
                    {th('bloco', 'Bloco')}
                    {th('valor_indicado', 'Indicado', 'right')}
                    {th('valor_empenhado', 'Empenhado', 'right')}
                    {th('valor_pago', 'Pago', 'right')}
                    {th('data_pagamento', 'Pagamento')}
                    {th('status', 'Status')}
                    {th('objeto', 'Objeto')}
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.map((r) => {
                    const paga = emendaEstaPaga(r)
                    return (
                      <tr key={r.id} className={tseTabela.tr}>
                        <td className={cn(tseTabela.td, 'tabular-nums')}>{r.exercicio ?? '—'}</td>
                        <td className={cn(tseTabela.td, 'max-w-[10rem] truncate font-bold')} title={r.emenda}>
                          {r.emenda}
                        </td>
                        <td className={cn(tseTabela.td, 'text-[12px]')}>{r.bloco || '—'}</td>
                        <td className={cn(tseTabela.td, 'whitespace-nowrap text-right tabular-nums')}>
                          {formatarMoedaFicha(r.valor_indicado)}
                        </td>
                        <td className={cn(tseTabela.td, 'whitespace-nowrap text-right tabular-nums')}>
                          {formatarMoedaFicha(r.valor_empenhado)}
                        </td>
                        <td className={cn(tseTabela.td, 'whitespace-nowrap text-right font-bold tabular-nums')}>
                          {formatarMoedaFicha(r.valor_pago)}
                        </td>
                        <td className={cn(tseTabela.td, 'whitespace-nowrap text-[var(--tse-muted)]')}>
                          {r.data_pagamento ? formatDateShort(r.data_pagamento) : '—'}
                        </td>
                        <td className={tseTabela.td}>
                          <TseStatus cor={paga ? COR_PAGA : COR_ABERTO}>{paga ? 'Paga' : 'Em aberto'}</TseStatus>
                        </td>
                        <td
                          className={cn(tseTabela.td, 'max-w-[16rem] truncate text-[12px] text-[var(--tse-muted)]')}
                          title={r.objeto || ''}
                        >
                          {r.objeto || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#EEEEEE] bg-[var(--tse-bar)] text-[12px] font-bold">
                    <td className={tseTabela.td} colSpan={3}>
                      TOTAL ({filtradas.length})
                    </td>
                    <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                      {formatarMoedaFicha(totais.valorIndicado)}
                    </td>
                    <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                      {formatarMoedaFicha(totais.valorEmpenhado)}
                    </td>
                    <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                      {formatarMoedaFicha(totais.valorPago)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </TseCard>
  )
}
