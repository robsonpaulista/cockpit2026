'use client'

import { useEffect, useMemo, useState } from 'react'
import { TseThOrdenavel, tseTabela } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

export type ResumoEleicoesCidadeLinha = {
  nome: string
  eleitores: number | null
  votacao2022: number
  liderancas: number
  expectativa2026: number
  percentualExpectativaEleitorado: number | null
  variacao: number
}

type SortColuna =
  | 'nome'
  | 'eleitores'
  | 'votacao2022'
  | 'liderancas'
  | 'expectativa2026'
  | 'percentualExpectativaEleitorado'
  | 'variacao'

type Props = {
  linhas: ResumoEleicoesCidadeLinha[]
  cidadeAtiva: string | null
  labelExpectativa: string
  onSelecionarCidade: (nome: string) => void
  onAbrirLiderancas: (nome: string) => void
}

const fmt = (n: number): string => n.toLocaleString('pt-BR')

function formatPercentual(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1).replace('.', ',')}%`
}

export function ResumoEleicoesCidadesTabela({
  linhas,
  cidadeAtiva,
  labelExpectativa,
  onSelecionarCidade,
  onAbrirLiderancas,
}: Props) {
  const [sortCol, setSortCol] = useState<SortColuna>('expectativa2026')
  const [sortAsc, setSortAsc] = useState<boolean>(false)

  useEffect(() => {
    setSortCol('expectativa2026')
    setSortAsc(false)
  }, [labelExpectativa])

  const linhasOrdenadas = useMemo(() => {
    const fator = sortAsc ? 1 : -1
    return [...linhas].sort((a, b) => {
      if (sortCol === 'nome') return fator * a.nome.localeCompare(b.nome, 'pt-BR')
      return fator * ((a[sortCol] ?? -1) - (b[sortCol] ?? -1))
    })
  }, [linhas, sortCol, sortAsc])

  const ordenar = (coluna: SortColuna) => {
    if (sortCol === coluna) {
      setSortAsc((prev) => !prev)
      return
    }
    setSortCol(coluna)
    setSortAsc(coluna === 'nome')
  }

  if (linhas.length === 0) return null

  const thProps = { sortCol, sortAsc, onSort: ordenar }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-3">
        <h2 className="text-[14px] font-bold">Cidades</h2>
        <p className="text-[11px] text-[var(--tse-muted)]">
          {linhas.length} municípios · clique no nome para filtrar os quadros
        </p>
      </div>
      <div className="mt-2 max-h-[16rem] overflow-auto">
        <table className={tseTabela.table} data-tse-tabela>
          <thead className={cn(tseTabela.thead, 'sticky top-0 z-10')}>
            <tr>
              <TseThOrdenavel col="nome" {...thProps}>
                Município
              </TseThOrdenavel>
              <TseThOrdenavel col="eleitores" alinhar="right" {...thProps}>
                Eleitores
              </TseThOrdenavel>
              <TseThOrdenavel col="votacao2022" alinhar="right" {...thProps}>
                Votação 2022
              </TseThOrdenavel>
              <TseThOrdenavel col="liderancas" alinhar="right" {...thProps}>
                Lideranças
              </TseThOrdenavel>
              <TseThOrdenavel col="expectativa2026" alinhar="right" {...thProps}>
                {labelExpectativa}
              </TseThOrdenavel>
              <TseThOrdenavel col="percentualExpectativaEleitorado" alinhar="right" {...thProps}>
                <span title="Expectativa 2026 sobre o eleitorado">% exp.</span>
              </TseThOrdenavel>
              <TseThOrdenavel col="variacao" alinhar="right" {...thProps}>
                Δ vs 2022
              </TseThOrdenavel>
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha) => {
              const ativa = cidadeAtiva != null && linha.nome === cidadeAtiva
              return (
                <tr
                  key={linha.nome}
                  className={cn(
                    tseTabela.tr,
                    ativa
                      ? 'bg-[var(--tse-yellow-soft)] font-bold shadow-[inset_3px_0_0_var(--tse-yellow)]'
                      : 'hover:bg-[var(--tse-bar)]',
                  )}
                >
                  <td className="p-0">
                    <button
                      type="button"
                      onClick={() => onSelecionarCidade(linha.nome)}
                      className="w-full px-3 py-1.5 text-left font-semibold hover:text-[var(--tse-olive)]"
                    >
                      {linha.nome}
                    </button>
                  </td>
                  <td className={cn(tseTabela.td, 'py-1.5 text-right tabular-nums')}>
                    {linha.eleitores !== null ? fmt(linha.eleitores) : '—'}
                  </td>
                  <td className={cn(tseTabela.td, 'py-1.5 text-right tabular-nums')}>{fmt(linha.votacao2022)}</td>
                  <td className="p-0 text-right">
                    <button
                      type="button"
                      title="Ver lideranças do município"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrirLiderancas(linha.nome)
                      }}
                      className="w-full px-3 py-1.5 text-right tabular-nums underline-offset-2 hover:text-[var(--tse-olive)] hover:underline"
                    >
                      {fmt(linha.liderancas)}
                    </button>
                  </td>
                  <td className={cn(tseTabela.td, 'py-1.5 text-right font-bold tabular-nums')}>
                    {fmt(linha.expectativa2026)}
                  </td>
                  <td className={cn(tseTabela.td, 'py-1.5 text-right tabular-nums text-[var(--tse-muted)]')}>
                    {formatPercentual(linha.percentualExpectativaEleitorado)}
                  </td>
                  <td
                    className={cn(
                      tseTabela.td,
                      'py-1.5 text-right font-bold tabular-nums',
                      linha.variacao > 0 && 'text-[var(--tse-olive)]',
                      linha.variacao < 0 && 'text-red-700',
                    )}
                  >
                    {linha.variacao > 0 ? '+' : ''}
                    {fmt(linha.variacao)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
