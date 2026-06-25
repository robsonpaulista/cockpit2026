'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  RESUMO_TABLE_CLASS,
  RESUMO_TH_CLASS,
  RESUMO_TD_CLASS,
  resumoLinhaTabela,
  resumoSortAccentClass,
} from '@/lib/resumo-eleicoes-table-styles'

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
type SortDir = 'asc' | 'desc'

type Props = {
  linhas: ResumoEleicoesCidadeLinha[]
  cidadeAtiva: string | null
  labelExpectativa: string
  panelClassName: string
  onSelecionarCidade: (nome: string) => void
  onAbrirLiderancas: (nome: string) => void
}

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatPercentual(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1).replace('.', ',')}%`
}

function formatVariacao(n: number): string {
  const prefix = n > 0 ? '+' : ''
  return `${prefix}${formatNum(n)}`
}

function SortIcon({ ativo, dir, accentClass }: { ativo: boolean; dir: SortDir; accentClass: string }) {
  if (!ativo) return <ArrowUpDown className="h-3 w-3 shrink-0 opacity-45" aria-hidden />
  return dir === 'asc' ? (
    <ArrowUp className={cn('h-3 w-3 shrink-0', accentClass)} aria-hidden />
  ) : (
    <ArrowDown className={cn('h-3 w-3 shrink-0', accentClass)} aria-hidden />
  )
}

function CabecalhoOrdenavel({
  rotulo,
  alinhamento = 'left',
  ativo,
  dir,
  accentClass,
  onClick,
}: {
  rotulo: string
  alinhamento?: 'left' | 'right'
  ativo: boolean
  dir: SortDir
  accentClass: string
  onClick: () => void
}) {
  return (
    <th className={cn(RESUMO_TH_CLASS, alinhamento === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={onClick}
        title={rotulo === '% exp.' ? 'Expectativa 2026 sobre o eleitorado' : 'Ordenar coluna (A→Z / Z→A)'}
        className={cn(
          'inline-flex max-w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors hover:text-text-primary',
          alinhamento === 'right' && 'ml-auto',
          ativo ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        <span className="truncate">{rotulo}</span>
        <SortIcon ativo={ativo} dir={dir} accentClass={accentClass} />
      </button>
    </th>
  )
}

export function ResumoEleicoesCidadesTabela({
  linhas,
  cidadeAtiva,
  labelExpectativa,
  panelClassName,
  onSelecionarCidade,
  onAbrirLiderancas,
}: Props) {
  const [sortColuna, setSortColuna] = useState<SortColuna>('expectativa2026')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const sortAccentClass = resumoSortAccentClass()

  useEffect(() => {
    setSortColuna('expectativa2026')
    setSortDir('desc')
  }, [labelExpectativa])

  const linhasOrdenadas = useMemo(() => {
    const copia = [...linhas]
    const fator = sortDir === 'asc' ? 1 : -1

    copia.sort((a, b) => {
      if (sortColuna === 'nome') {
        return fator * a.nome.localeCompare(b.nome, 'pt-BR')
      }
      const valorA = a[sortColuna] ?? -1
      const valorB = b[sortColuna] ?? -1
      return fator * (valorA - valorB)
    })

    return copia
  }, [linhas, sortColuna, sortDir])

  const alternarOrdenacao = (coluna: SortColuna) => {
    if (sortColuna === coluna) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColuna(coluna)
    setSortDir(coluna === 'nome' ? 'asc' : 'desc')
  }

  if (linhas.length === 0) return null

  return (
    <div className={cn(panelClassName, 'mb-2')}>
      <div className="max-h-[10.5rem] overflow-y-auto">
        <table className={RESUMO_TABLE_CLASS}>
          <thead className="sticky top-0 z-10">
            <tr>
              <CabecalhoOrdenavel
                rotulo="Município"
                ativo={sortColuna === 'nome'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('nome')}
              />
              <CabecalhoOrdenavel
                rotulo="Eleitores"
                alinhamento="right"
                ativo={sortColuna === 'eleitores'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('eleitores')}
              />
              <CabecalhoOrdenavel
                rotulo="Votação 2022"
                alinhamento="right"
                ativo={sortColuna === 'votacao2022'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('votacao2022')}
              />
              <CabecalhoOrdenavel
                rotulo="Lideranças"
                alinhamento="right"
                ativo={sortColuna === 'liderancas'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('liderancas')}
              />
              <CabecalhoOrdenavel
                rotulo={labelExpectativa}
                alinhamento="right"
                ativo={sortColuna === 'expectativa2026'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('expectativa2026')}
              />
              <CabecalhoOrdenavel
                rotulo="% exp."
                alinhamento="right"
                ativo={sortColuna === 'percentualExpectativaEleitorado'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('percentualExpectativaEleitorado')}
              />
              <CabecalhoOrdenavel
                rotulo="Δ vs 2022"
                alinhamento="right"
                ativo={sortColuna === 'variacao'}
                dir={sortDir}
                accentClass={sortAccentClass}
                onClick={() => alternarOrdenacao('variacao')}
              />
            </tr>
          </thead>
          <tbody>
            {linhasOrdenadas.map((linha, rowIndex) => {
              const ativa = cidadeAtiva != null && linha.nome === cidadeAtiva
              return (
                <tr
                  key={linha.nome}
                  className={resumoLinhaTabela(rowIndex, { selecionada: ativa })}
                >
                  <td className="p-0">
                    <button
                      type="button"
                      onClick={() => onSelecionarCidade(linha.nome)}
                      className={cn(
                        'flex w-full items-center px-1 py-1 text-left text-xs text-text-primary transition-colors',
                      )}
                    >
                      {linha.nome}
                    </button>
                  </td>
                  <td className={cn(RESUMO_TD_CLASS, 'text-right tabular-nums text-text-primary')}>
                    {linha.eleitores !== null ? formatNum(linha.eleitores) : '—'}
                  </td>
                  <td className={cn(RESUMO_TD_CLASS, 'text-right tabular-nums text-text-primary')}>
                    {formatNum(linha.votacao2022)}
                  </td>
                  <td className="p-0">
                    <button
                      type="button"
                      title="Ver lideranças do município"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAbrirLiderancas(linha.nome)
                      }}
                      className={cn(
                        RESUMO_TD_CLASS,
                        'w-full text-right tabular-nums text-text-primary transition-colors hover:text-accent-gold',
                      )}
                    >
                      {formatNum(linha.liderancas)}
                    </button>
                  </td>
                  <td className={cn(RESUMO_TD_CLASS, 'text-right tabular-nums font-medium text-text-primary')}>
                    {formatNum(linha.expectativa2026)}
                  </td>
                  <td className={cn(RESUMO_TD_CLASS, 'text-right tabular-nums text-text-secondary')}>
                    {formatPercentual(linha.percentualExpectativaEleitorado)}
                  </td>
                  <td
                    className={cn(
                      RESUMO_TD_CLASS,
                      'text-right tabular-nums font-medium',
                      linha.variacao > 0
                        ? 'text-status-success'
                        : linha.variacao < 0
                          ? 'text-status-danger'
                          : 'text-text-primary',
                    )}
                  >
                    {formatVariacao(linha.variacao)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
