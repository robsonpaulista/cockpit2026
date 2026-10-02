'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Vote,
  X,
} from 'lucide-react'
import {
  ResumoLiderancasCrudModal,
  type LiderancaCrudRow,
} from '@/components/resumo-eleicoes/resumo-liderancas-crud-modal'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  TerritorioCidadeExpectativaSortBar,
  TerritorioSortableHeaderButton,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import {
  canonicalizeLiderancaAtual,
  isLiderancaAtualEmDialogo,
  isLiderancaAtualNao,
  isLiderancaAtualSim,
} from '@/lib/territorio-lideranca-atual'
import { VOTOS_ESPONTANEOS_2026 } from '@/lib/territorio-liderancas-espontaneos'
import {
  territorioCxBtnGhostClass,
  territorioCxBtnPrimaryClass,
} from '@/lib/territorio-base-styles'
import { cn } from '@/lib/utils'

type FiltroLiderancaAtual = 'todos' | 'sim' | 'em_dialogo' | 'nao'
type SortCidadeCol = 'cidade' | 'expectativa'

const FILTRO_LIDERANCA_OPCOES: Array<{ id: FiltroLiderancaAtual; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'sim', label: 'Liderança SIM' },
  { id: 'em_dialogo', label: 'Em diálogo' },
  { id: 'nao', label: 'Liderança NÃO' },
]

function filtrarPorLiderancaAtual(
  row: LiderancaCrudRow,
  filtro: FiltroLiderancaAtual,
): boolean {
  if (filtro === 'sim') return isLiderancaAtualSim(row.liderancaAtual)
  if (filtro === 'em_dialogo') {
    return isLiderancaAtualEmDialogo(row.liderancaAtual) || row.emDialogo
  }
  if (filtro === 'nao') return isLiderancaAtualNao(row.liderancaAtual)
  return true
}

type GrupoCidade = {
  cidade: string
  rows: LiderancaCrudRow[]
  totalExpectativa: number
  totalPrevisto: number
}

type ApiResponse = {
  rows?: LiderancaCrudRow[]
  row?: LiderancaCrudRow
  error?: string
  warning?: string
}

type ModalState = {
  cidade: string
  editingId: number | null
  creating: boolean
}

type InlineForm = {
  nome: string
  cargo: string
  depEstadual: string
  governador: string
  liderancaAtual: string
  votos2024: string
  promessa: string
  expectativaLegado: string
  previsto: string
}

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function parseNumero(value: string): number {
  const numero = Number(value.replace(/\./g, '').replace(',', '.').trim())
  return Number.isFinite(numero) ? numero : 0
}

export function LiderancasPanel() {
  const [rows, setRows] = useState<LiderancaCrudRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [filtroLideranca, setFiltroLideranca] = useState<FiltroLiderancaAtual>('todos')
  const [sortCol, setSortCol] = useState<SortCidadeCol>('expectativa')
  const [sortAsc, setSortAsc] = useState(false)
  const [cidadesRecolhidas, setCidadesRecolhidas] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)
  const [selecionandoCidade, setSelecionandoCidade] = useState<boolean>(false)
  const [novaCidade, setNovaCidade] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null)
  const [focusField, setFocusField] = useState<keyof InlineForm | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/territorio/liderancas', { cache: 'no-store' })
      const data = (await response.json()) as ApiResponse
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar lideranças')
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lideranças')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const rowsFiltradas = useMemo(
    () => rows.filter((row) => filtrarPorLiderancaAtual(row, filtroLideranca)),
    [rows, filtroLideranca],
  )

  const cidades = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.municipio.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [rows],
  )

  const grupos = useMemo<GrupoCidade[]>(() => {
    const termo = normalizarBusca(busca)
    const agrupados = new Map<string, LiderancaCrudRow[]>()

    for (const row of rowsFiltradas) {
      const cidade = row.municipio.trim() || 'Município não informado'
      if (
        termo &&
        !normalizarBusca(cidade).includes(termo) &&
        !normalizarBusca(row.nome).includes(termo) &&
        !normalizarBusca(row.cargo).includes(termo)
      ) {
        continue
      }
      const atuais = agrupados.get(cidade) ?? []
      atuais.push(row)
      agrupados.set(cidade, atuais)
    }

    return Array.from(agrupados.entries())
      .map(([cidade, liderancas]) => {
        const ordenadas = [...liderancas].sort((a, b) => {
          if (sortCol === 'cidade') {
            const byNome = compareTerritorioText(a.nome, b.nome, true)
            if (byNome !== 0) return byNome
            return compareTerritorioNumber(a.previsto ?? 0, b.previsto ?? 0, false)
          }
          const byRevisao = compareTerritorioNumber(a.previsto ?? 0, b.previsto ?? 0, sortAsc)
          if (byRevisao !== 0) return byRevisao
          const byExp = compareTerritorioNumber(a.expectativaLegado, b.expectativaLegado, sortAsc)
          if (byExp !== 0) return byExp
          return compareTerritorioText(a.nome, b.nome, true)
        })
        return {
          cidade,
          rows: ordenadas,
          totalExpectativa: ordenadas.reduce(
            (total, lideranca) => total + lideranca.expectativaLegado,
            0,
          ),
          totalPrevisto: ordenadas.reduce(
            (total, lideranca) => total + (lideranca.previsto ?? 0),
            0,
          ),
        }
      })
      .sort((a, b) => {
        if (sortCol === 'cidade') {
          const byCidade = compareTerritorioText(a.cidade, b.cidade, sortAsc)
          if (byCidade !== 0) return byCidade
          return compareTerritorioNumber(a.totalPrevisto, b.totalPrevisto, false)
        }
        const byRevisao = compareTerritorioNumber(a.totalPrevisto, b.totalPrevisto, sortAsc)
        if (byRevisao !== 0) return byRevisao
        const byExp = compareTerritorioNumber(a.totalExpectativa, b.totalExpectativa, sortAsc)
        if (byExp !== 0) return byExp
        return compareTerritorioText(a.cidade, b.cidade, true)
      })
  }, [busca, rowsFiltradas, sortAsc, sortCol])

  const alternarSort = (column: SortCidadeCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['cidade'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const totalExpectativa = useMemo(
    () => rowsFiltradas.reduce((total, row) => total + row.expectativaLegado, 0),
    [rowsFiltradas],
  )
  const totalPrevisto = useMemo(
    () => rowsFiltradas.reduce((total, row) => total + (row.previsto ?? 0), 0),
    [rowsFiltradas],
  )
  const incluiEspontaneos = filtroLideranca === 'todos'
  const kpiExpectativa =
    totalExpectativa + (incluiEspontaneos ? VOTOS_ESPONTANEOS_2026.expectativa : 0)
  const kpiRevisaoFinal =
    totalPrevisto + (incluiEspontaneos ? VOTOS_ESPONTANEOS_2026.revisaoFinal : 0)
  const todasRecolhidas =
    grupos.length > 0 && grupos.every((grupo) => cidadesRecolhidas.has(grupo.cidade))

  const alternarCidade = (cidade: string) => {
    setCidadesRecolhidas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(cidade)) proximas.delete(cidade)
      else proximas.add(cidade)
      return proximas
    })
  }

  const alternarTodas = () => {
    setCidadesRecolhidas(
      todasRecolhidas ? new Set() : new Set(grupos.map((grupo) => grupo.cidade)),
    )
  }

  const iniciarEdicaoInline = (
    lideranca: LiderancaCrudRow,
    campo: keyof InlineForm = 'nome',
  ) => {
    setEditingId(lideranca.id)
    setFocusField(campo)
    setInlineForm({
      nome: lideranca.nome,
      cargo: lideranca.cargo === '-' ? '' : lideranca.cargo,
      depEstadual: lideranca.depEstadual,
      governador: lideranca.governador || 'Rafael',
      liderancaAtual: lideranca.liderancaAtual,
      votos2024: String(lideranca.votos2024 ?? 0),
      promessa: String(lideranca.promessa),
      expectativaLegado: String(lideranca.expectativaLegado),
      previsto: String(lideranca.previsto ?? 0),
    })
    setError(null)
  }

  const cancelarEdicaoInline = () => {
    setEditingId(null)
    setInlineForm(null)
    setFocusField(null)
  }

  const salvarEdicaoInline = async (id: number) => {
    if (!inlineForm?.nome.trim()) {
      setError('Informe o nome da liderança.')
      return
    }
    setSavingId(id)
    setError(null)
    try {
      const response = await fetch(`/api/territorio/liderancas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lideranca: inlineForm.nome.trim(),
          cargo_2024: inlineForm.cargo.trim() || null,
          dep_estadual: inlineForm.depEstadual.trim() || null,
          governador: inlineForm.governador.trim() || null,
          lideranca_atual: canonicalizeLiderancaAtual(inlineForm.liderancaAtual),
          votos_2024: parseNumero(inlineForm.votos2024),
          promessa_lideranca_2026: parseNumero(inlineForm.promessa),
          expectativa_votos_2026: parseNumero(inlineForm.expectativaLegado),
          previsto_2026: parseNumero(inlineForm.previsto),
        }),
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok || !data.row) throw new Error(data.error || 'Erro ao salvar liderança')
      setRows((atuais) => atuais.map((row) => (row.id === id ? data.row! : row)))
      cancelarEdicaoInline()
      if (data.warning) setError(data.warning)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar liderança')
    } finally {
      setSavingId(null)
    }
  }

  const excluirInline = async (lideranca: LiderancaCrudRow) => {
    if (!window.confirm(`Excluir a liderança "${lideranca.nome}"?`)) return
    setSavingId(lideranca.id)
    setError(null)
    try {
      const response = await fetch(`/api/territorio/liderancas/${lideranca.id}`, {
        method: 'DELETE',
      })
      const data = (await response.json()) as ApiResponse
      if (!response.ok) throw new Error(data.error || 'Erro ao excluir liderança')
      setRows((atuais) => atuais.filter((row) => row.id !== lideranca.id))
      if (editingId === lideranca.id) cancelarEdicaoInline()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir liderança')
    } finally {
      setSavingId(null)
    }
  }

  const abrirNovaLideranca = () => {
    const cidade = novaCidade.trim()
    if (!cidade) return
    setSelecionandoCidade(false)
    setModal({ cidade, editingId: null, creating: true })
    setNovaCidade('')
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador
          icon={Users}
          label="Lideranças"
          valor={rowsFiltradas.length.toLocaleString('pt-BR')}
        />
        <Indicador
          icon={MapPin}
          label="Cidades"
          valor={new Set(rowsFiltradas.map((row) => row.municipio.trim()).filter(Boolean)).size.toLocaleString('pt-BR')}
        />
        <Indicador
          icon={Vote}
          label="Expectativa"
          valor={kpiExpectativa.toLocaleString('pt-BR')}
          detalhe={
            incluiEspontaneos
              ? `Inclui ${VOTOS_ESPONTANEOS_2026.expectativa.toLocaleString('pt-BR')} espontâneos`
              : undefined
          }
        />
        <Indicador
          icon={Vote}
          label="Revisão Final"
          valor={kpiRevisaoFinal.toLocaleString('pt-BR')}
          detalhe={
            incluiEspontaneos
              ? `Inclui ${VOTOS_ESPONTANEOS_2026.revisaoFinal.toLocaleString('pt-BR')} espontâneos`
              : undefined
          }
        />
      </div>

      <div className="territorio-cx-filter-strip !mb-0 sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1 sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#969692]"
              aria-hidden
            />
            <input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar cidade, liderança ou cargo"
              className="territorio-cx-input h-10 w-full !bg-white pl-9 pr-9"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#969692] hover:text-[#2b2d31]"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </label>

          <div
            className="inline-flex h-10 shrink-0 items-center rounded-[10px] border border-[#e8e8e6] bg-white p-0.5"
            role="group"
            aria-label="Filtrar por liderança atual"
          >
            {FILTRO_LIDERANCA_OPCOES.map((opcao) => {
              const ativo = filtroLideranca === opcao.id
              return (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => setFiltroLideranca(opcao.id)}
                  aria-pressed={ativo}
                  className={cn(
                    'h-8 rounded-md px-2.5 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs',
                    ativo
                      ? 'territorio-cx-chip-active border border-[#e8a825] bg-[rgba(232,168,37,0.14)] text-[#2b2d31]'
                      : 'text-[#686865] hover:text-[#2b2d31]',
                  )}
                >
                  {opcao.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={alternarTodas}
            disabled={grupos.length === 0}
            className={territorioCxBtnGhostClass}
          >
            {todasRecolhidas ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {todasRecolhidas ? 'Expandir tudo' : 'Recolher tudo'}
          </button>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className={territorioCxBtnGhostClass}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setSelecionandoCidade(true)}
            className={territorioCxBtnPrimaryClass}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova liderança
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando lideranças…
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card px-4 py-12 text-center text-sm text-text-secondary">
          Nenhuma liderança encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          <TerritorioCidadeExpectativaSortBar
            cidadeActive={sortCol === 'cidade'}
            cidadeAsc={sortAsc}
            expectativaActive={sortCol === 'expectativa'}
            expectativaAsc={sortAsc}
            onSortCidade={() => alternarSort('cidade')}
            onSortExpectativa={() => alternarSort('expectativa')}
          />
          {grupos.map((grupo) => {
            const recolhida = cidadesRecolhidas.has(grupo.cidade)
            return (
              <article
                key={grupo.cidade}
                className="territorio-cx-city-group overflow-hidden rounded-xl border border-[#e8e8e6] bg-white shadow-none"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e6] bg-[#f7f7f6] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => alternarCidade(grupo.cidade)}
                    className="flex min-w-0 items-center gap-2 text-left"
                    aria-expanded={!recolhida}
                  >
                    {recolhida ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                    )}
                    <MapPin className="h-4 w-4 shrink-0 text-[#e8a825]" aria-hidden />
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {grupo.cidade}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-text-secondary">
                      {grupo.rows.length}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">
                      Expectativa:{' '}
                      <strong className="tabular-nums text-text-primary">
                        {grupo.totalExpectativa.toLocaleString('pt-BR')} votos
                      </strong>
                    </span>
                    <span className="text-xs text-text-secondary">
                      Revisão Final:{' '}
                      <strong className="tabular-nums text-text-primary">
                        {grupo.totalPrevisto.toLocaleString('pt-BR')} votos
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setModal({ cidade: grupo.cidade, editingId: null, creating: true })
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-card bg-surface px-2 text-[11px] font-medium text-text-primary"
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Adicionar
                    </button>
                  </div>
                </div>

                {!recolhida ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1060px] text-xs">
                      <thead>
                        <tr className="text-text-secondary">
                          <th className="px-4 py-2 text-left font-medium">Liderança</th>
                          <th className="px-3 py-2 text-left font-medium">Cargo</th>
                          <th className="px-3 py-2 text-left font-medium">Dep. Estadual</th>
                          <th className="px-3 py-2 text-left font-medium">Governador</th>
                          <th className="px-3 py-2 text-left font-medium">Situação</th>
                          <th className="px-3 py-2 text-right font-medium">Votos 2024</th>
                          <th className="px-3 py-2 text-right font-medium">Promessa 2026</th>
                          <th className="px-3 py-2 text-right font-medium">Expectativa</th>
                          <th className="px-3 py-2 text-right font-medium">
                            <TerritorioSortableHeaderButton
                              label="Revisão Final"
                              active={sortCol === 'expectativa'}
                              asc={sortAsc}
                              onClick={() => alternarSort('expectativa')}
                              align="right"
                              compact
                              className="w-full"
                            />
                          </th>
                          <th className="w-16 px-3 py-2 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.rows.map((lideranca, index) => {
                          const editando = editingId === lideranca.id && inlineForm
                          const salvando = savingId === lideranca.id
                          return (
                            <tr
                              key={lideranca.id}
                              className={cn(
                                'border-t border-card text-text-primary',
                                index % 2 === 1 && 'bg-background/30',
                                editando && 'bg-[#e8a825]/5',
                              )}
                            >
                              <td
                                className="cursor-pointer px-2 py-1.5 pl-4 font-medium"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'nome')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.nome}
                                    onChange={(value) =>
                                      setInlineForm((form) => form && { ...form, nome: value })
                                    }
                                    ariaLabel="Nome da liderança"
                                    autoFocus={focusField === 'nome'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.nome || '-'
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-text-secondary"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'cargo')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.cargo}
                                    onChange={(value) =>
                                      setInlineForm((form) => form && { ...form, cargo: value })
                                    }
                                    ariaLabel="Cargo"
                                    autoFocus={focusField === 'cargo'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.cargo || '-'
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-text-secondary"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'depEstadual')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.depEstadual}
                                    onChange={(value) =>
                                      setInlineForm(
                                        (form) => form && { ...form, depEstadual: value },
                                      )
                                    }
                                    ariaLabel="Deputado estadual"
                                    autoFocus={focusField === 'depEstadual'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.depEstadual || '-'
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-text-secondary"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'governador')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.governador}
                                    onChange={(value) =>
                                      setInlineForm(
                                        (form) => form && { ...form, governador: value },
                                      )
                                    }
                                    ariaLabel="Governador"
                                    autoFocus={focusField === 'governador'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.governador || '-'
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'liderancaAtual')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <select
                                    value={inlineForm.liderancaAtual}
                                    onChange={(event) =>
                                      setInlineForm(
                                        (form) =>
                                          form && {
                                            ...form,
                                            liderancaAtual: event.target.value,
                                          },
                                      )
                                    }
                                    className={inlineFieldClass}
                                    aria-label="Situação da liderança"
                                  >
                                    <option value="SIM">SIM</option>
                                    <option value="NÃO">NÃO</option>
                                    <option value="EM DIÁLOGO">EM DIÁLOGO</option>
                                  </select>
                                ) : lideranca.emDialogo ? (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-text-primary">
                                    Em diálogo
                                  </span>
                                ) : (
                                  <span className="text-text-secondary">
                                    {lideranca.liderancaAtual || '-'}
                                  </span>
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-right tabular-nums text-text-secondary"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'votos2024')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.votos2024}
                                    onChange={(value) =>
                                      setInlineForm(
                                        (form) => form && { ...form, votos2024: value },
                                      )
                                    }
                                    ariaLabel="Votos 2024"
                                    numeric
                                    autoFocus={focusField === 'votos2024'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  (lideranca.votos2024 ?? 0).toLocaleString('pt-BR')
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-right tabular-nums text-text-secondary"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'promessa')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.promessa}
                                    onChange={(value) =>
                                      setInlineForm((form) => form && { ...form, promessa: value })
                                    }
                                    ariaLabel="Promessa 2026"
                                    numeric
                                    autoFocus={focusField === 'promessa'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.promessa.toLocaleString('pt-BR')
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-right font-semibold tabular-nums"
                                onClick={() => {
                                  if (!editando)
                                    iniciarEdicaoInline(lideranca, 'expectativaLegado')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.expectativaLegado}
                                    onChange={(value) =>
                                      setInlineForm(
                                        (form) =>
                                          form && { ...form, expectativaLegado: value },
                                      )
                                    }
                                    ariaLabel="Expectativa"
                                    numeric
                                    autoFocus={focusField === 'expectativaLegado'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  lideranca.expectativaLegado.toLocaleString('pt-BR')
                                )}
                              </td>
                              <td
                                className="cursor-pointer px-2 py-1.5 text-right font-semibold tabular-nums"
                                onClick={() => {
                                  if (!editando) iniciarEdicaoInline(lideranca, 'previsto')
                                }}
                                title={editando ? undefined : 'Clique para editar'}
                              >
                                {editando ? (
                                  <InlineInput
                                    value={inlineForm.previsto}
                                    onChange={(value) =>
                                      setInlineForm((form) => form && { ...form, previsto: value })
                                    }
                                    ariaLabel="Revisão Final"
                                    numeric
                                    autoFocus={focusField === 'previsto'}
                                    onSave={() => void salvarEdicaoInline(lideranca.id)}
                                    onCancel={cancelarEdicaoInline}
                                  />
                                ) : (
                                  (lideranca.previsto ?? 0).toLocaleString('pt-BR')
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  {editando ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void salvarEdicaoInline(lideranca.id)}
                                        disabled={salvando}
                                        className="rounded p-1.5 text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50"
                                        aria-label={`Salvar ${lideranca.nome}`}
                                        title="Salvar"
                                      >
                                        {salvando ? (
                                          <Loader2
                                            className="h-3.5 w-3.5 animate-spin"
                                            aria-hidden
                                          />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" aria-hidden />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelarEdicaoInline}
                                        disabled={salvando}
                                        className="rounded p-1.5 text-text-secondary hover:bg-background disabled:opacity-50"
                                        aria-label="Cancelar edição"
                                        title="Cancelar"
                                      >
                                        <X className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => iniciarEdicaoInline(lideranca)}
                                        disabled={savingId != null}
                                        className="rounded p-1.5 text-text-secondary hover:bg-background hover:text-text-primary disabled:opacity-50"
                                        aria-label={`Editar ${lideranca.nome}`}
                                        title="Editar na linha"
                                      >
                                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void excluirInline(lideranca)}
                                        disabled={savingId != null}
                                        className="rounded p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                                        aria-label={`Excluir ${lideranca.nome}`}
                                        title="Excluir"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {selecionandoCidade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-card bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Nova liderança</h3>
                <p className="text-xs text-text-secondary">Informe a cidade do cadastro.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionandoCidade(false)}
                className="rounded p-1.5 text-text-secondary hover:bg-background"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <label className="text-xs text-text-secondary">
              Cidade
              <input
                value={novaCidade}
                onChange={(event) => setNovaCidade(event.target.value)}
                list="territorio-liderancas-cidades"
                placeholder="Ex.: Teresina"
                autoFocus
                className="mt-1 h-9 w-full rounded-lg border border-card bg-background px-3 text-sm text-text-primary"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') abrirNovaLideranca()
                }}
              />
              <datalist id="territorio-liderancas-cidades">
                {cidades.map((cidade) => (
                  <option key={cidade} value={cidade} />
                ))}
              </datalist>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelecionandoCidade(false)}
                className="h-8 rounded-lg border border-card px-3 text-xs text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={abrirNovaLideranca}
                disabled={!novaCidade.trim()}
                className={cn(territorioCxBtnPrimaryClass, 'h-8 disabled:opacity-50')}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <ResumoLiderancasCrudModal
          cidade={modal.cidade}
          cenarioVotos="revisao_final"
          initialEditingId={modal.editingId}
          startCreating={modal.creating}
          onClose={() => setModal(null)}
          onChanged={() => void carregar()}
        />
      ) : null}
    </section>
  )
}

const inlineFieldClass =
  'h-7 w-full min-w-[88px] rounded border border-[#e8a825]/50 bg-surface px-1.5 text-xs text-text-primary outline-none focus:border-[#e8a825] focus:ring-1 focus:ring-[#e8a825]/25'

type InlineInputProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  numeric?: boolean
  autoFocus?: boolean
  onSave?: () => void
  onCancel?: () => void
}

function InlineInput({
  value,
  onChange,
  ariaLabel,
  numeric = false,
  autoFocus = false,
  onSave,
  onCancel,
}: InlineInputProps) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      inputMode={numeric ? 'numeric' : 'text'}
      autoFocus={autoFocus}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSave?.()
        if (event.key === 'Escape') onCancel?.()
      }}
      className={cn(inlineFieldClass, numeric && 'text-right tabular-nums')}
    />
  )
}

type IndicadorProps = {
  icon: typeof Users
  label: string
  valor: string
  detalhe?: string
}

function Indicador({ icon: Icon, label, valor, detalhe }: IndicadorProps) {
  return (
    <div className="territorio-cx-kpi relative overflow-hidden">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#969692]" aria-hidden />
        <p className="territorio-cx-kpi__label">{label}</p>
      </div>
      <p className="territorio-cx-kpi__value">{valor}</p>
      {detalhe ? <p className="mt-1 text-[10px] text-[#969692]">{detalhe}</p> : null}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[#e8a825]"
        aria-hidden
      />
    </div>
  )
}
