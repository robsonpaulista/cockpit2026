'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { DemandasObrasExportModal } from '@/components/territorio-campo/demandas-obras-export-modal'
import {
  useCidadesExpandidas,
  useTerritorioMunicipio,
} from '@/components/territorio-campo/territorio-municipio-context'
import {
  cidadeDaDemanda,
  filtrarDemandasObrasSheets,
  liderancaDaDemanda,
  normalizarTextoDemanda,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import { normalizeIptMunicipio } from '@/lib/ipt'
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
  TsePill,
  TseRank,
  TseStatus,
  TseThOrdenavel,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'

export type DemandaObraRow = CampoDemandaObraRow

type SortCol = 'cidade' | 'obras' | 'resolvidas'
type CategoriaStatus = 'resolvida' | 'andamento' | 'encaminhada' | 'outra'

type GrupoCidade = {
  cidade: string
  cidadeKey: string
  rows: DemandaObraRow[]
  resolvidas: number
  andamento: number
}

const PAGE_SIZE = 30
const TOTAL_MUNICIPIOS_PI = 224

const CATEGORIAS: Array<{ id: CategoriaStatus; label: string; cor: string }> = [
  { id: 'resolvida', label: 'Resolvidas / concluídas', cor: 'var(--tse-green)' },
  { id: 'andamento', label: 'Em andamento', cor: 'var(--tse-yellow)' },
  { id: 'encaminhada', label: 'Encaminhadas', cor: '#5D8AA7' },
  { id: 'outra', label: 'Outros status', cor: 'var(--tse-zero)' },
]

function categoriaStatus(status: string | null | undefined): CategoriaStatus {
  const sl = (status || '').toLowerCase().trim()
  if (sl.includes('resolvido') || sl.includes('conclu')) return 'resolvida'
  if (sl.includes('andamento') || sl.includes('progresso')) return 'andamento'
  if (sl.includes('encaminhad')) return 'encaminhada'
  return 'outra'
}

const corCategoria = (c: CategoriaStatus): string => CATEGORIAS.find((x) => x.id === c)?.cor ?? 'var(--tse-zero)'
const fmt = (n: number): string => n.toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function formatDataCurta(value?: string | null): string {
  if (!value) return '—'
  const iso = value.includes('T') ? value.slice(0, 10) : value
  const parts = iso.split('-')
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

/** Obras/demandas da planilha Google Sheets (Base Eleitoral), agrupadas por cidade. */
export function DemandasObrasPanel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [rows, setRows] = useState<DemandaObraRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaStatus | null>(null)
  const [filtroTema, setFiltroTema] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('obras')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/campo/demands', { cache: 'no-store' })
      const data = (await response.json()) as DemandaObraRow[] | { error?: string }
      if (!response.ok) {
        const msg = data && typeof data === 'object' && 'error' in data ? data.error : 'Erro ao carregar demandas'
        throw new Error(msg || 'Erro ao carregar demandas')
      }
      setRows(filtrarDemandasObrasSheets(Array.isArray(data) ? data : []))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    setLimite(PAGE_SIZE)
  }, [municipio, filtroCategoria, filtroTema])

  const rowsEscopo = useMemo(() => rows.filter((row) => noMunicipio(cidadeDaDemanda(row))), [rows, noMunicipio])

  const contagemCategorias = CATEGORIAS.map((c) => ({
    ...c,
    valor: rowsEscopo.filter((row) => categoriaStatus(row.status) === c.id).length,
  })).filter((c) => c.valor > 0)

  const temas = useMemo(() => {
    const porTema = new Map<string, number>()
    for (const row of rowsEscopo) {
      const tema = row.theme?.trim()
      if (tema) porTema.set(tema, (porTema.get(tema) ?? 0) + 1)
    }
    return [...porTema.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
  }, [rowsEscopo])

  const grupos = useMemo<GrupoCidade[]>(() => {
    const termo = normalizarTextoDemanda(busca)
    const map = new Map<string, GrupoCidade>()

    for (const row of rowsEscopo) {
      if (filtroCategoria && categoriaStatus(row.status) !== filtroCategoria) continue
      if (filtroTema && row.theme?.trim() !== filtroTema) continue
      const cidade = cidadeDaDemanda(row)
      if (
        termo &&
        !normalizarTextoDemanda(cidade).includes(termo) &&
        !normalizarTextoDemanda(row.title || '').includes(termo) &&
        !normalizarTextoDemanda(liderancaDaDemanda(row)).includes(termo) &&
        !normalizarTextoDemanda(row.status || '').includes(termo) &&
        !normalizarTextoDemanda(row.theme || '').includes(termo)
      ) {
        continue
      }

      const cidadeKey = normalizeIptMunicipio(cidade) || cidade.toLowerCase()
      const grupo = map.get(cidadeKey) ?? { cidade, cidadeKey, rows: [], resolvidas: 0, andamento: 0 }
      grupo.rows.push(row)
      const cat = categoriaStatus(row.status)
      if (cat === 'resolvida') grupo.resolvidas += 1
      if (cat === 'andamento') grupo.andamento += 1
      map.set(cidadeKey, grupo)
    }

    for (const grupo of map.values()) {
      grupo.rows.sort((a, b) => compareTerritorioText(a.title || '', b.title || '', true))
    }
    return Array.from(map.values())
  }, [busca, rowsEscopo, filtroCategoria, filtroTema])

  const gruposOrdenados = useMemo(
    () =>
      [...grupos].sort((a, b) => {
        const porNome = compareTerritorioText(a.cidade, b.cidade, true)
        if (sortCol === 'cidade') return compareTerritorioText(a.cidade, b.cidade, sortAsc)
        if (sortCol === 'resolvidas') return compareTerritorioNumber(a.resolvidas, b.resolvidas, sortAsc) || porNome
        return compareTerritorioNumber(a.rows.length, b.rows.length, sortAsc) || porNome
      }),
    [grupos, sortCol, sortAsc],
  )

  const rank = useMemo(
    () =>
      new Map(
        [...grupos]
          .sort((a, b) => b.rows.length - a.rows.length || compareTerritorioText(a.cidade, b.cidade, true))
          .map((g, i) => [g.cidadeKey, i + 1]),
      ),
    [grupos],
  )

  const chaves = useMemo(() => grupos.map((g) => g.cidadeKey), [grupos])
  const { expandidas, alternar, todasAbertas, alternarTodas } = useCidadesExpandidas(chaves, !loading)

  const rowsFiltradas = useMemo(() => gruposOrdenados.flatMap((g) => g.rows), [gruposOrdenados])
  const totalObras = rowsFiltradas.length
  const totalResolvidas = grupos.reduce((s, g) => s + g.resolvidas, 0)
  const maxObras = grupos.reduce((m, g) => Math.max(m, g.rows.length), 0)
  const cidadesComObra = new Set(rowsEscopo.map((row) => normalizeIptMunicipio(cidadeDaDemanda(row)))).size
  const universo = municipio ? 1 : TOTAL_MUNICIPIOS_PI
  const pctResolvidas = totalObras ? (totalResolvidas / totalObras) * 100 : 0
  const escopoLabel = municipio ?? 'Piauí'
  const hasFiltros = Boolean(busca.trim() || filtroCategoria || filtroTema)

  const alternarSort = (column: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['cidade'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const filtrosExportResumo = [
    municipio ? `Município: ${municipio}` : null,
    filtroCategoria ? `Status: ${CATEGORIAS.find((c) => c.id === filtroCategoria)?.label}` : null,
    filtroTema ? `Tema: ${filtroTema}` : null,
    busca.trim() ? `Busca: ${busca.trim()}` : null,
    `Ordenação da lista: ${sortCol === 'cidade' ? 'cidade' : sortCol === 'obras' ? 'qtd. obras' : 'resolvidas'} (${sortAsc ? 'crescente' : 'decrescente'})`,
  ].filter((v): v is string => Boolean(v))

  if (loading && rows.length === 0) return <TseCarregando texto="Carregando obras da planilha…" />

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-4">
          <section className={tseCardClass}>
            <h2 className="text-xl font-bold">Dados Gerais</h2>
            <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">
              Cadastro de Demandas (Google Sheets) · {escopoLabel}
            </p>
            <TseDados>
              <TseDado rotulo="Obras e demandas" valor={fmt(rowsEscopo.length)} />
              <TseDado rotulo="Cidades com obra" valor={fmt(cidadesComObra)} sufixo={`/ ${fmt(universo)}`} />
              <TseDado rotulo="Temas" valor={fmt(temas.length)} />
            </TseDados>
            <TseBarraRotulo pct={pctResolvidas} rotulo={fmtPct(pctResolvidas)} />
            <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Resolvidas ou concluídas</p>
          </section>

          {contagemCategorias.length > 0 ? (
            <TseListaFiltro
              titulo="Status"
              itens={contagemCategorias}
              ativo={filtroCategoria}
              onChange={setFiltroCategoria}
            />
          ) : null}

          {temas.length > 0 ? (
            <TseListaFiltro
              titulo="Temas"
              itens={temas.slice(0, 10).map(([tema, total]) => ({
                id: tema,
                label: tema,
                valor: total,
                cor: 'var(--tse-gold)',
              }))}
              ativo={filtroTema}
              onChange={setFiltroTema}
            />
          ) : null}
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filtroCategoria ?? ''}
                onChange={(e) => setFiltroCategoria((e.target.value || null) as CategoriaStatus | null)}
                className={tseControleClass}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {temas.length > 0 ? (
                <select
                  value={filtroTema ?? ''}
                  onChange={(e) => setFiltroTema(e.target.value || null)}
                  className={tseControleClass}
                  aria-label="Filtrar por tema"
                >
                  <option value="">Todos os temas</option>
                  {temas.map(([tema]) => (
                    <option key={tema} value={tema}>
                      {tema}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TseBusca value={busca} onChange={setBusca} placeholder="Buscar obra, liderança, status" />
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                disabled={rowsFiltradas.length === 0}
                title="Exportar seleção filtrada (CSV, Excel ou PDF)"
                className={tseBotaoCinzaClass}
              >
                <Download className={tseBotaoIconeClass} />
                Exportar
              </button>
              <button type="button" onClick={() => void carregar()} disabled={loading} className={tseBotaoCinzaClass}>
                <RefreshCw className={cn(tseBotaoIconeClass, loading && 'animate-spin')} />
                Atualizar
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
                <p className="text-xl font-bold uppercase">Obras por cidade</p>
                <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                  {escopoLabel}
                </span>
              </div>
              <p className="text-[15px] text-[var(--tse-muted)]">
                {fmt(totalObras)} {totalObras === 1 ? 'obra' : 'obras'} em {fmt(grupos.length)}{' '}
                {grupos.length === 1 ? 'cidade' : 'cidades'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{fmt(totalObras)}</p>
              <p className="text-[13px] text-[var(--tse-muted)]">obras</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{fmt(totalResolvidas)}</p>
              <p className="text-[13px] text-[var(--tse-muted)]">resolvidas · {fmtPct(pctResolvidas)}</p>
            </div>
          </section>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
            <p>
              {fmt(grupos.length)} {grupos.length === 1 ? 'município' : 'municípios'}
              {hasFiltros ? ' com os filtros aplicados' : ''}
            </p>
            <div className="flex items-center gap-4">
              {hasFiltros ? (
                <button
                  type="button"
                  onClick={() => {
                    setBusca('')
                    setFiltroCategoria(null)
                    setFiltroTema(null)
                  }}
                  className={tseLinkAcaoClass}
                >
                  Limpar filtros
                </button>
              ) : null}
              {grupos.length > 0 ? (
                <button type="button" onClick={alternarTodas} className={tseLinkAcaoClass}>
                  {todasAbertas ? 'Recolher todas' : 'Expandir todas'}
                </button>
              ) : null}
            </div>
          </div>

          {gruposOrdenados.length === 0 ? (
            <div className="mt-3">
              <TseVazio>
                {municipio && rowsEscopo.length === 0
                  ? `Nenhuma obra cadastrada em ${municipio}.`
                  : 'Nenhuma obra encontrada com os filtros aplicados.'}
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
                      <TseThOrdenavel
                        col="obras"
                        alinhar="right"
                        className="w-[200px]"
                        sortCol={sortCol}
                        sortAsc={sortAsc}
                        onSort={alternarSort}
                      >
                        Obras
                      </TseThOrdenavel>
                      <TseThOrdenavel col="resolvidas" alinhar="right" sortCol={sortCol} sortAsc={sortAsc} onSort={alternarSort}>
                        Resolvidas
                      </TseThOrdenavel>
                      <th className="px-3 py-2.5 text-right">Em andamento</th>
                      <th className="px-3 py-2.5 text-right">% resolvidas</th>
                      <th className="w-10 px-2 py-2.5" aria-label="Expandir" />
                    </tr>
                  </thead>
                  <tbody>
                    {gruposOrdenados.slice(0, limite).map((grupo) => {
                      const aberta = expandidas.has(grupo.cidadeKey)
                      const pct = grupo.rows.length ? (grupo.resolvidas / grupo.rows.length) * 100 : 0
                      return (
                        <GrupoObras
                          key={grupo.cidadeKey}
                          grupo={grupo}
                          aberta={aberta}
                          posicao={rank.get(grupo.cidadeKey) ?? 0}
                          pct={pct}
                          maxObras={maxObras}
                          onToggle={() => alternar(grupo.cidadeKey)}
                        />
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

      <DemandasObrasExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        rows={rowsFiltradas}
        cidadesCount={grupos.length}
        filtrosResumo={filtrosExportResumo}
      />
    </>
  )
}

function GrupoObras({
  grupo,
  aberta,
  posicao,
  pct,
  maxObras,
  onToggle,
}: {
  grupo: GrupoCidade
  aberta: boolean
  posicao: number
  pct: number
  maxObras: number
  onToggle: () => void
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
        <td className="px-3 py-2">
          <TseBarraValor valor={grupo.rows.length} max={maxObras} formatado={fmt(grupo.rows.length)} cor="amarelo" />
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmt(grupo.resolvidas)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--tse-muted)]">{fmt(grupo.andamento)}</td>
        <td className="px-3 py-2 text-right">
          <TsePill tom={pct >= 50 ? 'verde' : 'neutro'}>{fmtPct(pct)}</TsePill>
        </td>
        <TseChevronCelula aberta={aberta} />
      </tr>
      {aberta ? (
        <tr className="bg-[var(--tse-bar)]">
          <td colSpan={7} className="px-3 pb-3 pt-1">
            <div className="overflow-x-auto rounded-lg bg-white">
              <table className="w-full min-w-[720px] text-[12px]" data-tse-tabela>
                <thead className="text-left text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                  <tr>
                    <th className="px-3 py-2 pl-4">Obra / solicitação</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Liderança</th>
                    <th className="px-3 py-2">Tema</th>
                    <th className="px-3 py-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.rows.map((row, i) => (
                    <tr key={row.id || `${grupo.cidadeKey}-${row.title}-${i}`} className="border-t border-[#EEEEEE]">
                      <td className="max-w-[320px] px-3 py-2 pl-4">
                        <p className="font-semibold">{row.title}</p>
                        {row.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--tse-muted)]">{row.description}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <TseStatus cor={corCategoria(categoriaStatus(row.status))}>{row.status?.trim() || '—'}</TseStatus>
                      </td>
                      <td className="px-3 py-2">{liderancaDaDemanda(row)}</td>
                      <td className="px-3 py-2 text-[var(--tse-muted)]">{row.theme?.trim() || '—'}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--tse-muted)]">
                        {formatDataCurta(row.data_demanda || row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}
