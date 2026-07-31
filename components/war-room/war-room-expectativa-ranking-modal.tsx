'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChartBar,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconLoader2,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import type { IptMunicipio } from '@/lib/ipt'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { getDemografiaMunicipio } from '@/lib/demografia-municipio'
import { getEleitoradoByCity } from '@/lib/eleitores'
import {
  filtrarEmendasPorMunicipio,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'
import {
  exportExpectativaRankingCsv,
  exportExpectativaRankingPdf,
  exportExpectativaRankingXlsx,
} from '@/lib/war-room/expectativa-ranking-export'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  TerritorioSortableHeaderButton,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { WarRoomMunicipioEmendasModal } from '@/components/war-room/war-room-municipio-emendas-modal'
import { WarRoomMunicipioObrasModal } from '@/components/war-room/war-room-municipio-obras-modal'
import { WarRoomPesquisaRankingModal } from '@/components/war-room/war-room-pesquisa-ranking-modal'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import type { ObraRecapMatchSource } from '@/lib/obras-recap-match'
import {
  buildWarRoomPesquisasConsolidadas,
  mapUltimaPesquisaPorMunicipio,
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import { cn } from '@/lib/utils'

type SortCol =
  | 'cidade'
  | 'expectativa'
  | 'peso'
  | 'populacao'
  | 'eleitores'
  | 'ultimaVisita'
  | 'proxVisita'
  | 'pesquisa'

type FiltroExpectativa = 'todos' | 'gt0' | 'eq0'
type FiltroBinario = 'todos' | 'com' | 'sem'

type RankingRow = {
  municipio: string
  expectativa: number
  peso: number
  populacao: number | null
  eleitores: number | null
  ultimaVisita: string | null
  ultimaVisitaLabel: string
  proxVisitaLabel: string
  proxVisitaSort: string
  temEmendas: boolean
  temObras: boolean
  /** Posição do candidato foco na última pesquisa consolidada. */
  pesquisaPosicao: number | null
  pesquisa: WarRoomPesquisaConsolidadaReal | null
}

type Props = {
  municipios: IptMunicipio[]
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>
  onClose: () => void
}

const FILTRO_EXPECTATIVA_OPCOES: Array<{ id: FiltroExpectativa; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'gt0', label: 'Expectativa > 0' },
  { id: 'eq0', label: 'Expectativa = 0' },
]

const FILTRO_EMENDAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Emendas: todas' },
  { id: 'com', label: 'Com Emendas' },
  { id: 'sem', label: 'Sem Emendas' },
]

const FILTRO_OBRAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Obras: todas' },
  { id: 'com', label: 'Com Obras' },
  { id: 'sem', label: 'Sem Obras' },
]

function formatDataCurta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const raw = iso.includes('T') ? iso.slice(0, 10) : iso.slice(0, 10)
  const parts = raw.split('-')
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatPesoPct(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatInt(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('pt-BR')
}

function formatPosicaoPesquisa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 1) return '—'
  return `${Math.round(value)}º`
}

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function proxVisitaDe(
  itens: WarRoomAgendaProximoItem[] | undefined,
): { label: string; sort: string } {
  if (!itens || itens.length === 0) return { label: '—', sort: '' }
  const first = [...itens].sort((a, b) => {
    const byDate = a.dataKey.localeCompare(b.dataKey)
    if (byDate !== 0) return byDate
    return a.horario.localeCompare(b.horario, 'pt-BR')
  })[0]!
  const label = first.horario
    ? `${first.dataLabel} ${first.horario}`
    : first.dataLabel
  return { label, sort: `${first.dataKey} ${first.horario}` }
}

/** Modal tabular — ranking completo de expectativa (mapa operacional). */
export function WarRoomExpectativaRankingModal({
  municipios,
  agendaPorMunicipio,
  onClose,
}: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroExpectativa, setFiltroExpectativa] =
    useState<FiltroExpectativa>('todos')
  const [filtroEmendas, setFiltroEmendas] = useState<FiltroBinario>('todos')
  const [filtroObras, setFiltroObras] = useState<FiltroBinario>('todos')
  const [sortCol, setSortCol] = useState<SortCol>('expectativa')
  const [sortAsc, setSortAsc] = useState(false)
  const [emendasKeys, setEmendasKeys] = useState<Set<string>>(() => new Set())
  const [emendasAll, setEmendasAll] = useState<EmendaRegistro[]>([])
  const [loadingEmendas, setLoadingEmendas] = useState(true)
  const [exportBusy, setExportBusy] = useState<'idle' | 'csv' | 'xlsx' | 'pdf'>(
    'idle',
  )
  const [detalhe, setDetalhe] = useState<null | {
    tipo: 'emendas' | 'obras'
    municipio: string
  }>(null)
  const [obrasAll, setObrasAll] = useState<ObraMapaRow[] | null>(null)
  const [recapObras, setRecapObras] = useState<ObraRecapMatchSource[] | null>(null)
  const [loadingObras, setLoadingObras] = useState(false)
  const [pesquisaByMun, setPesquisaByMun] = useState<
    Map<string, WarRoomPesquisaConsolidadaReal>
  >(() => new Map())
  const [loadingPesquisas, setLoadingPesquisas] = useState(true)
  const [pesquisaDetalhe, setPesquisaDetalhe] =
    useState<WarRoomPesquisaConsolidadaReal | null>(null)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (detalhe) {
        setDetalhe(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, detalhe])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingEmendas(true)
      try {
        const res = await fetch('/api/emendas', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setEmendasKeys(new Set())
            setEmendasAll([])
          }
          return
        }
        const json = (await res.json()) as { emendas?: EmendaRegistro[] }
        const todas = json.emendas ?? []
        const keys = new Set<string>()
        for (const m of municipios) {
          const list = filtrarEmendasPorMunicipio(todas, m.municipio)
          if (list.length > 0) keys.add(normalizeIptMunicipio(m.municipio))
        }
        if (!cancelled) {
          setEmendasKeys(keys)
          setEmendasAll(todas)
        }
      } catch {
        if (!cancelled) {
          setEmendasKeys(new Set())
          setEmendasAll([])
        }
      } finally {
        if (!cancelled) setLoadingEmendas(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [municipios])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingPesquisas(true)
      try {
        const foco = resolveCandidatoIpt()
        const res = await fetch('/api/pesquisa?limit=5000', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setPesquisaByMun(new Map())
          return
        }
        const data = (await res.json()) as PollIptRow[]
        const built = buildWarRoomPesquisasConsolidadas(
          Array.isArray(data) ? data : [],
          foco,
          5000,
        )
        if (!cancelled) setPesquisaByMun(mapUltimaPesquisaPorMunicipio(built))
      } catch {
        if (!cancelled) setPesquisaByMun(new Map())
      } finally {
        if (!cancelled) setLoadingPesquisas(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (detalhe?.tipo !== 'obras') return
    if (obrasAll != null && recapObras != null) return

    let cancelled = false
    const load = async () => {
      setLoadingObras(true)
      try {
        const [mapaRes, recapRes] = await Promise.all([
          obrasAll != null
            ? Promise.resolve(null)
            : fetch('/api/obras/mapa?escopo=lista', { cache: 'no-store' }),
          recapObras != null
            ? Promise.resolve(null)
            : fetch('/api/obras/recap', { cache: 'no-store' }),
        ])

        if (cancelled) return

        if (mapaRes) {
          const json = (await mapaRes.json().catch(() => null)) as {
            obras?: ObraMapaRow[]
            error?: string
          } | null
          if (!mapaRes.ok) {
            setObrasAll([])
          } else {
            setObrasAll(Array.isArray(json?.obras) ? json.obras : [])
          }
        }

        if (recapRes) {
          const json = (await recapRes.json().catch(() => null)) as {
            obras?: ObraRecapMatchSource[]
            error?: string
          } | null
          if (!recapRes.ok) {
            setRecapObras([])
          } else {
            setRecapObras(Array.isArray(json?.obras) ? json.obras : [])
          }
        }
      } catch {
        if (!cancelled) {
          if (obrasAll == null) setObrasAll([])
          if (recapObras == null) setRecapObras([])
        }
      } finally {
        if (!cancelled) setLoadingObras(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [detalhe, obrasAll, recapObras])

  const rows = useMemo<RankingRow[]>(() => {
    return municipios.map((m) => {
      const key = normalizeIptMunicipio(m.municipio)
      const demo = getDemografiaMunicipio(m.municipio)
      const populacao =
        demo?.populacao_estimada_ultimo_ano ?? demo?.populacao_censo_2022 ?? null
      const prox = proxVisitaDe(agendaPorMunicipio.get(key))
      const pesquisa = pesquisaByMun.get(key) ?? null
      return {
        municipio: m.municipio,
        expectativa: m.expectativaVotos,
        peso: m.pesoExpectativaPct,
        populacao,
        eleitores: getEleitoradoByCity(m.municipio),
        ultimaVisita: m.ultimaVisita ?? null,
        ultimaVisitaLabel: formatDataCurta(m.ultimaVisita),
        proxVisitaLabel: prox.label,
        proxVisitaSort: prox.sort,
        temEmendas: emendasKeys.has(key),
        temObras:
          m.sinais.obras === 'bem' || (m.detalhes.obrasQuantidade ?? 0) > 0,
        pesquisaPosicao: pesquisa?.jadyelPosicao ?? null,
        pesquisa,
      }
    })
  }, [agendaPorMunicipio, emendasKeys, municipios, pesquisaByMun])

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    const base = rows.filter((r) => {
      if (termo && !normalizarBusca(r.municipio).includes(termo)) return false
      if (filtroExpectativa === 'gt0' && !(r.expectativa > 0)) return false
      if (filtroExpectativa === 'eq0' && r.expectativa !== 0) return false
      if (filtroEmendas === 'com' && !r.temEmendas) return false
      if (filtroEmendas === 'sem' && r.temEmendas) return false
      if (filtroObras === 'com' && !r.temObras) return false
      if (filtroObras === 'sem' && r.temObras) return false
      return true
    })

    return [...base].sort((a, b) => {
      if (sortCol === 'cidade') {
        return compareTerritorioText(a.municipio, b.municipio, sortAsc)
      }
      if (sortCol === 'expectativa') {
        const by = compareTerritorioNumber(a.expectativa, b.expectativa, sortAsc)
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'peso') {
        const by = compareTerritorioNumber(a.peso, b.peso, sortAsc)
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'populacao') {
        const by = compareTerritorioNumber(a.populacao ?? -1, b.populacao ?? -1, sortAsc)
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'eleitores') {
        const by = compareTerritorioNumber(a.eleitores ?? -1, b.eleitores ?? -1, sortAsc)
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'ultimaVisita') {
        const by = compareTerritorioText(
          a.ultimaVisita ?? '',
          b.ultimaVisita ?? '',
          sortAsc,
        )
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'pesquisa') {
        const by = compareTerritorioNumber(
          a.pesquisaPosicao ?? 999,
          b.pesquisaPosicao ?? 999,
          sortAsc,
        )
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      const by = compareTerritorioText(a.proxVisitaSort, b.proxVisitaSort, sortAsc)
      if (by !== 0) return by
      return compareTerritorioText(a.municipio, b.municipio, true)
    })
  }, [
    busca,
    filtroEmendas,
    filtroExpectativa,
    filtroObras,
    rows,
    sortAsc,
    sortCol,
  ])

  const alternarSort = (column: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, [
      'cidade',
      'ultimaVisita',
      'proxVisita',
    ] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const totais = useMemo(() => {
    let expectativa = 0
    let peso = 0
    let populacao = 0
    let eleitores = 0
    let comUltimaVisita = 0
    let comProxVisita = 0
    let comEmendas = 0
    let comObras = 0
    let comPesquisa = 0
    for (const row of filtradas) {
      expectativa += row.expectativa
      peso += row.peso
      if (row.populacao != null) populacao += row.populacao
      if (row.eleitores != null) eleitores += row.eleitores
      if (row.ultimaVisita) comUltimaVisita += 1
      if (row.proxVisitaSort) comProxVisita += 1
      if (row.temEmendas) comEmendas += 1
      if (row.temObras) comObras += 1
      if (row.pesquisaPosicao != null) comPesquisa += 1
    }
    return {
      expectativa,
      peso,
      populacao,
      eleitores,
      comUltimaVisita,
      comProxVisita,
      comEmendas,
      comObras,
      comPesquisa,
    }
  }, [filtradas])

  const exportar = (formato: 'csv' | 'xlsx' | 'pdf') => {
    if (filtradas.length === 0 || exportBusy !== 'idle') return
    setExportBusy(formato)
    try {
      const exportRows = filtradas.map((row) => ({
        municipio: row.municipio,
        expectativa: row.expectativa,
        peso: row.peso,
        populacao: row.populacao,
        eleitores: row.eleitores,
        ultimaVisitaLabel: row.ultimaVisitaLabel,
        proxVisitaLabel: row.proxVisitaLabel,
        temEmendas: row.temEmendas,
        temObras: row.temObras,
        pesquisaPosicaoLabel: formatPosicaoPesquisa(row.pesquisaPosicao),
      }))
      if (formato === 'csv') exportExpectativaRankingCsv(exportRows, totais)
      else if (formato === 'xlsx') exportExpectativaRankingXlsx(exportRows, totais)
      else exportExpectativaRankingPdf(exportRows, totais)
    } finally {
      setExportBusy('idle')
    }
  }

  const abrirEmendas = (municipio: string) => {
    setDetalhe({ tipo: 'emendas', municipio })
  }

  const abrirObras = (municipio: string) => {
    setDetalhe({ tipo: 'obras', municipio })
  }

  const abrirPesquisa = (pesquisa: WarRoomPesquisaConsolidadaReal | null) => {
    if (!pesquisa) return
    setPesquisaDetalhe(pesquisa)
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className="wr-visita-modal" role="presentation">
        <button
          type="button"
          className="wr-visita-modal__backdrop"
          aria-label="Fechar"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          className="wr-visita-modal__panel wr-expectativa-ranking-modal__panel"
        >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconChartBar className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Expectativa</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Ranking completo ({municipios.length})
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <div className="wr-expectativa-ranking-modal__toolbar">
          <label className="wr-expectativa-ranking-modal__search">
            <IconSearch className="h-3.5 w-3.5 shrink-0" stroke={1.75} aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar município…"
            />
          </label>
          <div className="wr-expectativa-ranking-modal__export" role="group" aria-label="Exportar">
            <span className="wr-expectativa-ranking-modal__export-label">
              <IconDownload className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
              Exportar
            </span>
            <button
              type="button"
              className="wr-expectativa-ranking-modal__export-btn"
              disabled={filtradas.length === 0 || exportBusy !== 'idle'}
              onClick={() => exportar('csv')}
            >
              {exportBusy === 'csv' ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
              ) : (
                <IconFileTypeCsv className="h-3.5 w-3.5" stroke={1.75} />
              )}
              CSV
            </button>
            <button
              type="button"
              className="wr-expectativa-ranking-modal__export-btn"
              disabled={filtradas.length === 0 || exportBusy !== 'idle'}
              onClick={() => exportar('xlsx')}
            >
              {exportBusy === 'xlsx' ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
              ) : (
                <IconFileSpreadsheet className="h-3.5 w-3.5" stroke={1.75} />
              )}
              XLS
            </button>
            <button
              type="button"
              className="wr-expectativa-ranking-modal__export-btn"
              disabled={filtradas.length === 0 || exportBusy !== 'idle'}
              onClick={() => exportar('pdf')}
            >
              {exportBusy === 'pdf' ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
              ) : (
                <IconFileTypePdf className="h-3.5 w-3.5" stroke={1.75} />
              )}
              PDF
            </button>
          </div>
          <span className="wr-expectativa-ranking-modal__count tabular-nums">
            {loadingEmendas ? (
              <span className="inline-flex items-center gap-1.5">
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.5} />
                Emendas…
              </span>
            ) : (
              `${filtradas.length.toLocaleString('pt-BR')} município${filtradas.length === 1 ? '' : 's'}`
            )}
          </span>
        </div>

        <div className="wr-expectativa-ranking-modal__filtros" role="group" aria-label="Filtros do ranking">
          <div className="wr-expectativa-ranking-modal__filtro-grupo">
            {FILTRO_EXPECTATIVA_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={filtroExpectativa === opcao.id}
                className={cn(
                  'wr-expectativa-ranking-modal__filtro',
                  filtroExpectativa === opcao.id &&
                    'wr-expectativa-ranking-modal__filtro--ativo',
                )}
                onClick={() => setFiltroExpectativa(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
          <div className="wr-expectativa-ranking-modal__filtro-grupo">
            {FILTRO_EMENDAS_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={filtroEmendas === opcao.id}
                className={cn(
                  'wr-expectativa-ranking-modal__filtro',
                  filtroEmendas === opcao.id &&
                    'wr-expectativa-ranking-modal__filtro--ativo',
                )}
                onClick={() => setFiltroEmendas(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
          <div className="wr-expectativa-ranking-modal__filtro-grupo">
            {FILTRO_OBRAS_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={filtroObras === opcao.id}
                className={cn(
                  'wr-expectativa-ranking-modal__filtro',
                  filtroObras === opcao.id &&
                    'wr-expectativa-ranking-modal__filtro--ativo',
                )}
                onClick={() => setFiltroObras(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wr-expectativa-ranking-modal__table-wrap">
          <table className="wr-expectativa-ranking-modal__table">
            <thead>
              <tr>
                <th>
                  <TerritorioSortableHeaderButton
                    label="Cidade"
                    active={sortCol === 'cidade'}
                    asc={sortAsc}
                    onClick={() => alternarSort('cidade')}
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Expectativa"
                    active={sortCol === 'expectativa'}
                    asc={sortAsc}
                    onClick={() => alternarSort('expectativa')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Peso"
                    active={sortCol === 'peso'}
                    asc={sortAsc}
                    onClick={() => alternarSort('peso')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="População"
                    active={sortCol === 'populacao'}
                    asc={sortAsc}
                    onClick={() => alternarSort('populacao')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Eleitores"
                    active={sortCol === 'eleitores'}
                    asc={sortAsc}
                    onClick={() => alternarSort('eleitores')}
                    align="right"
                    compact
                  />
                </th>
                <th>
                  <TerritorioSortableHeaderButton
                    label="Última visita"
                    active={sortCol === 'ultimaVisita'}
                    asc={sortAsc}
                    onClick={() => alternarSort('ultimaVisita')}
                    compact
                  />
                </th>
                <th>
                  <TerritorioSortableHeaderButton
                    label="Próx. visita"
                    active={sortCol === 'proxVisita'}
                    asc={sortAsc}
                    onClick={() => alternarSort('proxVisita')}
                    compact
                  />
                </th>
                <th>Emendas</th>
                <th>Obras</th>
                <th>
                  <TerritorioSortableHeaderButton
                    label="Pesquisas"
                    active={sortCol === 'pesquisa'}
                    asc={sortAsc}
                    onClick={() => alternarSort('pesquisa')}
                    align="right"
                    compact
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((row) => (
                <tr key={row.municipio}>
                  <td className="wr-expectativa-ranking-modal__cidade">{row.municipio}</td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatWarRoomNumber(row.expectativa)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatPesoPct(row.peso)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatInt(row.populacao)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatInt(row.eleitores)}
                  </td>
                  <td className="tabular-nums">{row.ultimaVisitaLabel}</td>
                  <td>{row.proxVisitaLabel}</td>
                  <td>
                    <button
                      type="button"
                      className={cn(
                        'wr-expectativa-ranking-modal__flag',
                        'wr-expectativa-ranking-modal__flag--btn',
                        row.temEmendas
                          ? 'wr-expectativa-ranking-modal__flag--sim'
                          : 'wr-expectativa-ranking-modal__flag--nao',
                      )}
                      aria-label={`Ver emendas de ${row.municipio}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        abrirEmendas(row.municipio)
                      }}
                    >
                      {row.temEmendas ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={cn(
                        'wr-expectativa-ranking-modal__flag',
                        'wr-expectativa-ranking-modal__flag--btn',
                        row.temObras
                          ? 'wr-expectativa-ranking-modal__flag--sim'
                          : 'wr-expectativa-ranking-modal__flag--nao',
                      )}
                      aria-label={`Ver obras de ${row.municipio}`}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        abrirObras(row.municipio)
                      }}
                    >
                      {row.temObras ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {row.pesquisa ? (
                      <button
                        type="button"
                        className={cn(
                          'wr-expectativa-ranking-modal__flag',
                          'wr-expectativa-ranking-modal__flag--btn',
                          'wr-expectativa-ranking-modal__flag--pesquisa',
                          row.pesquisaPosicao != null &&
                            row.pesquisaPosicao > 5 &&
                            'wr-expectativa-ranking-modal__flag--alerta',
                        )}
                        aria-label={`Ver ranking da pesquisa em ${row.municipio}`}
                        title={
                          row.pesquisa
                            ? `${formatPosicaoPesquisa(row.pesquisaPosicao)} · ${row.pesquisa.instituto} · ${row.pesquisa.dataLabel}`
                            : undefined
                        }
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          abrirPesquisa(row.pesquisa)
                        }}
                      >
                        {formatPosicaoPesquisa(row.pesquisaPosicao)}
                      </button>
                    ) : (
                      <span className="wr-expectativa-ranking-modal__flag wr-expectativa-ranking-modal__flag--nao">
                        {loadingPesquisas ? '…' : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtradas.length > 0 ? (
              <tfoot>
                <tr className="wr-expectativa-ranking-modal__totais">
                  <td className="wr-expectativa-ranking-modal__cidade">
                    Total ({filtradas.length.toLocaleString('pt-BR')})
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatWarRoomNumber(totais.expectativa)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatPesoPct(totais.peso)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatInt(totais.populacao)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatInt(totais.eleitores)}
                  </td>
                  <td className="tabular-nums">
                    {totais.comUltimaVisita.toLocaleString('pt-BR')} c/
                  </td>
                  <td className="tabular-nums">
                    {totais.comProxVisita.toLocaleString('pt-BR')} c/
                  </td>
                  <td className="tabular-nums">
                    {totais.comEmendas.toLocaleString('pt-BR')} sim
                  </td>
                  <td className="tabular-nums">
                    {totais.comObras.toLocaleString('pt-BR')} sim
                  </td>
                  <td className="tabular-nums">
                    {totais.comPesquisa.toLocaleString('pt-BR')} c/
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
          {filtradas.length === 0 ? (
            <p className="wr-visita-modal__state">Nenhum município encontrado.</p>
          ) : null}
        </div>
      </div>
      </div>

      {detalhe?.tipo === 'emendas' ? (
        <WarRoomMunicipioEmendasModal
          municipio={detalhe.municipio}
          emendas={emendasAll}
          onClose={() => setDetalhe(null)}
        />
      ) : null}

      {detalhe?.tipo === 'obras' ? (
        <WarRoomMunicipioObrasModal
          municipio={detalhe.municipio}
          obras={obrasAll}
          recapObras={recapObras}
          loading={loadingObras && obrasAll == null}
          onClose={() => setDetalhe(null)}
        />
      ) : null}

      {pesquisaDetalhe ? (
        <WarRoomPesquisaRankingModal
          pesquisa={pesquisaDetalhe}
          onClose={() => setPesquisaDetalhe(null)}
        />
      ) : null}
    </>,
    document.body,
  )
}
