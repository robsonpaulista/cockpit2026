'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { useTerritorioMunicipio } from '@/components/territorio-campo/territorio-municipio-context'
import {
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseErro,
  TsePill,
  TseSegmentado,
  TseStatus,
  TseThOrdenavel,
  TseVazio,
  tseCardClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import type { LiderancaDepEstadual2026Row } from '@/lib/territorio-campo/liderancas-dep-estadual-2026'
import {
  canonicalizeLiderancaAtual,
  isLiderancaAtualEmDialogo,
  isLiderancaAtualNao,
  isLiderancaAtualSim,
} from '@/lib/territorio-lideranca-atual'
import { cn } from '@/lib/utils'

type FiltroLiderancaAtual = 'todos' | 'sim' | 'em_dialogo' | 'nao'
type FiltroDepEstadual = 'todos' | 'com_dep' | 'sem_dep'
type SortCol = 'municipio' | 'lideranca' | 'dep' | 'votos' | 'partido' | 'situacao'

const PAGE_SIZE = 40
const TEXT_SORT_COLS: readonly SortCol[] = [
  'municipio',
  'lideranca',
  'dep',
  'partido',
  'situacao',
]

const FILTRO_SIT_OPCOES: Array<{ id: FiltroLiderancaAtual; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'sim', label: 'SIM' },
  { id: 'em_dialogo', label: 'Em diálogo' },
  { id: 'nao', label: 'NÃO' },
]

const FILTRO_DEP_OPCOES: Array<{ id: FiltroDepEstadual; label: string }> = [
  { id: 'todos', label: 'Todos dep.' },
  { id: 'com_dep', label: 'Com dep. est.' },
  { id: 'sem_dep', label: 'Sem dep. estadual' },
]

function filtrarPorLiderancaAtual(
  row: LiderancaDepEstadual2026Row,
  filtro: FiltroLiderancaAtual,
): boolean {
  if (filtro === 'sim') return isLiderancaAtualSim(row.liderancaAtual)
  if (filtro === 'em_dialogo') return isLiderancaAtualEmDialogo(row.liderancaAtual) || row.emDialogo
  if (filtro === 'nao') return isLiderancaAtualNao(row.liderancaAtual)
  return true
}

function filtrarPorDepEstadual(
  row: LiderancaDepEstadual2026Row,
  filtro: FiltroDepEstadual,
): boolean {
  if (filtro === 'com_dep') return Boolean(row.depEstadual)
  if (filtro === 'sem_dep') return !row.depEstadual
  return true
}

type ApiResponse = {
  rows?: LiderancaDepEstadual2026Row[]
  total?: number
  comDepEstadual?: number
  comMatch?: number
  error?: string
}

const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR')

function normalizarBusca(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function corSituacaoEleicao(situacao: string | null): string {
  const t = String(situacao || '')
  if (/\beleito\b/i.test(t) && !/\bnao\s+eleito\b/i.test(t)) return 'var(--tse-yellow)'
  if (/suplente/i.test(t)) return 'var(--tse-green)'
  return 'var(--tse-zero)'
}

function corLideranca(row: LiderancaDepEstadual2026Row): string {
  const sit = canonicalizeLiderancaAtual(row.liderancaAtual)
  if (isLiderancaAtualSim(sit)) return 'var(--tse-green)'
  if (isLiderancaAtualEmDialogo(sit) || row.emDialogo) return 'var(--tse-yellow)'
  if (isLiderancaAtualNao(sit)) return 'var(--tse-zero)'
  return 'var(--tse-muted)'
}

export function LiderancasDepEstadual2026Panel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [rows, setRows] = useState<LiderancaDepEstadual2026Row[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [filtroLideranca, setFiltroLideranca] = useState<FiltroLiderancaAtual>('todos')
  const [filtroDep, setFiltroDep] = useState<FiltroDepEstadual>('todos')
  const [sortCol, setSortCol] = useState<SortCol>('votos')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [meta, setMeta] = useState<{ total: number; comDep: number; comMatch: number }>({
    total: 0,
    comDep: 0,
    comMatch: 0,
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/territorio/liderancas/resultado-dep-estadual-2026', {
        cache: 'no-store',
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar resultado')
      setRows(Array.isArray(data.rows) ? data.rows : [])
      setMeta({
        total: Number(data.total) || 0,
        comDep: Number(data.comDepEstadual) || 0,
        comMatch: Number(data.comMatch) || 0,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar resultado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [municipio, filtroLideranca, filtroDep, busca])

  const rowsNoMunicipio = useMemo(
    () => rows.filter((row) => noMunicipio(row.municipio)),
    [rows, noMunicipio],
  )

  const rowsPorFiltros = useMemo(
    () =>
      rowsNoMunicipio
        .filter((row) => filtrarPorLiderancaAtual(row, filtroLideranca))
        .filter((row) => filtrarPorDepEstadual(row, filtroDep)),
    [filtroDep, filtroLideranca, rowsNoMunicipio],
  )

  const rowsFiltradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    if (!termo) return rowsPorFiltros
    return rowsPorFiltros.filter(
      (row) =>
        normalizarBusca(row.municipio).includes(termo) ||
        normalizarBusca(row.nome).includes(termo) ||
        normalizarBusca(row.depEstadual).includes(termo) ||
        normalizarBusca(row.urnaMatch || '').includes(termo) ||
        normalizarBusca(row.partido || '').includes(termo),
    )
  }, [busca, rowsPorFiltros])

  const rowsOrdenadas = useMemo(() => {
    return [...rowsFiltradas].sort((a, b) => {
      const porCidade = compareTerritorioText(a.municipio, b.municipio, true)
      const porNome = compareTerritorioText(a.nome, b.nome, true)
      if (sortCol === 'municipio') {
        return compareTerritorioText(a.municipio, b.municipio, sortAsc) || porNome
      }
      if (sortCol === 'lideranca') {
        return compareTerritorioText(a.nome, b.nome, sortAsc) || porCidade
      }
      if (sortCol === 'dep') {
        return (
          compareTerritorioText(a.depEstadual || 'zzz', b.depEstadual || 'zzz', sortAsc) ||
          porCidade
        )
      }
      if (sortCol === 'partido') {
        return (
          compareTerritorioText(a.partido || 'zzz', b.partido || 'zzz', sortAsc) || porCidade
        )
      }
      if (sortCol === 'situacao') {
        return (
          compareTerritorioText(a.situacao || 'zzz', b.situacao || 'zzz', sortAsc) || porCidade
        )
      }
      return (
        compareTerritorioNumber(a.votos2026 ?? -1, b.votos2026 ?? -1, sortAsc) ||
        porCidade ||
        porNome
      )
    })
  }, [rowsFiltradas, sortAsc, sortCol])

  const visiveis = rowsOrdenadas.slice(0, limite)
  const restantes = rowsOrdenadas.length - limite

  const resumoMunicipio = useMemo(() => {
    const comVotos = rowsPorFiltros.filter((r) => r.votos2026 != null)
    return {
      total: rowsPorFiltros.length,
      comDep: rowsPorFiltros.filter((r) => r.depEstadual).length,
      comMatch: comVotos.length,
    }
  }, [rowsPorFiltros])

  const alternarSort = (col: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, col, TEXT_SORT_COLS)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  if (loading) return <TseCarregando texto="Cruzando lideranças com votos 2026…" />
  if (error) {
    return (
      <div className="mt-4 space-y-3">
        <TseErro>{error}</TseErro>
        <button
          type="button"
          onClick={() => void carregar()}
          className="text-[13px] font-semibold text-[var(--tse-text)] underline"
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-4">
      <section className={tseCardClass}>
        <h2 className="text-xl font-bold">Dep. estadual 2026</h2>
        <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
          Votos nominais do deputado estadual cadastrado na liderança, na cidade dela
          {municipio ? ` · filtro: ${municipio}` : ''}.
        </p>
        <TseDados>
          <TseDado rotulo="Lideranças" valor={fmt(resumoMunicipio.total)} />
          <TseDado rotulo="Com dep. estadual" valor={fmt(resumoMunicipio.comDep)} />
          <TseDado rotulo="Com match 2026" valor={fmt(resumoMunicipio.comMatch)} />
        </TseDados>
        {!municipio && meta.total > 0 ? (
          <p className="mt-3 text-[11px] text-[var(--tse-muted)]">
            Cadastro completo: {fmt(meta.total)} · {fmt(meta.comDep)} com dep. · {fmt(meta.comMatch)}{' '}
            casados.
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <TseSegmentado
            opcoes={FILTRO_SIT_OPCOES}
            valor={filtroLideranca}
            onChange={setFiltroLideranca}
          />
          <TseSegmentado
            opcoes={FILTRO_DEP_OPCOES}
            valor={filtroDep}
            onChange={setFiltroDep}
          />
        </div>
        <TseBusca
          value={busca}
          onChange={setBusca}
          placeholder="Buscar liderança, município ou dep. estadual…"
          className="w-full sm:w-72"
        />
      </div>

      {rowsOrdenadas.length === 0 ? (
        <TseVazio>Nenhuma liderança neste filtro.</TseVazio>
      ) : (
        <div className={tseTabela.container}>
          <table className={tseTabela.table} data-tse-tabela>
            <thead className={tseTabela.thead}>
              <tr>
                <TseThOrdenavel
                  col="municipio"
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={alternarSort}
                >
                  Município
                </TseThOrdenavel>
                <TseThOrdenavel
                  col="lideranca"
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={alternarSort}
                >
                  Liderança
                </TseThOrdenavel>
                <TseThOrdenavel col="dep" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                  Dep. estadual
                </TseThOrdenavel>
                <TseThOrdenavel
                  col="votos"
                  alinhar="right"
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={alternarSort}
                >
                  Votos 2026
                </TseThOrdenavel>
                <TseThOrdenavel
                  col="partido"
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={alternarSort}
                >
                  Partido
                </TseThOrdenavel>
                <TseThOrdenavel
                  col="situacao"
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={alternarSort}
                >
                  Situação
                </TseThOrdenavel>
                <th className={tseTabela.th}>Sit. liderança</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((row) => {
                const sitLabel = canonicalizeLiderancaAtual(row.liderancaAtual) || '—'
                return (
                  <tr key={row.id} className={tseTabela.tr}>
                    <td className={tseTabela.td}>{row.municipio || '—'}</td>
                    <td className={tseTabela.td}>
                      <div className="font-medium text-[var(--tse-text)]">{row.nome}</div>
                      {row.cargo && row.cargo !== '-' ? (
                        <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">{row.cargo}</div>
                      ) : null}
                    </td>
                    <td className={tseTabela.td}>
                      {row.depEstadual ? (
                        <div>
                          <div className="font-medium text-[var(--tse-text)]">{row.depEstadual}</div>
                          {row.urnaMatch &&
                          normalizarBusca(row.urnaMatch) !== normalizarBusca(row.depEstadual) ? (
                            <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
                              Urna: {row.urnaMatch}
                              {row.numeroUrna ? ` · ${row.numeroUrna}` : ''}
                            </div>
                          ) : row.numeroUrna ? (
                            <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
                              Nº {row.numeroUrna}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[var(--tse-zero)]">—</span>
                      )}
                    </td>
                    <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                      {row.votos2026 != null ? (
                        <span className="font-semibold text-[var(--tse-text)]">
                          {fmt(row.votos2026)}
                        </span>
                      ) : row.depEstadual ? (
                        <TsePill tom="neutro">Sem match</TsePill>
                      ) : (
                        <span className="text-[var(--tse-zero)]">—</span>
                      )}
                    </td>
                    <td className={tseTabela.td}>{row.partido || '—'}</td>
                    <td className={tseTabela.td}>
                      {row.situacao ? (
                        <TseStatus cor={corSituacaoEleicao(row.situacao)}>{row.situacao}</TseStatus>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={tseTabela.td}>
                      <TseStatus cor={corLideranca(row)}>{sitLabel}</TseStatus>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TseCarregarMais restantes={restantes} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
    </div>
  )
}
