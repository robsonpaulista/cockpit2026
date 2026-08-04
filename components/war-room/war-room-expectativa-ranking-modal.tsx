'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconCalendarEvent,
  IconChartBar,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconFileTypePdf,
  IconLoader2,
  IconMinus,
  IconPlane,
  IconSearch,
  IconTrendingDown,
  IconTrendingUp,
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
import {
  todayKeyInTz,
  type WarRoomAgendaProximoItem,
} from '@/lib/war-room/agenda-proximos'
import {
  diasDesdeVisita,
  nivelVisitaAlerta,
  precisaVisitaAltaExpectativa,
  tituloVisitaAlerta,
  type VisitaAlertaNivel,
} from '@/lib/war-room/expectativa-visita-alerta'
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
import { WarRoomAgendaProximosModal } from '@/components/war-room/war-room-agenda-proximos-modal'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import type { ObraRecapMatchSource } from '@/lib/obras-recap-match'
import {
  demandasToObrasMapa,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import {
  buildWarRoomPesquisasConsolidadas,
  mapUltimasDuasPesquisasPorMunicipio,
  tendenciaPctPesquisa,
  type WarRoomPesquisaConsolidadaReal,
  type WarRoomPesquisaParMunicipio,
  type WarRoomPesquisaTendencia,
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
  | 'diasVisita'
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
  /** Dias corridos desde a última visita até hoje; null se sem visita. */
  diasDesdeUltimaVisita: number | null
  diasDesdeLabel: string
  proxVisitaLabel: string
  proxVisitaSort: string
  temEmendas: boolean
  temObras: boolean
  /** Posição do candidato foco na última pesquisa consolidada. */
  pesquisaPosicao: number | null
  pesquisaPctUltima: number | null
  pesquisaPctAnterior: number | null
  pesquisaTendencia: WarRoomPesquisaTendencia
  pesquisa: WarRoomPesquisaConsolidadaReal | null
  /** Expectativa ≥ 4k/10d (prioridade) ou >0/15d (base) — igual card Expectativa. */
  precisaVisita: boolean
  visitaAlertaNivel: VisitaAlertaNivel | null
  /** Agenda nos próximos 7 dias (igual card Expectativa · ícone calendário). */
  temAgendaProxima: boolean
}

type Props = {
  municipios: IptMunicipio[]
  /** Obras já convertidas do Cadastro de Demandas (Sheets) — mesma fonte do Mapa. */
  obras?: ObraMapaRow[] | null
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>
  onClose: () => void
  /** `page` = conteúdo full da visão Copiloto (sem overlay). */
  variant?: 'modal' | 'page'
}

const FILTRO_EXPECTATIVA_OPCOES: Array<{ id: FiltroExpectativa; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'gt0', label: '> 0' },
  { id: 'eq0', label: '= 0' },
]

const FILTRO_EMENDAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com' },
  { id: 'sem', label: 'Sem' },
]

const FILTRO_OBRAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com' },
  { id: 'sem', label: 'Sem' },
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

function PesoProgressBar({
  peso,
  maxPeso,
}: {
  peso: number
  maxPeso: number
}) {
  const safeMax = maxPeso > 0 ? maxPeso : 1
  const fillPct = Math.min(100, Math.max(0, (peso / safeMax) * 100))
  const label = formatPesoPct(peso)
  return (
    <div
      className="wr-expectativa-ranking-modal__peso"
      role="progressbar"
      aria-valuenow={Number(peso.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={Number(safeMax.toFixed(1))}
      aria-label={`Peso ${label}`}
      title={label}
    >
      <div className="wr-expectativa-ranking-modal__peso-track">
        <span
          className="wr-expectativa-ranking-modal__peso-fill"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="wr-expectativa-ranking-modal__peso-label">{label}</span>
    </div>
  )
}

function formatInt(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('pt-BR')
}

function formatPosicaoPesquisa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 1) return '—'
  return `${Math.round(value)}º`
}

function formatPctPesquisa(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatDiasDesdeVisita(dias: number | null): string {
  if (dias == null || !Number.isFinite(dias)) return '—'
  if (dias < 0) return '—'
  if (dias === 0) return 'hoje'
  if (dias === 1) return '1 dia'
  return `${dias.toLocaleString('pt-BR')} dias`
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
  obras: obrasProp = null,
  agendaPorMunicipio,
  onClose,
  variant = 'modal',
}: Props) {
  const isPage = variant === 'page'
  const tituloId = useId()
  const [mounted, setMounted] = useState(isPage)
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
    Map<string, WarRoomPesquisaParMunicipio>
  >(() => new Map())
  const [loadingPesquisas, setLoadingPesquisas] = useState(true)
  const [pesquisaDetalhe, setPesquisaDetalhe] =
    useState<WarRoomPesquisaConsolidadaReal | null>(null)
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(
    null,
  )

  const agendaModalItens = useMemo(() => {
    if (!agendaModalMunicipio) return []
    return (
      agendaPorMunicipio.get(normalizeIptMunicipio(agendaModalMunicipio)) ?? []
    )
  }, [agendaModalMunicipio, agendaPorMunicipio])

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    if (!isPage) {
      document.body.style.overflow = 'hidden'
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (agendaModalMunicipio) {
        setAgendaModalMunicipio(null)
        return
      }
      if (detalhe) {
        setDetalhe(null)
        return
      }
      if (pesquisaDetalhe) {
        setPesquisaDetalhe(null)
        return
      }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      if (!isPage) {
        document.body.style.overflow = prev
      }
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, detalhe, pesquisaDetalhe, agendaModalMunicipio, isPage])

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
        if (!cancelled) setPesquisaByMun(mapUltimasDuasPesquisasPorMunicipio(built))
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
        const needsObras = obrasAll == null
        const needsRecap = recapObras == null

        // Preferir obras já carregadas pelo IPT (Sheets / Cadastro de Demandas).
        if (needsObras && Array.isArray(obrasProp)) {
          if (!cancelled) setObrasAll(obrasProp)
        }

        const [demandasRes, recapRes] = await Promise.all([
          needsObras && !Array.isArray(obrasProp)
            ? fetch('/api/campo/demands', { cache: 'no-store' })
            : Promise.resolve(null),
          needsRecap
            ? fetch('/api/obras/recap', { cache: 'no-store' })
            : Promise.resolve(null),
        ])

        if (cancelled) return

        if (demandasRes) {
          const json = await demandasRes.json().catch(() => null)
          if (!demandasRes.ok) {
            setObrasAll([])
          } else {
            setObrasAll(
              demandasToObrasMapa(
                Array.isArray(json) ? (json as CampoDemandaObraRow[]) : [],
              ),
            )
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
          if (obrasAll == null) setObrasAll(Array.isArray(obrasProp) ? obrasProp : [])
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
  }, [detalhe, obrasAll, obrasProp, recapObras])

  const rows = useMemo<RankingRow[]>(() => {
    return municipios.map((m) => {
      const key = normalizeIptMunicipio(m.municipio)
      const demo = getDemografiaMunicipio(m.municipio)
      const populacao =
        demo?.populacao_estimada_ultimo_ano ?? demo?.populacao_censo_2022 ?? null
      const agendaItens = agendaPorMunicipio.get(key)
      const prox = proxVisitaDe(agendaItens)
      const pesquisaPar = pesquisaByMun.get(key) ?? null
      const pesquisa = pesquisaPar?.ultima ?? null
      const pesquisaAnterior = pesquisaPar?.anterior ?? null
      const pctUltima = pesquisa?.jadyelPct ?? null
      const pctAnterior = pesquisaAnterior?.jadyelPct ?? null
      const dias = diasDesdeVisita(m.ultimaVisita ?? null)
      return {
        municipio: m.municipio,
        expectativa: m.expectativaVotos,
        peso: m.pesoExpectativaPct,
        populacao,
        eleitores: getEleitoradoByCity(m.municipio),
        ultimaVisita: m.ultimaVisita ?? null,
        ultimaVisitaLabel: formatDataCurta(m.ultimaVisita),
        diasDesdeUltimaVisita: dias,
        diasDesdeLabel: formatDiasDesdeVisita(dias),
        proxVisitaLabel: prox.label,
        proxVisitaSort: prox.sort,
        temEmendas: emendasKeys.has(key),
        temObras:
          m.sinais.obras === 'bem' || (m.detalhes.obrasQuantidade ?? 0) > 0,
        pesquisaPosicao: pesquisa?.jadyelPosicao ?? null,
        pesquisaPctUltima: pctUltima,
        pesquisaPctAnterior: pctAnterior,
        pesquisaTendencia: tendenciaPctPesquisa(pctUltima, pctAnterior),
        pesquisa,
        precisaVisita: precisaVisitaAltaExpectativa(m),
        visitaAlertaNivel: nivelVisitaAlerta(m),
        temAgendaProxima: (agendaItens?.length ?? 0) > 0,
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
      if (sortCol === 'diasVisita') {
        const by = compareTerritorioNumber(
          a.diasDesdeUltimaVisita ?? -1,
          b.diasDesdeUltimaVisita ?? -1,
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

  const maxPesoFiltrado = useMemo(() => {
    let max = 0
    for (const row of filtradas) {
      if (row.peso > max) max = row.peso
    }
    return max
  }, [filtradas])

  const alternarSort = (column: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, [
      'cidade',
      'diasVisita',
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
        diasDesdeLabel: row.diasDesdeLabel,
        proxVisitaLabel: row.proxVisitaLabel,
        temEmendas: row.temEmendas,
        temObras: row.temObras,
        pesquisaPosicaoLabel: [
          formatPosicaoPesquisa(row.pesquisaPosicao),
          formatPctPesquisa(row.pesquisaPctUltima),
        ]
          .filter((part) => part !== '—')
          .join(' · ') || '—',
        pesquisaTendenciaLabel:
          row.pesquisaTendencia === 'alta'
            ? 'alta'
            : row.pesquisaTendencia === 'baixa'
              ? 'baixa'
              : row.pesquisaTendencia === 'estavel'
                ? 'estável'
                : '—',
        pesquisaPctUltimaLabel: formatPctPesquisa(row.pesquisaPctUltima),
        pesquisaPctAnteriorLabel: formatPctPesquisa(row.pesquisaPctAnterior),
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

  const panel = (
        <div
          role={isPage ? 'region' : 'dialog'}
          aria-modal={isPage ? undefined : true}
          aria-labelledby={tituloId}
          className={
            isPage
              ? 'wr-expectativa-ranking-modal__page-panel'
              : 'wr-visita-modal__panel wr-expectativa-ranking-modal__panel'
          }
        >
        {!isPage ? (
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
        ) : (
          <h2 id={tituloId} className="sr-only">
            Ranking completo ({municipios.length})
          </h2>
        )}

        <div
          className={cn(
            'wr-expectativa-ranking-modal__toolbar',
            isPage && 'wr-expectativa-ranking-modal__toolbar--as-header',
          )}
          role="search"
          aria-label="Filtros do ranking"
        >
          <span className="wr-expectativa-ranking-modal__toolbar-title">Cidades</span>
          <label className="wr-expectativa-ranking-modal__search">
            <IconSearch className="h-3.5 w-3.5 shrink-0" stroke={1.75} aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar município…"
            />
          </label>

          <div className="wr-expectativa-ranking-modal__filtros">
            <div
              className="wr-expectativa-ranking-modal__filtro-grupo"
              role="group"
              aria-label="Expectativa"
            >
              <span className="wr-expectativa-ranking-modal__filtro-label">Expectativa</span>
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
            <div
              className="wr-expectativa-ranking-modal__filtro-grupo"
              role="group"
              aria-label="Emendas"
            >
              <span className="wr-expectativa-ranking-modal__filtro-label">Emendas</span>
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
            <div
              className="wr-expectativa-ranking-modal__filtro-grupo"
              role="group"
              aria-label="Obras"
            >
              <span className="wr-expectativa-ranking-modal__filtro-label">Obras</span>
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

          <div className="wr-expectativa-ranking-modal__toolbar-end">
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
          </div>
        </div>

        <div className="wr-expectativa-ranking-modal__table-wrap">
          <table className="wr-expectativa-ranking-modal__table">
            <thead>
              <tr>
                <th className="wr-expectativa-ranking-modal__col-cidade">
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
                <th className="wr-expectativa-ranking-modal__col-peso">
                  <TerritorioSortableHeaderButton
                    label="Peso"
                    active={sortCol === 'peso'}
                    asc={sortAsc}
                    onClick={() => alternarSort('peso')}
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
                <th className="wr-expectativa-ranking-modal__center">Emendas</th>
                <th className="wr-expectativa-ranking-modal__center">Obras</th>
                <th className="wr-expectativa-ranking-modal__center">
                  <TerritorioSortableHeaderButton
                    label="Pesquisas"
                    active={sortCol === 'pesquisa'}
                    asc={sortAsc}
                    onClick={() => alternarSort('pesquisa')}
                    align="center"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Última visita"
                    active={sortCol === 'diasVisita'}
                    asc={sortAsc}
                    onClick={() => alternarSort('diasVisita')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Próx. visita"
                    active={sortCol === 'proxVisita'}
                    asc={sortAsc}
                    onClick={() => alternarSort('proxVisita')}
                    align="right"
                    compact
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((row) => (
                <tr key={row.municipio}>
                  <td className="wr-expectativa-ranking-modal__cidade">
                    <span className="wr-expectativa-ranking-modal__cidade-inner">
                      <span className="wr-expectativa-ranking-modal__cidade-nome">
                        {row.municipio}
                      </span>
                      {row.temAgendaProxima || row.precisaVisita ? (
                        <span className="wr-expectativa-ranking-modal__cidade-alertas">
                          {row.temAgendaProxima ? (
                            <button
                              type="button"
                              className="wr-expectativa-clean__agenda-alerta wr-expectativa-ranking-modal__agenda-alerta"
                              title="Agenda nos próximos 7 dias"
                              aria-label={`Ver agenda dos próximos 7 dias em ${row.municipio}`}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setAgendaModalMunicipio(row.municipio)
                              }}
                            >
                              <IconCalendarEvent
                                className="h-3.5 w-3.5"
                                stroke={1.75}
                                aria-hidden
                              />
                            </button>
                          ) : null}
                          {row.precisaVisita && row.visitaAlertaNivel ? (
                            <span
                              className={cn(
                                'wr-expectativa-clean__visita-alerta wr-expectativa-ranking-modal__visita-alerta',
                                row.visitaAlertaNivel === 'prioridade' &&
                                  'wr-expectativa-ranking-modal__visita-alerta--prioridade',
                              )}
                              title={tituloVisitaAlerta(row.visitaAlertaNivel)}
                              aria-label={`Precisa visitar ${row.municipio}: ${tituloVisitaAlerta(row.visitaAlertaNivel)}`}
                            >
                              <IconPlane
                                className="h-3.5 w-3.5"
                                stroke={1.75}
                                aria-hidden
                              />
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {formatWarRoomNumber(row.expectativa)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__peso-cell">
                    <PesoProgressBar peso={row.peso} maxPeso={maxPesoFiltrado} />
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      row.populacao != null
                        ? `População: ${formatInt(row.populacao)}`
                        : undefined
                    }
                  >
                    {formatInt(row.eleitores)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__center">
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
                  <td className="wr-expectativa-ranking-modal__center">
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
                  <td className="wr-expectativa-ranking-modal__center">
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
                            ? [
                                `${formatPosicaoPesquisa(row.pesquisaPosicao)} · ${formatPctPesquisa(row.pesquisaPctUltima)}`,
                                row.pesquisaPctAnterior != null
                                  ? `Anterior: ${formatPctPesquisa(row.pesquisaPctAnterior)}`
                                  : null,
                                `${row.pesquisa.instituto} · ${row.pesquisa.dataLabel}`,
                                row.pesquisaTendencia
                                  ? `Tendência ${
                                      row.pesquisaTendencia === 'alta'
                                        ? 'alta'
                                        : row.pesquisaTendencia === 'baixa'
                                          ? 'baixa'
                                          : 'estável'
                                    }`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            : undefined
                        }
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          abrirPesquisa(row.pesquisa)
                        }}
                      >
                        <span>{formatPosicaoPesquisa(row.pesquisaPosicao)}</span>
                        {row.pesquisaTendencia === 'alta' ? (
                          <IconTrendingUp
                            className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--alta"
                            stroke={2}
                            aria-label="Crescimento"
                          />
                        ) : null}
                        {row.pesquisaTendencia === 'baixa' ? (
                          <IconTrendingDown
                            className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--baixa"
                            stroke={2}
                            aria-label="Queda"
                          />
                        ) : null}
                        {row.pesquisaTendencia === 'estavel' ? (
                          <IconMinus
                            className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--estavel"
                            stroke={2}
                            aria-label="Estabilidade"
                          />
                        ) : null}
                        <span className="wr-expectativa-ranking-modal__pesquisa-pct">
                          {formatPctPesquisa(row.pesquisaPctUltima)}
                        </span>
                      </button>
                    ) : (
                      <span className="wr-expectativa-ranking-modal__flag wr-expectativa-ranking-modal__flag--nao">
                        {loadingPesquisas ? '…' : '—'}
                      </span>
                    )}
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      row.ultimaVisitaLabel !== '—'
                        ? row.ultimaVisitaLabel
                        : undefined
                    }
                  >
                    {row.diasDesdeLabel}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {row.proxVisitaLabel}
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
                  <td className="wr-expectativa-ranking-modal__col-peso tabular-nums">
                    {formatPesoPct(totais.peso)}
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      totais.populacao
                        ? `População: ${formatInt(totais.populacao)}`
                        : undefined
                    }
                  >
                    {formatInt(totais.eleitores)}
                  </td>
                  <td className="wr-expectativa-ranking-modal__center tabular-nums">
                    {totais.comEmendas.toLocaleString('pt-BR')} sim
                  </td>
                  <td className="wr-expectativa-ranking-modal__center tabular-nums">
                    {totais.comObras.toLocaleString('pt-BR')} sim
                  </td>
                  <td className="wr-expectativa-ranking-modal__center tabular-nums">
                    {totais.comPesquisa.toLocaleString('pt-BR')} c/
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {totais.comUltimaVisita.toLocaleString('pt-BR')} c/
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {totais.comProxVisita.toLocaleString('pt-BR')} c/
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
  )

  const nested = (
    <>
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

      {agendaModalMunicipio ? (
        <WarRoomAgendaProximosModal
          municipio={agendaModalMunicipio}
          itens={agendaModalItens}
          hojeKey={todayKeyInTz()}
          municipiosIpt={municipios}
          agendaPorMunicipio={agendaPorMunicipio}
          onClose={() => setAgendaModalMunicipio(null)}
        />
      ) : null}
    </>
  )

  if (isPage) {
    return (
      <>
        {panel}
        {nested}
      </>
    )
  }

  return createPortal(
    <>
      <div className="wr-visita-modal" role="presentation">
        <button
          type="button"
          className="wr-visita-modal__backdrop"
          aria-label="Fechar"
          onClick={onClose}
        />
        {panel}
      </div>
      {nested}
    </>,
    document.body,
  )
}
