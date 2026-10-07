'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Columns2, Copy, FileSpreadsheet, FileText, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import { cn, formatDateShort } from '@/lib/utils'
import {
  EMENDAS_LIST_COLUMN_KEYS,
  EMENDAS_LIST_COLUMN_LABELS,
  emendasDefaultVisibleColumnsRecord,
  exportEmendasListToPdf,
  exportEmendasListToXlsx,
  type EmendaListColumnKey,
} from '@/lib/emendas-list-export'
import { excluirEmenda, fetchEmendas, type Emenda } from '@/lib/services/emendas-client'
import { EmendaModal, type EmendaModalModo } from '@/components/emendas/emenda-modal'
import {
  TseBarraRotulo,
  TseBusca,
  TseCarregando,
  TseCarregarMais,
  TseErro,
  TseFilterBar,
  TseMenu,
  TsePage,
  TsePillSelect,
  TseSegmentado,
  TseThOrdenavel,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'

export type EmendasPanelVariant = 'page' | 'copiloto'

type FiltroStatus = 'todas' | 'pagas' | 'nao_pagas'

const OPCOES_STATUS: readonly { id: FiltroStatus; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'pagas', label: 'Pagas' },
  { id: 'nao_pagas', label: 'Não pagas' },
]

const POR_PAGINA = 100

const COLUNAS_VALOR: ReadonlySet<EmendaListColumnKey> = new Set([
  'valor_indicado',
  'valor_empenhado',
  'valor_a_empenhar',
  'valor_pago',
  'valor_a_ser_pago',
])

const COLUNAS_DATA: ReadonlySet<EmendaListColumnKey> = new Set([
  'data_empenho',
  'data_pagamento',
  'created_at',
  'updated_at',
])

const COLUNAS_TEXTO_LONGO: ReadonlySet<EmendaListColumnKey> = new Set([
  'objeto',
  'alteracao',
  'liderancas',
  'portaria_convenio',
  'empenho',
])

function formatarMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarMoedaCurta(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function isEmendaPaga(r: Emenda): boolean {
  const vp = Number(r.valor_pago)
  return Number.isFinite(vp) && vp > 0
}

function valorOrdenacao(r: Emenda, col: EmendaListColumnKey): string | number {
  if (col === 'exercicio') return r.exercicio ?? Number.NEGATIVE_INFINITY
  if (COLUNAS_VALOR.has(col)) {
    const v = r[col as keyof Emenda]
    return typeof v === 'number' ? v : Number.NEGATIVE_INFINITY
  }
  if (COLUNAS_DATA.has(col)) {
    const d = r[col as keyof Emenda]
    return d ? new Date(String(d)).getTime() : Number.NEGATIVE_INFINITY
  }
  const v = r[col as keyof Emenda]
  return v == null ? '' : String(v).toLowerCase()
}

function textoCelula(r: Emenda, col: EmendaListColumnKey): string {
  if (COLUNAS_VALOR.has(col)) return formatarMoeda(r[col as keyof Emenda] as number | null)
  if (COLUNAS_DATA.has(col)) {
    const d = r[col as keyof Emenda]
    return d ? formatDateShort(String(d)) : '—'
  }
  const v = r[col as keyof Emenda]
  if (v == null || String(v).trim() === '') return '—'
  return String(v)
}

function BlocoTotal({ rotulo, valor, children }: { rotulo: string; valor: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 xl:px-5 xl:first:pl-0 xl:last:pr-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</p>
      <p className="mt-0.5 text-[24px] font-bold leading-tight tabular-nums">{valor}</p>
      {children}
    </div>
  )
}

/** Na página usa o `TsePage`; dentro do Copiloto só aplica os tokens, sem fundo nem margens próprios. */
function Moldura({ variant, children }: { variant: EmendasPanelVariant; children: ReactNode }) {
  if (variant === 'page') return <TsePage>{children}</TsePage>
  return (
    <div style={TSE_TOKENS} className="text-[var(--tse-text)]">
      {children}
    </div>
  )
}

const botaoAcao = 'rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)] disabled:opacity-50'
const checkboxClass = 'h-3.5 w-3.5 shrink-0 cursor-pointer accent-[var(--tse-olive)]'

export function EmendasPanel({ variant = 'page' }: { variant?: EmendasPanelVariant }) {
  const router = useRouter()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()
  const [rows, setRows] = useState<Emenda[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modal, setModal] = useState<EmendaModalModo | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [filtroExercicio, setFiltroExercicio] = useState<string>('')
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todas')
  const [busca, setBusca] = useState<string>('')
  const [selecionadas, setSelecionadas] = useState<Set<string>>(() => new Set())
  const [colunasVisiveis, setColunasVisiveis] = useState<Record<EmendaListColumnKey, boolean>>(() =>
    emendasDefaultVisibleColumnsRecord(),
  )
  const [sortCol, setSortCol] = useState<EmendaListColumnKey>('updated_at')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(POR_PAGINA)
  const selecionarTodasRef = useRef<HTMLInputElement | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      setRows(await fetchEmendas())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar emendas.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin && !canAccess('emendas')) {
      router.replace('/dashboard')
      return
    }
    void carregar()
  }, [permLoading, isAdmin, canAccess, router, carregar])

  const exercicios = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.exercicio).filter((x): x is number => typeof x === 'number'))).sort(
        (a, b) => b - a,
      ),
    [rows],
  )

  const municipios = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.municipio_beneficiario?.trim()).filter((m): m is string => Boolean(m)))).sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
    [rows],
  )

  useEffect(() => {
    if (filtroMunicipio && !municipios.includes(filtroMunicipio)) setFiltroMunicipio('')
  }, [municipios, filtroMunicipio])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const ano = filtroExercicio ? Number(filtroExercicio) : null
    return rows.filter((r) => {
      if (ano !== null && r.exercicio !== ano) return false
      if (filtroMunicipio && (r.municipio_beneficiario ?? '').trim() !== filtroMunicipio) return false
      if (filtroStatus === 'pagas' && !isEmendaPaga(r)) return false
      if (filtroStatus === 'nao_pagas' && isEmendaPaga(r)) return false
      if (q && !r.emenda.toLowerCase().includes(q) && !(r.objeto ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filtroExercicio, filtroMunicipio, filtroStatus, busca])

  const ordenadas = useMemo(() => {
    const fator = sortAsc ? 1 : -1
    return [...filtradas].sort((a, b) => {
      const va = valorOrdenacao(a, sortCol)
      const vb = valorOrdenacao(b, sortCol)
      const cmp =
        typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'pt-BR') : Number(va) - Number(vb)
      return fator * cmp
    })
  }, [filtradas, sortCol, sortAsc])

  useEffect(() => {
    setLimite(POR_PAGINA)
    const ids = new Set(filtradas.map((r) => r.id))
    setSelecionadas((prev) => {
      if (prev.size === 0) return prev
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filtradas])

  const totais = useMemo(() => {
    let indicado = 0
    let empenhado = 0
    let pago = 0
    let pagas = 0
    for (const r of filtradas) {
      if (Number.isFinite(Number(r.valor_indicado))) indicado += Number(r.valor_indicado)
      if (Number.isFinite(Number(r.valor_empenhado))) empenhado += Number(r.valor_empenhado)
      if (Number.isFinite(Number(r.valor_pago))) pago += Number(r.valor_pago)
      if (isEmendaPaga(r)) pagas += 1
    }
    return { indicado, empenhado, pago, pagas }
  }, [filtradas])

  const filtrosAtivos = Boolean(filtroExercicio || filtroMunicipio || filtroStatus !== 'todas' || busca.trim())
  const colunasAtivas = useMemo(() => EMENDAS_LIST_COLUMN_KEYS.filter((k) => colunasVisiveis[k]), [colunasVisiveis])
  const todasSelecionadas = filtradas.length > 0 && filtradas.every((r) => selecionadas.has(r.id))
  const algumasSelecionadas = selecionadas.size > 0 && !todasSelecionadas

  useEffect(() => {
    if (selecionarTodasRef.current) selecionarTodasRef.current.indeterminate = algumasSelecionadas
  }, [algumasSelecionadas])

  const ordenar = (col: EmendaListColumnKey) => {
    if (col === sortCol) {
      setSortAsc((v) => !v)
      return
    }
    setSortCol(col)
    setSortAsc(!COLUNAS_VALOR.has(col) && !COLUNAS_DATA.has(col) && col !== 'exercicio')
  }

  const alternarSelecao = (id: string) =>
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const alternarTodas = () => setSelecionadas(todasSelecionadas ? new Set() : new Set(filtradas.map((r) => r.id)))

  const alternarColuna = (col: EmendaListColumnKey) =>
    setColunasVisiveis((prev) => {
      const next = { ...prev, [col]: !prev[col] }
      return EMENDAS_LIST_COLUMN_KEYS.some((k) => next[k]) ? next : prev
    })

  const limparFiltros = () => {
    setFiltroExercicio('')
    setFiltroMunicipio('')
    setFiltroStatus('todas')
    setBusca('')
  }

  const linhasExportar = useMemo(
    () => (selecionadas.size > 0 ? ordenadas.filter((r) => selecionadas.has(r.id)) : ordenadas),
    [ordenadas, selecionadas],
  )

  const descricaoFiltros = useMemo(() => {
    const partes: string[] = []
    if (filtroExercicio) partes.push(`Exercício: ${filtroExercicio}`)
    if (busca.trim()) partes.push(`Emenda/objeto contém: ${busca.trim()}`)
    if (filtroMunicipio) partes.push(`Município/beneficiário: ${filtroMunicipio}`)
    if (filtroStatus !== 'todas') partes.push(`Status: ${filtroStatus === 'pagas' ? 'Pagas' : 'Não pagas'}`)
    if (selecionadas.size > 0) partes.push(`Registros selecionados: ${selecionadas.size}`)
    return partes.length > 0 ? `Filtros ativos — ${partes.join(' · ')}` : 'Sem filtros (lista completa carregada)'
  }, [filtroExercicio, busca, filtroMunicipio, filtroStatus, selecionadas.size])

  const exportar = (formato: 'xlsx' | 'pdf') => {
    if (formato === 'xlsx') void exportEmendasListToXlsx(linhasExportar, filtrosAtivos, colunasAtivas)
    else void exportEmendasListToPdf(linhasExportar, filtrosAtivos, descricaoFiltros, colunasAtivas)
  }

  const remover = async (r: Emenda) => {
    if (!window.confirm(`Excluir a emenda "${r.emenda}"?`)) return
    setExcluindoId(r.id)
    setErro(null)
    try {
      await excluirEmenda(r.id)
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir emenda.')
    } finally {
      setExcluindoId(null)
    }
  }

  if (permLoading) {
    return (
      <Moldura variant={variant}>
        <TseCarregando texto="Verificando acesso…" />
      </Moldura>
    )
  }

  const rotuloExport = selecionadas.size > 0 ? ` (${selecionadas.size})` : ''
  const pctEmpenhado = totais.indicado > 0 ? (totais.empenhado / totais.indicado) * 100 : 0
  const pctPago = totais.indicado > 0 ? (totais.pago / totais.indicado) * 100 : 0
  const fmtPct = (n: number) => `${n.toFixed(1).replace('.', ',')}%`

  return (
    <Moldura variant={variant}>
      <TseFilterBar>
        <TsePillSelect rotulo="Exercício" value={filtroExercicio} onChange={(e) => setFiltroExercicio(e.target.value)}>
          <option value="">Todos</option>
          {exercicios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </TsePillSelect>
        <TsePillSelect
          rotulo="Município / beneficiário"
          value={filtroMunicipio}
          onChange={(e) => setFiltroMunicipio(e.target.value)}
        >
          <option value="">Todos</option>
          {municipios.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </TsePillSelect>
        <div className="flex flex-col gap-1 text-[13px] font-semibold">
          Status
          <TseSegmentado opcoes={OPCOES_STATUS} valor={filtroStatus} onChange={setFiltroStatus} />
        </div>
        <TseBusca value={busca} onChange={setBusca} placeholder="Buscar emenda ou objeto…" className="w-64" />
        {filtrosAtivos ? (
          <button type="button" onClick={limparFiltros} className={tseLinkAcaoClass}>
            Limpar filtros
          </button>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            title="Recarregar emendas do banco"
            className={tseBotaoCinzaClass}
          >
            <RefreshCw className={cn(tseBotaoIconeClass, loading && 'animate-spin')} aria-hidden />
            Atualizar
          </button>
          <button type="button" onClick={() => setModal({ tipo: 'nova' })} className={tseBotaoPrimarioClass}>
            <Plus className="h-4 w-4" aria-hidden />
            Nova emenda
          </button>
        </div>
      </TseFilterBar>

      {erro ? (
        <div className="mt-4">
          <TseErro>{erro}</TseErro>
        </div>
      ) : null}

      <section className="mt-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-[#EEEEEE]">
          <BlocoTotal rotulo="Emendas" valor={filtradas.length.toLocaleString('pt-BR')}>
            <p className="mt-2 text-[11px] text-[var(--tse-muted)]">
              {filtrosAtivos ? `de ${rows.length.toLocaleString('pt-BR')} cadastradas` : 'cadastradas'} ·{' '}
              {totais.pagas.toLocaleString('pt-BR')} com pagamento
            </p>
          </BlocoTotal>
          <BlocoTotal rotulo="Valor indicado" valor={formatarMoedaCurta(totais.indicado)}>
            <p className="mt-2 text-[11px] text-[var(--tse-muted)]">soma das emendas listadas</p>
          </BlocoTotal>
          <BlocoTotal rotulo="Valor empenhado" valor={formatarMoedaCurta(totais.empenhado)}>
            {totais.indicado > 0 ? (
              <>
                <TseBarraRotulo pct={pctEmpenhado} rotulo={fmtPct(pctEmpenhado)} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">do valor indicado</p>
              </>
            ) : null}
          </BlocoTotal>
          <BlocoTotal rotulo="Valor pago" valor={formatarMoedaCurta(totais.pago)}>
            {totais.indicado > 0 ? (
              <>
                <TseBarraRotulo pct={pctPago} rotulo={fmtPct(pctPago)} />
                <p className="mt-1 text-[11px] text-[var(--tse-muted)]">do valor indicado</p>
              </>
            ) : null}
          </BlocoTotal>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-[var(--tse-muted)]">
          {selecionadas.size > 0 ? (
            <>
              <strong className="text-[var(--tse-text)]">{selecionadas.size}</strong>{' '}
              {selecionadas.size === 1 ? 'selecionada' : 'selecionadas'} para exportar ·{' '}
              <button type="button" onClick={() => setSelecionadas(new Set())} className={tseLinkAcaoClass}>
                Limpar seleção
              </button>
            </>
          ) : (
            'Marque linhas para exportar só as escolhidas; sem seleção, exporta toda a lista filtrada.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <TseMenu icone={Columns2} rotulo="Colunas" largura="w-64">
            {() => (
              <div>
                <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                  Tabela e exportação
                </p>
                <div className="max-h-[min(60vh,24rem)] overflow-y-auto pb-1">
                  {EMENDAS_LIST_COLUMN_KEYS.map((col) => (
                    <label
                      key={col}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-[var(--tse-yellow-soft)]"
                    >
                      <input
                        type="checkbox"
                        checked={colunasVisiveis[col]}
                        onChange={() => alternarColuna(col)}
                        className={checkboxClass}
                      />
                      {EMENDAS_LIST_COLUMN_LABELS[col]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </TseMenu>
          <button
            type="button"
            onClick={() => exportar('xlsx')}
            disabled={loading || linhasExportar.length === 0}
            title="Exportar para Excel as colunas visíveis"
            className={tseBotaoCinzaClass}
          >
            <FileSpreadsheet className={tseBotaoIconeClass} aria-hidden />
            Excel{rotuloExport}
          </button>
          <button
            type="button"
            onClick={() => exportar('pdf')}
            disabled={loading || linhasExportar.length === 0}
            title="Exportar para PDF as colunas visíveis"
            className={tseBotaoCinzaClass}
          >
            <FileText className={tseBotaoIconeClass} aria-hidden />
            PDF{rotuloExport}
          </button>
        </div>
      </div>

      <div className="mt-3">
        {loading && rows.length === 0 ? (
          <TseCarregando texto="Carregando emendas…" className="min-h-[30vh]" />
        ) : rows.length === 0 ? (
          <TseVazio>
            Nenhuma emenda cadastrada.{' '}
            <button
              type="button"
              onClick={() => setModal({ tipo: 'nova' })}
              className="font-bold text-[var(--tse-olive)] hover:underline"
            >
              Cadastrar a primeira
            </button>
          </TseVazio>
        ) : filtradas.length === 0 ? (
          <TseVazio>Nenhuma emenda corresponde aos filtros. Ajuste ou use «Limpar filtros».</TseVazio>
        ) : (
          <>
            <div className={cn(tseTabela.container, 'max-h-[min(70vh,calc(100dvh-16rem))] overflow-auto')}>
              <table
                className={cn(
                  tseTabela.table,
                  colunasAtivas.length > 10 ? 'min-w-[1400px]' : colunasAtivas.length > 6 ? 'min-w-[1100px]' : 'min-w-[720px]',
                )}
                data-tse-tabela
              >
                <thead className={cn(tseTabela.thead, 'sticky top-0 z-10')}>
                  <tr>
                    <th className={cn(tseTabela.th, 'w-10')}>
                      <input
                        ref={selecionarTodasRef}
                        type="checkbox"
                        checked={todasSelecionadas}
                        onChange={alternarTodas}
                        className={checkboxClass}
                        aria-label="Selecionar todas as emendas filtradas"
                      />
                    </th>
                    {colunasAtivas.map((col) => (
                      <TseThOrdenavel
                        key={col}
                        col={col}
                        sortCol={sortCol}
                        sortAsc={sortAsc}
                        onSort={ordenar}
                        alinhar={COLUNAS_VALOR.has(col) ? 'right' : 'left'}
                        className="whitespace-nowrap"
                      >
                        {EMENDAS_LIST_COLUMN_LABELS[col]}
                      </TseThOrdenavel>
                    ))}
                    <th className={cn(tseTabela.th, 'text-right')}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenadas.slice(0, limite).map((r) => {
                    const sel = selecionadas.has(r.id)
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          tseTabela.tr,
                          'hover:bg-[var(--tse-bar)]',
                          sel && 'bg-[var(--tse-yellow-soft)] hover:bg-[var(--tse-yellow-soft)]',
                        )}
                      >
                        <td className={tseTabela.td}>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => alternarSelecao(r.id)}
                            className={checkboxClass}
                            aria-label={`Selecionar emenda ${r.emenda}`}
                          />
                        </td>
                        {colunasAtivas.map((col) => {
                          const texto = textoCelula(r, col)
                          return (
                            <td
                              key={col}
                              title={COLUNAS_TEXTO_LONGO.has(col) || col === 'emenda' ? texto : undefined}
                              className={cn(
                                tseTabela.td,
                                COLUNAS_VALOR.has(col) && 'whitespace-nowrap text-right tabular-nums',
                                col === 'valor_pago' && isEmendaPaga(r) && 'font-bold text-[var(--tse-olive)]',
                                col === 'valor_indicado' && 'font-bold',
                                (COLUNAS_DATA.has(col) || col === 'exercicio') && 'whitespace-nowrap tabular-nums',
                                col === 'emenda' && 'max-w-[220px] truncate font-semibold',
                                col === 'municipio_beneficiario' && 'max-w-[200px] truncate',
                                col === 'id' && 'max-w-[120px] truncate font-mono text-[11px]',
                                COLUNAS_TEXTO_LONGO.has(col) && 'max-w-[min(18rem,40vw)] truncate text-[var(--tse-muted)]',
                              )}
                            >
                              {texto}
                            </td>
                          )
                        })}
                        <td className={cn(tseTabela.td, 'py-1')}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => setModal({ tipo: 'editar', emenda: r })}
                              title="Editar"
                              aria-label={`Editar emenda ${r.emenda}`}
                              className={botaoAcao}
                            >
                              <Pencil className="h-4 w-4 text-[var(--tse-gold-text)]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setModal({ tipo: 'duplicar', emenda: r })}
                              title="Duplicar"
                              aria-label={`Duplicar emenda ${r.emenda}`}
                              className={botaoAcao}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void remover(r)}
                              disabled={excluindoId === r.id}
                              title="Excluir"
                              aria-label={`Excluir emenda ${r.emenda}`}
                              className={cn(botaoAcao, 'hover:text-red-700')}
                            >
                              {excluindoId === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <TseCarregarMais restantes={ordenadas.length - limite} onClick={() => setLimite((n) => n + POR_PAGINA)} />
          </>
        )}
      </div>

      {modal ? <EmendaModal modo={modal} onClose={() => setModal(null)} onSalva={carregar} /> : null}
    </Moldura>
  )
}
