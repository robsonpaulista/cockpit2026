'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import {
  ResumoLiderancasCrudModal,
  type LiderancaCrudRow,
} from '@/components/resumo-eleicoes/resumo-liderancas-crud-modal'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import {
  MUNICIPIOS_PI_ORDENADOS,
  useCidadesExpandidas,
  useTerritorioMunicipio,
} from '@/components/territorio-campo/territorio-municipio-context'
import {
  canonicalizeLiderancaAtual,
  isLiderancaAtualEmDialogo,
  isLiderancaAtualNao,
  isLiderancaAtualSim,
} from '@/lib/territorio-lideranca-atual'
import { VOTOS_ESPONTANEOS_2026 } from '@/lib/territorio-liderancas-espontaneos'
import { cn } from '@/lib/utils'
import {
  TseBarraRotulo,
  TseBarraValor,
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseChevronCelula,
  TseDado,
  TseDados,
  TseErro,
  TseListaFiltro,
  TseRank,
  TseSegmentado,
  TseStatus,
  TseThOrdenavel,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
  tseTabela,
} from '@/components/tse/tse-ui'

type FiltroLiderancaAtual = 'todos' | 'sim' | 'em_dialogo' | 'nao'
type SortCol = 'cidade' | 'liderancas' | 'expectativa' | 'previsto'

const PAGE_SIZE = 30
const TOTAL_MUNICIPIOS_PI = 224

const SITUACOES: Array<{ id: Exclude<FiltroLiderancaAtual, 'todos'>; label: string; cor: string }> = [
  { id: 'sim', label: 'Liderança SIM', cor: 'var(--tse-green)' },
  { id: 'em_dialogo', label: 'Em diálogo', cor: 'var(--tse-yellow)' },
  { id: 'nao', label: 'Liderança NÃO', cor: 'var(--tse-zero)' },
]

const FILTRO_OPCOES: Array<{ id: FiltroLiderancaAtual; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'sim', label: 'SIM' },
  { id: 'em_dialogo', label: 'Em diálogo' },
  { id: 'nao', label: 'NÃO' },
]

function filtrarPorLiderancaAtual(row: LiderancaCrudRow, filtro: FiltroLiderancaAtual): boolean {
  if (filtro === 'sim') return isLiderancaAtualSim(row.liderancaAtual)
  if (filtro === 'em_dialogo') return isLiderancaAtualEmDialogo(row.liderancaAtual) || row.emDialogo
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

const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function normalizarBusca(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

function parseNumero(value: string): number {
  const numero = Number(value.replace(/\./g, '').replace(',', '.').trim())
  return Number.isFinite(numero) ? numero : 0
}

export function LiderancasPanel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [rows, setRows] = useState<LiderancaCrudRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [filtroLideranca, setFiltroLideranca] = useState<FiltroLiderancaAtual>('todos')
  const [sortCol, setSortCol] = useState<SortCol>('previsto')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
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

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [municipio])

  const rowsNoMunicipio = useMemo(() => rows.filter((row) => noMunicipio(row.municipio)), [rows, noMunicipio])

  const rowsFiltradas = useMemo(
    () => rowsNoMunicipio.filter((row) => filtrarPorLiderancaAtual(row, filtroLideranca)),
    [rowsNoMunicipio, filtroLideranca],
  )

  const cidadesCadastro = useMemo(
    () =>
      Array.from(
        new Set([...MUNICIPIOS_PI_ORDENADOS, ...rows.map((row) => row.municipio.trim()).filter(Boolean)]),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
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

    return Array.from(agrupados.entries()).map(([cidade, liderancas]) => ({
      cidade,
      rows: [...liderancas].sort(
        (a, b) =>
          compareTerritorioNumber(a.previsto ?? 0, b.previsto ?? 0, false) ||
          compareTerritorioNumber(a.expectativaLegado, b.expectativaLegado, false) ||
          compareTerritorioText(a.nome, b.nome, true),
      ),
      totalExpectativa: liderancas.reduce((total, l) => total + l.expectativaLegado, 0),
      totalPrevisto: liderancas.reduce((total, l) => total + (l.previsto ?? 0), 0),
    }))
  }, [busca, rowsFiltradas])

  const gruposOrdenados = useMemo(
    () =>
      [...grupos].sort((a, b) => {
        const porNome = compareTerritorioText(a.cidade, b.cidade, true)
        if (sortCol === 'cidade') return compareTerritorioText(a.cidade, b.cidade, sortAsc)
        if (sortCol === 'liderancas') return compareTerritorioNumber(a.rows.length, b.rows.length, sortAsc) || porNome
        if (sortCol === 'expectativa') {
          return compareTerritorioNumber(a.totalExpectativa, b.totalExpectativa, sortAsc) || porNome
        }
        return (
          compareTerritorioNumber(a.totalPrevisto, b.totalPrevisto, sortAsc) ||
          compareTerritorioNumber(a.totalExpectativa, b.totalExpectativa, sortAsc) ||
          porNome
        )
      }),
    [grupos, sortCol, sortAsc],
  )

  const rank = useMemo(
    () =>
      new Map(
        [...grupos]
          .sort((a, b) => b.totalPrevisto - a.totalPrevisto || compareTerritorioText(a.cidade, b.cidade, true))
          .map((g, i) => [g.cidade, i + 1]),
      ),
    [grupos],
  )

  const chavesCidades = useMemo(() => grupos.map((g) => g.cidade), [grupos])
  const { expandidas, alternar, todasAbertas, alternarTodas } = useCidadesExpandidas(chavesCidades, !loading)

  const alternarSort = (column: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['cidade'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const totalExpectativa = rowsFiltradas.reduce((total, row) => total + row.expectativaLegado, 0)
  const totalPrevisto = rowsFiltradas.reduce((total, row) => total + (row.previsto ?? 0), 0)
  // Espontâneos não têm cidade: só entram no total do Piauí sem filtro de situação.
  const incluiEspontaneos = filtroLideranca === 'todos' && !municipio
  const kpiExpectativa = totalExpectativa + (incluiEspontaneos ? VOTOS_ESPONTANEOS_2026.expectativa : 0)
  const kpiRevisaoFinal = totalPrevisto + (incluiEspontaneos ? VOTOS_ESPONTANEOS_2026.revisaoFinal : 0)
  const maxExpectativa = grupos.reduce((m, g) => Math.max(m, g.totalExpectativa), 0)
  const maxPrevisto = grupos.reduce((m, g) => Math.max(m, g.totalPrevisto), 0)
  const cidadesCount = new Set(rowsFiltradas.map((row) => row.municipio.trim()).filter(Boolean)).size
  const universo = municipio ? 1 : TOTAL_MUNICIPIOS_PI
  const pctCobertura = (Math.min(cidadesCount, universo) / universo) * 100
  const escopoLabel = municipio ?? 'Piauí'
  const contagemSituacao = SITUACOES.map((s) => ({
    ...s,
    valor: rowsNoMunicipio.filter((row) => filtrarPorLiderancaAtual(row, s.id)).length,
  }))

  const iniciarEdicaoInline = (lideranca: LiderancaCrudRow, campo: keyof InlineForm = 'nome') => {
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
      const salvo = data.row
      if (!response.ok || !salvo) throw new Error(data.error || 'Erro ao salvar liderança')
      setRows((atuais) => atuais.map((row) => (row.id === id ? salvo : row)))
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
      const response = await fetch(`/api/territorio/liderancas/${lideranca.id}`, { method: 'DELETE' })
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

  const abrirSeletorCidade = () => {
    setNovaCidade(municipio ?? '')
    setSelecionandoCidade(true)
  }

  const abrirNovaLideranca = () => {
    const cidade = novaCidade.trim()
    if (!cidade) return
    setSelecionandoCidade(false)
    setModal({ cidade, editingId: null, creating: true })
    setNovaCidade('')
  }

  /** Célula editável: clique entra em edição focando este campo. */
  const celula = (
    lideranca: LiderancaCrudRow,
    campo: keyof InlineForm,
    exibicao: ReactNode,
    opts: { rotulo: string; numerico?: boolean; className?: string },
  ) => {
    const editando = editingId === lideranca.id && inlineForm
    return (
      <td
        className={cn('cursor-pointer px-2 py-1.5', opts.numerico && 'text-right tabular-nums', opts.className)}
        onClick={() => {
          if (!editando) iniciarEdicaoInline(lideranca, campo)
        }}
        title={editando ? undefined : 'Clique para editar'}
      >
        {editando ? (
          <InlineInput
            value={inlineForm[campo]}
            onChange={(value) => setInlineForm((form) => form && { ...form, [campo]: value })}
            ariaLabel={opts.rotulo}
            numeric={opts.numerico}
            autoFocus={focusField === campo}
            onSave={() => void salvarEdicaoInline(lideranca.id)}
            onCancel={cancelarEdicaoInline}
          />
        ) : (
          exibicao
        )}
      </td>
    )
  }

  const situacaoBadge = (lideranca: LiderancaCrudRow) => {
    if (lideranca.emDialogo || isLiderancaAtualEmDialogo(lideranca.liderancaAtual)) {
      return <TseStatus cor="var(--tse-yellow)">Em diálogo</TseStatus>
    }
    if (isLiderancaAtualSim(lideranca.liderancaAtual)) return <TseStatus cor="var(--tse-green)">SIM</TseStatus>
    if (isLiderancaAtualNao(lideranca.liderancaAtual)) return <TseStatus cor="var(--tse-zero)">NÃO</TseStatus>
    return <span className="text-[var(--tse-muted)]">{lideranca.liderancaAtual || '—'}</span>
  }

  if (loading && rows.length === 0) return <TseCarregando texto="Carregando lideranças…" />

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-4">
          <section className={tseCardClass}>
            <h2 className="text-xl font-bold">Dados Gerais</h2>
            <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">Cadastro de lideranças · {escopoLabel}</p>
            <TseDados>
              <TseDado rotulo="Lideranças" valor={fmt(rowsFiltradas.length)} sufixo={`/ ${fmt(rowsNoMunicipio.length)}`} />
              <TseDado rotulo="Cidades" valor={fmt(cidadesCount)} sufixo={`/ ${fmt(universo)}`} />
              <TseDado rotulo="Expectativa" valor={fmt(kpiExpectativa)} />
              <TseDado rotulo="Revisão final" valor={fmt(kpiRevisaoFinal)} />
            </TseDados>
            <TseBarraRotulo pct={pctCobertura} rotulo={fmtPct(pctCobertura)} />
            <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Cobertura de municípios</p>
            {incluiEspontaneos ? (
              <p className="mt-3 rounded-lg bg-[var(--tse-bar)] p-3 text-[11px] text-[var(--tse-muted)]">
                Totais incluem votos espontâneos: {fmt(VOTOS_ESPONTANEOS_2026.expectativa)} na expectativa e{' '}
                {fmt(VOTOS_ESPONTANEOS_2026.revisaoFinal)} na revisão final.
              </p>
            ) : null}
          </section>

          <TseListaFiltro
            titulo="Situação"
            itens={contagemSituacao}
            ativo={filtroLideranca === 'todos' ? null : filtroLideranca}
            onChange={(id) => setFiltroLideranca(id ?? 'todos')}
          />
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TseSegmentado opcoes={FILTRO_OPCOES} valor={filtroLideranca} onChange={setFiltroLideranca} />
            <div className="flex flex-wrap items-center gap-2">
              <TseBusca value={busca} onChange={setBusca} placeholder="Buscar liderança ou cargo" />
              <button type="button" onClick={() => void carregar()} disabled={loading} className={tseBotaoCinzaClass}>
                <RefreshCw className={cn(tseBotaoIconeClass, loading && 'animate-spin')} />
                Atualizar
              </button>
              <button type="button" onClick={abrirSeletorCidade} className={tseBotaoPrimarioClass}>
                <Plus className="h-4 w-4" />
                Nova liderança
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-3">
              <TseErro>{error}</TseErro>
            </div>
          ) : null}

          <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold uppercase">Lideranças</p>
                <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                  {escopoLabel}
                </span>
              </div>
              <p className="text-[15px] text-[var(--tse-muted)]">
                {fmt(rowsFiltradas.length)} lideranças em {fmt(cidadesCount)} {cidadesCount === 1 ? 'cidade' : 'cidades'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{fmt(kpiExpectativa)}</p>
              <p className="text-[13px] text-[var(--tse-muted)]">expectativa</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{fmt(kpiRevisaoFinal)}</p>
              <p className="text-[13px] text-[var(--tse-muted)]">revisão final</p>
            </div>
          </section>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
            <p>
              {fmt(grupos.length)} {grupos.length === 1 ? 'município' : 'municípios'}
              {busca.trim() ? ' encontrados' : ''} · clique numa liderança para editar na linha
            </p>
            {grupos.length > 0 ? (
              <button type="button" onClick={alternarTodas} className={tseLinkAcaoClass}>
                {todasAbertas ? 'Recolher todas' : 'Expandir todas'}
              </button>
            ) : null}
          </div>

          {gruposOrdenados.length === 0 ? (
            <div className="mt-3">
              <TseVazio>
                {municipio ? `Nenhuma liderança encontrada em ${municipio}.` : 'Nenhuma liderança encontrada.'}
              </TseVazio>
            </div>
          ) : (
            <>
              <div className={cn('mt-3', tseTabela.container)}>
                <table className={tseTabela.table} data-tse-tabela>
                  <thead className={tseTabela.thead}>
                    <tr>
                      <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
                      <TseThOrdenavel col="cidade" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                        Município
                      </TseThOrdenavel>
                      <TseThOrdenavel col="liderancas" alinhar="right" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                        Lideranças
                      </TseThOrdenavel>
                      <TseThOrdenavel
                        col="expectativa"
                        alinhar="right"
                        className="w-[200px]"
                        sortCol={sortCol}
                        sortAsc={sortAsc}
                        onSort={alternarSort}
                      >
                        Expectativa
                      </TseThOrdenavel>
                      <TseThOrdenavel
                        col="previsto"
                        alinhar="right"
                        className="w-[200px]"
                        sortCol={sortCol}
                        sortAsc={sortAsc}
                        onSort={alternarSort}
                      >
                        Revisão final
                      </TseThOrdenavel>
                      <th className="px-3 py-2.5 text-right">Ações</th>
                      <th className="w-10 px-2 py-2.5" aria-label="Expandir" />
                    </tr>
                  </thead>
                  <tbody>
                    {gruposOrdenados.slice(0, limite).map((grupo) => {
                      const aberta = expandidas.has(grupo.cidade)
                      return (
                        <GrupoLinhas
                          key={grupo.cidade}
                          grupo={grupo}
                          aberta={aberta}
                          posicao={rank.get(grupo.cidade) ?? 0}
                          maxExpectativa={maxExpectativa}
                          maxPrevisto={maxPrevisto}
                          onToggle={() => alternar(grupo.cidade)}
                          onAdicionar={() => setModal({ cidade: grupo.cidade, editingId: null, creating: true })}
                        >
                          {grupo.rows.map((lideranca) => {
                            const editando = editingId === lideranca.id && inlineForm
                            const salvando = savingId === lideranca.id
                            return (
                              <tr
                                key={lideranca.id}
                                className={cn('border-t border-[#EEEEEE]', editando && 'bg-[var(--tse-yellow-soft)]')}
                              >
                                {celula(lideranca, 'nome', lideranca.nome || '—', {
                                  rotulo: 'Nome da liderança',
                                  className: 'pl-4 font-semibold',
                                })}
                                {celula(lideranca, 'cargo', lideranca.cargo || '—', {
                                  rotulo: 'Cargo',
                                  className: 'text-[var(--tse-muted)]',
                                })}
                                {celula(lideranca, 'depEstadual', lideranca.depEstadual || '—', {
                                  rotulo: 'Deputado estadual',
                                  className: 'text-[var(--tse-muted)]',
                                })}
                                {celula(lideranca, 'governador', lideranca.governador || '—', {
                                  rotulo: 'Governador',
                                  className: 'text-[var(--tse-muted)]',
                                })}
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
                                        setInlineForm((form) => form && { ...form, liderancaAtual: event.target.value })
                                      }
                                      className={inlineFieldClass}
                                      aria-label="Situação da liderança"
                                    >
                                      <option value="SIM">SIM</option>
                                      <option value="NÃO">NÃO</option>
                                      <option value="EM DIÁLOGO">EM DIÁLOGO</option>
                                    </select>
                                  ) : (
                                    situacaoBadge(lideranca)
                                  )}
                                </td>
                                {celula(lideranca, 'votos2024', fmt(lideranca.votos2024 ?? 0), {
                                  rotulo: 'Votos 2024',
                                  numerico: true,
                                  className: 'text-[var(--tse-muted)]',
                                })}
                                {celula(lideranca, 'promessa', fmt(lideranca.promessa), {
                                  rotulo: 'Promessa 2026',
                                  numerico: true,
                                  className: 'text-[var(--tse-muted)]',
                                })}
                                {celula(lideranca, 'expectativaLegado', fmt(lideranca.expectativaLegado), {
                                  rotulo: 'Expectativa',
                                  numerico: true,
                                  className: 'font-bold',
                                })}
                                {celula(lideranca, 'previsto', fmt(lideranca.previsto ?? 0), {
                                  rotulo: 'Revisão final',
                                  numerico: true,
                                  className: 'font-bold',
                                })}
                                <td className="px-2 py-1.5 text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    {editando ? (
                                      <>
                                        <IconeAcao
                                          rotulo="Salvar"
                                          onClick={() => void salvarEdicaoInline(lideranca.id)}
                                          disabled={salvando}
                                          className="text-[var(--tse-olive)] hover:bg-[#F3F7E6]"
                                        >
                                          {salvando ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Check className="h-3.5 w-3.5" />
                                          )}
                                        </IconeAcao>
                                        <IconeAcao rotulo="Cancelar" onClick={cancelarEdicaoInline} disabled={salvando}>
                                          <X className="h-3.5 w-3.5" />
                                        </IconeAcao>
                                      </>
                                    ) : (
                                      <>
                                        <IconeAcao
                                          rotulo={`Editar ${lideranca.nome}`}
                                          onClick={() => iniciarEdicaoInline(lideranca)}
                                          disabled={savingId != null}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </IconeAcao>
                                        <IconeAcao
                                          rotulo={`Excluir ${lideranca.nome}`}
                                          onClick={() => void excluirInline(lideranca)}
                                          disabled={savingId != null}
                                          className="hover:bg-red-50 hover:text-red-600"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </IconeAcao>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </GrupoLinhas>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <TseCarregarMais restantes={gruposOrdenados.length - limite} onClick={() => setLimite((n) => n + PAGE_SIZE)} />
            </>
          )}
        </main>
      </div>

      {selecionandoCidade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-[#333333] shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold">Nova liderança</h3>
                <p className="text-[12px] text-[#717171]">Informe a cidade do cadastro.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionandoCidade(false)}
                className="rounded p-1.5 text-[#717171] hover:bg-[#F4F4F2]"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block">
              <span className={tseRotuloCampoClass}>Cidade</span>
              <input
                value={novaCidade}
                onChange={(event) => setNovaCidade(event.target.value)}
                list="territorio-liderancas-cidades"
                placeholder="Ex.: Teresina"
                autoFocus
                className={tseCampoClass}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') abrirNovaLideranca()
                }}
              />
              <datalist id="territorio-liderancas-cidades">
                {cidadesCadastro.map((cidade) => (
                  <option key={cidade} value={cidade} />
                ))}
              </datalist>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSelecionandoCidade(false)} className={tseBotaoCinzaClass}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={abrirNovaLideranca}
                disabled={!novaCidade.trim()}
                className={tseBotaoPrimarioClass}
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
    </>
  )
}

function GrupoLinhas({
  grupo,
  aberta,
  posicao,
  maxExpectativa,
  maxPrevisto,
  onToggle,
  onAdicionar,
  children,
}: {
  grupo: GrupoCidade
  aberta: boolean
  posicao: number
  maxExpectativa: number
  maxPrevisto: number
  onToggle: () => void
  onAdicionar: () => void
  children: ReactNode
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={aberta}
        className={cn(tseTabela.trClicavel, aberta && 'bg-[var(--tse-yellow-soft)]')}
      >
        <td className="px-3 py-2 text-center">
          <TseRank posicao={posicao} />
        </td>
        <td className="px-3 py-2 font-bold uppercase">{grupo.cidade}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmt(grupo.rows.length)}</td>
        <td className="px-3 py-2">
          <TseBarraValor
            valor={grupo.totalExpectativa}
            max={maxExpectativa}
            formatado={fmt(grupo.totalExpectativa)}
            cor="amarelo"
          />
        </td>
        <td className="px-3 py-2">
          <TseBarraValor valor={grupo.totalPrevisto} max={maxPrevisto} formatado={fmt(grupo.totalPrevisto)} />
        </td>
        <td className="px-3 py-2 text-right">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAdicionar()
            }}
            className={tseLinkAcaoClass}
          >
            Adicionar
          </button>
        </td>
        <TseChevronCelula aberta={aberta} />
      </tr>
      {aberta ? (
        <tr className="bg-[var(--tse-bar)]">
          <td colSpan={7} className="px-3 pb-3 pt-1">
            <div className="overflow-x-auto rounded-lg bg-white">
              <table className="w-full min-w-[1000px] text-[12px]" data-tse-tabela>
                <thead className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                  <tr>
                    <th className="px-2 py-2 pl-4">Liderança</th>
                    <th className="px-2 py-2">Cargo</th>
                    <th className="px-2 py-2">Dep. estadual</th>
                    <th className="px-2 py-2">Governador</th>
                    <th className="px-2 py-2">Situação</th>
                    <th className="px-2 py-2 text-right">Votos 2024</th>
                    <th className="px-2 py-2 text-right">Promessa 2026</th>
                    <th className="px-2 py-2 text-right">Expectativa</th>
                    <th className="px-2 py-2 text-right">Revisão final</th>
                    <th className="w-16 px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>{children}</tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function IconeAcao({
  rotulo,
  onClick,
  disabled,
  className,
  children,
}: {
  rotulo: string
  onClick: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
      className={cn(
        'rounded p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)] disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  )
}

const inlineFieldClass =
  'h-7 w-full min-w-[88px] rounded border border-[var(--tse-yellow)] bg-white px-1.5 text-[12px] text-[var(--tse-text)] outline-none focus:ring-2 focus:ring-[var(--tse-yellow-soft)]'

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
