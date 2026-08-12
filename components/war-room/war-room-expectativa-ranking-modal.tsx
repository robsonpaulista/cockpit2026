'use client'

import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Calendar, ChevronsUpDown, Download, FileSpreadsheet, FileText, Loader2, Minus, Search, Send, Sheet, TrendingDown, TrendingUp, Trophy, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useAnimatedCounter } from '@/hooks/use-animated-counter'
import type { IptMunicipio } from '@/lib/ipt'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { getDemografiaMunicipio } from '@/lib/demografia-municipio'
import { getEleitoradoByCity } from '@/lib/eleitores'
import {
  filtrarEmendasPorMunicipio,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import {
  AGENDA_PROXIMOS_JANELA_DIAS,
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
import {
  WarRoomComunicarLideresModal,
  type ComunicarLideresVisita,
} from '@/components/war-room/war-room-comunicar-lideres-modal'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import {
  demandasToObrasMapa,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import {
  buildWarRoomPesquisasConsolidadas,
  mapUltimasDuasPesquisasPorMunicipio,
  tendenciaPctPesquisa,
  votosProjetadosPesquisaPct,
  metaVsProjPesquisaDiff,
  type WarRoomPesquisaConsolidadaReal,
  type WarRoomPesquisaParMunicipio,
  type WarRoomPesquisaTendencia,
} from '@/lib/war-room/pesquisas-consolidadas'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import {
  fetchFederal2022VotosTotaisPorMunicipioPI,
  obterVotosFederal2022TotaisMunicipio,
} from '@/lib/jadyel-federal-2022-pi-votos'
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
  | 'projPesquisa'
  | 'metaProj'

type FiltroExpectativa = 'todos' | 'gt0' | 'eq0'
type FiltroBinario = 'todos' | 'com' | 'sem'
type FiltroVisitas = 'todos' | 'com' | 'sem' | 'necessidade'

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
  proxVisitaDataLabel: string
  proxVisitaHorario: string
  temEmendas: boolean
  temObras: boolean
  /** Posição do candidato foco na última pesquisa consolidada. */
  pesquisaPosicao: number | null
  /** Candidato foco ausente na onda (badge NP · 0%). */
  pesquisaNaoPontuou: boolean
  pesquisaPctUltima: number | null
  pesquisaPctAnterior: number | null
  pesquisaTendencia: WarRoomPesquisaTendencia
  pesquisa: WarRoomPesquisaConsolidadaReal | null
  /**
   * Votos projetados: % sobre válidos × total DF 2022 na cidade.
   * null = sem pesquisa (ou sem base 2022); 0 = NP / 0%.
   */
  projPesquisaVotos: number | null
  /** Total nominais Dep. Federal 2022 na cidade (base da proyección). */
  votosFederal2022: number | null
  /** Proj − Meta (votos); null = sem pesquisa. */
  metaVsProjDiff: number | null
  /** Expectativa ≥ 4k/10d (prioridade) ou >0/15d (base) — igual card Expectativa. */
  precisaVisita: boolean
  visitaAlertaNivel: VisitaAlertaNivel | null
  /** Agenda nos próximos N dias (igual card Expectativa · ícone calendário). */
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
  { id: 'todos', label: 'Todas as cidades' },
  { id: 'gt0', label: 'Com meta' },
  { id: 'eq0', label: 'Sem meta' },
]

const FILTRO_EMENDAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com emendas' },
  { id: 'sem', label: 'Sem emendas' },
]

const FILTRO_PESQUISAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com pesquisa' },
  { id: 'sem', label: 'Sem pesquisa' },
]

const FILTRO_VISITAS_OPCOES: Array<{ id: FiltroVisitas; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com visita' },
  { id: 'sem', label: 'Sem visita' },
  { id: 'necessidade', label: 'Com necessidade' },
]

const FILTRO_OBRAS_OPCOES: Array<{ id: FiltroBinario; label: string }> = [
  { id: 'todos', label: 'Todas' },
  { id: 'com', label: 'Com obras' },
  { id: 'sem', label: 'Sem obras' },
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
  resetKey,
}: {
  peso: number
  maxPeso: number
  resetKey: string | number
}) {
  const safeMax = maxPeso > 0 ? maxPeso : 1
  const fillPct = Math.min(100, Math.max(0, (peso / safeMax) * 100))
  const animatedPeso = useAnimatedCounter(peso, { durationMs: 1200, resetKey })
  const label = formatPesoPct(animatedPeso)
  const segments = 40
  const filled = Math.round((fillPct / 100) * segments)

  return (
    <div
      className="wr-expectativa-ranking-modal__peso"
      role="progressbar"
      aria-valuenow={Number(peso.toFixed(1))}
      aria-valuemin={0}
      aria-valuemax={Number(safeMax.toFixed(1))}
      aria-label={`Peso ${formatPesoPct(peso)}`}
      title={formatPesoPct(peso)}
    >
      <div className="wr-expectativa-ranking-modal__peso-comb" aria-hidden>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={
              i < filled
                ? 'wr-expectativa-ranking-modal__peso-tick wr-expectativa-ranking-modal__peso-tick--on'
                : 'wr-expectativa-ranking-modal__peso-tick'
            }
            style={{ ['--tick-i' as string]: i } as CSSProperties}
          />
        ))}
      </div>
      <span className="wr-expectativa-ranking-modal__peso-label wr-expectativa-ranking-modal__enter-num">
        {label}
      </span>
    </div>
  )
}

function EnterInt({
  value,
  resetKey,
  empty = '—',
}: {
  value: number | null | undefined
  resetKey: string | number
  empty?: string
}) {
  const enabled = value != null && Number.isFinite(value)
  const animated = useAnimatedCounter(enabled ? (value as number) : 0, {
    durationMs: 1100,
    enabled,
    resetKey,
  })
  return (
    <span className="wr-expectativa-ranking-modal__enter-num tabular-nums">
      {enabled ? formatInt(animated) : empty}
    </span>
  )
}

function EnterWarRoomNumber({
  value,
  resetKey,
}: {
  value: number
  resetKey: string | number
}) {
  const animated = useAnimatedCounter(value, { durationMs: 1100, resetKey })
  return (
    <span className="wr-expectativa-ranking-modal__enter-num tabular-nums">
      {formatWarRoomNumber(animated)}
    </span>
  )
}

function EnterPct({
  value,
  resetKey,
}: {
  value: number
  resetKey: string | number
}) {
  const animated = useAnimatedCounter(value, { durationMs: 1100, resetKey })
  return (
    <span className="wr-expectativa-ranking-modal__enter-num tabular-nums">
      {formatPctPesquisa(animated)}
    </span>
  )
}

/** Proj − Meta em votos (azul ≥ 0, vermelho < 0). */
function MetaVsProjValue({
  diff,
  meta,
  projVotos,
  resetKey,
}: {
  diff: number
  meta: number
  projVotos: number | null
  resetKey: string | number
}) {
  const under = diff < 0
  const animatedAbs = useAnimatedCounter(Math.abs(diff), { durationMs: 1100, resetKey })
  const signedLive =
    diff === 0
      ? formatWarRoomNumber(0)
      : `${diff > 0 ? '+' : '-'}${formatWarRoomNumber(animatedAbs)}`
  const signed = `${diff > 0 ? '+' : ''}${formatWarRoomNumber(diff)}`
  const title = [
    projVotos != null ? `Proj. ${formatInt(projVotos)}` : null,
    `Meta ${formatInt(meta)}`,
    `${signed} (Proj − Meta)`,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span
      className={cn(
        'wr-expectativa-ranking-modal__meta-proj',
        'wr-expectativa-ranking-modal__enter-num',
        'tabular-nums',
        under
          ? 'wr-expectativa-ranking-modal__meta-proj--under'
          : diff > 0
            ? 'wr-expectativa-ranking-modal__meta-proj--ok'
            : 'wr-expectativa-ranking-modal__meta-proj--flat',
      )}
      title={title}
    >
      <span className="wr-expectativa-ranking-modal__meta-proj-value">{signedLive}</span>
      {diff > 0 ? (
        <ArrowUp
          className="wr-expectativa-ranking-modal__meta-proj-icon wr-expectativa-ranking-modal__meta-proj-icon--up"
          strokeWidth={1.5}
          aria-label="Acima da meta"
        />
      ) : null}
      {diff < 0 ? (
        <ArrowDown
          className="wr-expectativa-ranking-modal__meta-proj-icon wr-expectativa-ranking-modal__meta-proj-icon--down"
          strokeWidth={1.5}
          aria-label="Abaixo da meta"
        />
      ) : null}
    </span>
  )
}

function formatInt(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('pt-BR')
}

function formatPosicaoPesquisa(
  value: number | null | undefined,
  naoPontuou?: boolean,
): string {
  if (naoPontuou) return 'NP'
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

function PesquisaPosicaoMark({
  posicao,
  naoPontuou,
}: {
  posicao: number | null
  naoPontuou: boolean
}) {
  if (naoPontuou) {
    return (
      <span className="wr-expectativa-ranking-modal__pesquisa-pos-np" aria-label="Não pontuou">
        NP
      </span>
    )
  }
  const n =
    posicao != null && Number.isFinite(posicao) ? Math.round(posicao) : null
  if (n == null || n < 1) {
    return <span aria-hidden>—</span>
  }
  if (n >= 1 && n <= 3) {
    const lugarClass =
      n === 1
        ? 'wr-expectativa-ranking-modal__pesquisa-trophy--ouro'
        : n === 2
          ? 'wr-expectativa-ranking-modal__pesquisa-trophy--prata'
          : 'wr-expectativa-ranking-modal__pesquisa-trophy--bronze'
    return (
      <span
        className="wr-expectativa-ranking-modal__pesquisa-pos-podium"
        aria-label={`${n}º lugar`}
      >
        <Trophy
          className={cn(
            'wr-expectativa-ranking-modal__pesquisa-trophy',
            lugarClass,
          )}
          strokeWidth={1.5}
          aria-hidden
        />
        <span className="wr-expectativa-ranking-modal__pesquisa-pos-num">{n}º</span>
      </span>
    )
  }
  return (
    <span
      className="wr-expectativa-ranking-modal__pesquisa-pos-num"
      aria-label={`${n}º lugar`}
    >
      {n}º
    </span>
  )
}

function formatDiasDesdeVisita(dias: number | null): string {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return '—'
  if (dias === 0) return 'há 0 dias'
  if (dias === 1) return 'há 1 dia'
  return `há ${dias.toLocaleString('pt-BR')} dias`
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
): {
  label: string
  sort: string
  dataLabel: string
  horario: string
} {
  if (!itens || itens.length === 0) {
    return { label: '—', sort: '', dataLabel: '', horario: '' }
  }
  const first = [...itens].sort((a, b) => {
    const byDate = a.dataKey.localeCompare(b.dataKey)
    if (byDate !== 0) return byDate
    return a.horario.localeCompare(b.horario, 'pt-BR')
  })[0]!
  const label = first.horario
    ? `${first.dataLabel} ${first.horario}`
    : first.dataLabel
  return {
    label,
    sort: `${first.dataKey} ${first.horario}`,
    dataLabel: first.dataLabel,
    horario: first.horario,
  }
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
  const [filtroPesquisas, setFiltroPesquisas] = useState<FiltroBinario>('todos')
  const [filtroEmendas, setFiltroEmendas] = useState<FiltroBinario>('todos')
  const [filtroObras, setFiltroObras] = useState<FiltroBinario>('todos')
  const [filtroVisitas, setFiltroVisitas] = useState<FiltroVisitas>('todos')
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
  const [loadingObras, setLoadingObras] = useState(false)
  const [refreshingObras, setRefreshingObras] = useState(false)
  const [pesquisaByMun, setPesquisaByMun] = useState<
    Map<string, WarRoomPesquisaParMunicipio>
  >(() => new Map())
  const [loadingPesquisas, setLoadingPesquisas] = useState(true)
  const [federal2022ByMun, setFederal2022ByMun] = useState<Map<string, number>>(
    () => new Map(),
  )
  const [loadingFederal2022, setLoadingFederal2022] = useState(true)
  const [pesquisaDetalhe, setPesquisaDetalhe] =
    useState<WarRoomPesquisaConsolidadaReal | null>(null)
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(
    null,
  )
  const [comunicarVisita, setComunicarVisita] =
    useState<ComunicarLideresVisita | null>(null)

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
    let cancelled = false
    const load = async () => {
      setLoadingFederal2022(true)
      try {
        const mapa = await fetchFederal2022VotosTotaisPorMunicipioPI()
        if (!cancelled) setFederal2022ByMun(mapa ?? new Map())
      } catch {
        if (!cancelled) setFederal2022ByMun(new Map())
      } finally {
        if (!cancelled) setLoadingFederal2022(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const carregarObras = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = opts?.force === true
      if (!force && obrasAll != null) return

      if (force) setRefreshingObras(true)
      else setLoadingObras(true)

      try {
        if (!force && Array.isArray(obrasProp)) {
          setObrasAll(obrasProp)
          return
        }

        const demandasRes = await fetch('/api/campo/demands', { cache: 'no-store' })
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
      } catch {
        if (!force) {
          setObrasAll(Array.isArray(obrasProp) ? obrasProp : [])
        }
      } finally {
        setLoadingObras(false)
        setRefreshingObras(false)
      }
    },
    [obrasAll, obrasProp],
  )

  useEffect(() => {
    if (detalhe?.tipo !== 'obras') return
    if (obrasAll != null) return
    void carregarObras()
  }, [detalhe, obrasAll, carregarObras])

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
      const eleitores = getEleitoradoByCity(m.municipio)
      const votosFederal2022 = obterVotosFederal2022TotaisMunicipio(
        federal2022ByMun,
        m.municipio,
      )
      const projPesquisaVotos =
        pesquisa != null
          ? votosProjetadosPesquisaPct(pctUltima ?? 0, votosFederal2022)
          : null
      return {
        municipio: m.municipio,
        expectativa: m.expectativaVotos,
        peso: m.pesoExpectativaPct,
        populacao,
        eleitores,
        ultimaVisita: m.ultimaVisita ?? null,
        ultimaVisitaLabel: formatDataCurta(m.ultimaVisita),
        diasDesdeUltimaVisita: dias,
        diasDesdeLabel: formatDiasDesdeVisita(dias),
        proxVisitaLabel: prox.label,
        proxVisitaSort: prox.sort,
        proxVisitaDataLabel: prox.dataLabel,
        proxVisitaHorario: prox.horario,
        temEmendas: emendasKeys.has(key),
        temObras:
          m.sinais.obras === 'bem' || (m.detalhes.obrasQuantidade ?? 0) > 0,
        pesquisaPosicao: pesquisa?.jadyelPosicao ?? null,
        pesquisaNaoPontuou: Boolean(pesquisa?.jadyelNaoPontuou),
        pesquisaPctUltima: pctUltima,
        pesquisaPctAnterior: pctAnterior,
        pesquisaTendencia: tendenciaPctPesquisa(pctUltima, pctAnterior),
        pesquisa,
        projPesquisaVotos,
        votosFederal2022,
        metaVsProjDiff: metaVsProjPesquisaDiff(
          m.expectativaVotos,
          projPesquisaVotos,
        ),
        precisaVisita: precisaVisitaAltaExpectativa(m),
        visitaAlertaNivel: nivelVisitaAlerta(m),
        temAgendaProxima: (agendaItens?.length ?? 0) > 0,
      }
    })
  }, [agendaPorMunicipio, emendasKeys, federal2022ByMun, municipios, pesquisaByMun])

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    const base = rows.filter((r) => {
      if (termo && !normalizarBusca(r.municipio).includes(termo)) return false
      if (filtroExpectativa === 'gt0' && !(r.expectativa > 0)) return false
      if (filtroExpectativa === 'eq0' && r.expectativa !== 0) return false
      if (filtroPesquisas === 'com' && !r.pesquisa) return false
      if (filtroPesquisas === 'sem' && r.pesquisa) return false
      if (filtroEmendas === 'com' && !r.temEmendas) return false
      if (filtroEmendas === 'sem' && r.temEmendas) return false
      if (filtroObras === 'com' && !r.temObras) return false
      if (filtroObras === 'sem' && r.temObras) return false
      if (filtroVisitas === 'com' && !r.ultimaVisita) return false
      if (filtroVisitas === 'sem' && r.ultimaVisita) return false
      if (filtroVisitas === 'necessidade' && !r.precisaVisita) return false
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
        const posSort = (row: RankingRow) => {
          if (!row.pesquisa) return 9999
          if (row.pesquisaNaoPontuou) return 998
          return row.pesquisaPosicao ?? 999
        }
        const by = compareTerritorioNumber(posSort(a), posSort(b), sortAsc)
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'projPesquisa') {
        const by = compareTerritorioNumber(
          a.projPesquisaVotos ?? -1,
          b.projPesquisaVotos ?? -1,
          sortAsc,
        )
        if (by !== 0) return by
        return compareTerritorioText(a.municipio, b.municipio, true)
      }
      if (sortCol === 'metaProj') {
        const by = compareTerritorioNumber(
          a.metaVsProjDiff ?? Number.NEGATIVE_INFINITY,
          b.metaVsProjDiff ?? Number.NEGATIVE_INFINITY,
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
    filtroPesquisas,
    filtroVisitas,
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

  const enterAnimKey = useMemo(
    () =>
      `${sortCol}:${sortAsc ? 'a' : 'd'}:${filtradas.length}:${filtradas[0]?.municipio ?? ''}:${maxPesoFiltrado.toFixed(2)}`,
    [filtradas, maxPesoFiltrado, sortAsc, sortCol],
  )

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
    let projPesquisa = 0
    for (const row of filtradas) {
      expectativa += row.expectativa
      peso += row.peso
      if (row.populacao != null) populacao += row.populacao
      if (row.eleitores != null) eleitores += row.eleitores
      if (row.ultimaVisita) comUltimaVisita += 1
      if (row.proxVisitaSort) comProxVisita += 1
      if (row.temEmendas) comEmendas += 1
      if (row.temObras) comObras += 1
      if (row.pesquisa != null) comPesquisa += 1
      if (row.projPesquisaVotos != null) projPesquisa += row.projPesquisaVotos
    }
    /** Σ Proj − Σ Meta (mesmos totais do rodapé). */
    const metaVsProjDiff =
      filtradas.some((r) => r.projPesquisaVotos != null)
        ? Math.round(projPesquisa - expectativa)
        : null
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
      projPesquisa,
      metaVsProjDiff,
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
          formatPosicaoPesquisa(row.pesquisaPosicao, row.pesquisaNaoPontuou),
          formatPctPesquisa(row.pesquisaPctUltima),
        ]
          .filter((part) => part !== '—')
          .join(' · ') || '—',
        projPesquisaLabel:
          row.projPesquisaVotos != null
            ? String(Math.round(row.projPesquisaVotos))
            : '—',
        expectVsProjLabel:
          row.metaVsProjDiff != null
            ? `${row.metaVsProjDiff > 0 ? '+' : ''}${Math.round(row.metaVsProjDiff)}`
            : '—',
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
                <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
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
              <X className="h-4 w-4" strokeWidth={1.5} />
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
          <div className="wr-expectativa-ranking-modal__toolbar-intro">
            <span className="wr-expectativa-ranking-modal__toolbar-title">Cidades</span>
            <label className="wr-expectativa-ranking-modal__search">
              <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar município…"
              />
            </label>
          </div>

          <div className="wr-expectativa-ranking-modal__filtros">
            <label className="wr-expectativa-ranking-modal__filter-field">
              <span className="wr-expectativa-ranking-modal__filter-field-label">Meta</span>
              <span className="wr-expectativa-ranking-modal__filter-select-wrap">
                <select
                  className="wr-expectativa-ranking-modal__filter-select"
                  value={filtroExpectativa}
                  onChange={(e) =>
                    setFiltroExpectativa(e.target.value as FiltroExpectativa)
                  }
                  aria-label="Filtrar por meta"
                >
                  {FILTRO_EXPECTATIVA_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown
                  className="wr-expectativa-ranking-modal__filter-select-icon"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </label>

            <label className="wr-expectativa-ranking-modal__filter-field">
              <span className="wr-expectativa-ranking-modal__filter-field-label">Pesquisas</span>
              <span className="wr-expectativa-ranking-modal__filter-select-wrap">
                <select
                  className="wr-expectativa-ranking-modal__filter-select"
                  value={filtroPesquisas}
                  onChange={(e) => setFiltroPesquisas(e.target.value as FiltroBinario)}
                  aria-label="Filtrar por pesquisas"
                >
                  {FILTRO_PESQUISAS_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown
                  className="wr-expectativa-ranking-modal__filter-select-icon"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </label>

            <label className="wr-expectativa-ranking-modal__filter-field">
              <span className="wr-expectativa-ranking-modal__filter-field-label">Emendas</span>
              <span className="wr-expectativa-ranking-modal__filter-select-wrap">
                <select
                  className="wr-expectativa-ranking-modal__filter-select"
                  value={filtroEmendas}
                  onChange={(e) => setFiltroEmendas(e.target.value as FiltroBinario)}
                  aria-label="Filtrar por emendas"
                >
                  {FILTRO_EMENDAS_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown
                  className="wr-expectativa-ranking-modal__filter-select-icon"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </label>

            <label className="wr-expectativa-ranking-modal__filter-field">
              <span className="wr-expectativa-ranking-modal__filter-field-label">Obras</span>
              <span className="wr-expectativa-ranking-modal__filter-select-wrap">
                <select
                  className="wr-expectativa-ranking-modal__filter-select"
                  value={filtroObras}
                  onChange={(e) => setFiltroObras(e.target.value as FiltroBinario)}
                  aria-label="Filtrar por obras"
                >
                  {FILTRO_OBRAS_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown
                  className="wr-expectativa-ranking-modal__filter-select-icon"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </label>

            <label className="wr-expectativa-ranking-modal__filter-field">
              <span className="wr-expectativa-ranking-modal__filter-field-label">Visitas</span>
              <span className="wr-expectativa-ranking-modal__filter-select-wrap">
                <select
                  className="wr-expectativa-ranking-modal__filter-select"
                  value={filtroVisitas}
                  onChange={(e) => setFiltroVisitas(e.target.value as FiltroVisitas)}
                  aria-label="Filtrar por visitas"
                >
                  {FILTRO_VISITAS_OPCOES.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
                <ChevronsUpDown
                  className="wr-expectativa-ranking-modal__filter-select-icon"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </span>
            </label>
          </div>

          <div className="wr-expectativa-ranking-modal__toolbar-end">
            <span className="wr-expectativa-ranking-modal__count tabular-nums">
              {loadingEmendas ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                  Emendas…
                </span>
              ) : (
                `${filtradas.length.toLocaleString('pt-BR')} município${filtradas.length === 1 ? '' : 's'}`
              )}
            </span>
            <div className="wr-expectativa-ranking-modal__export" role="group" aria-label="Exportar">
              <span className="wr-expectativa-ranking-modal__export-label">
                <Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Exportar
              </span>
              <button
                type="button"
                className="wr-expectativa-ranking-modal__export-btn"
                disabled={filtradas.length === 0 || exportBusy !== 'idle'}
                onClick={() => exportar('csv')}
              >
                {exportBusy === 'csv' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.5} />
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Sheet className="h-3.5 w-3.5" strokeWidth={1.5} />
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                ) : (
                  <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                PDF
              </button>
            </div>
          </div>
        </div>

        <div className="wr-expectativa-ranking-modal__table-wrap">
          <table className="wr-expectativa-ranking-modal__table">
            <thead>
              <tr className="wr-expectativa-ranking-modal__group-row">
                <th
                  colSpan={4}
                  scope="colgroup"
                  className="wr-expectativa-ranking-modal__group-th wr-expectativa-ranking-modal__group-th--meta"
                >
                  Meta de Votos
                </th>
                <th
                  colSpan={3}
                  scope="colgroup"
                  className="wr-expectativa-ranking-modal__group-th wr-expectativa-ranking-modal__group-th--pesquisas"
                >
                  Pesquisas de Opinião
                </th>
                <th
                  colSpan={2}
                  scope="colgroup"
                  className="wr-expectativa-ranking-modal__group-th wr-expectativa-ranking-modal__group-th--mandato"
                >
                  Mandato
                </th>
                <th
                  colSpan={3}
                  scope="colgroup"
                  className="wr-expectativa-ranking-modal__group-th wr-expectativa-ranking-modal__group-th--cobertura"
                >
                  Cobertura Território
                </th>
              </tr>
              <tr className="wr-expectativa-ranking-modal__cols-row">
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
                    label="Meta"
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
                <th className="wr-expectativa-ranking-modal__col-pesquisa wr-expectativa-ranking-modal__group-edge">
                  <TerritorioSortableHeaderButton
                    label="Pesquisas"
                    active={sortCol === 'pesquisa'}
                    asc={sortAsc}
                    onClick={() => alternarSort('pesquisa')}
                    align="left"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Proj. pesquisa"
                    active={sortCol === 'projPesquisa'}
                    asc={sortAsc}
                    onClick={() => alternarSort('projPesquisa')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__num">
                  <TerritorioSortableHeaderButton
                    label="Meta × Pesquisas"
                    active={sortCol === 'metaProj'}
                    asc={sortAsc}
                    onClick={() => alternarSort('metaProj')}
                    align="right"
                    compact
                  />
                </th>
                <th className="wr-expectativa-ranking-modal__center wr-expectativa-ranking-modal__group-edge">
                  Emendas
                </th>
                <th className="wr-expectativa-ranking-modal__center">Obras</th>
                <th className="wr-expectativa-ranking-modal__num wr-expectativa-ranking-modal__group-edge">
                  <TerritorioSortableHeaderButton
                    label="Últ.visita"
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
                <th
                  className="wr-expectativa-ranking-modal__center wr-expectativa-ranking-modal__col-comunicar"
                  title="Comunicar líderes"
                >
                  Comunicar
                </th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((row, rowIndex) => (
                <tr
                  key={row.municipio}
                  className="wr-expectativa-ranking-modal__data-row"
                  style={
                    {
                      ['--wr-row-stagger' as string]: `${Math.min(rowIndex, 28) * 40}ms`,
                    } as CSSProperties
                  }
                >
                  <td className="wr-expectativa-ranking-modal__cidade">
                    <span className="wr-expectativa-ranking-modal__cidade-inner">
                      <span className="wr-expectativa-ranking-modal__cidade-nome">
                        {row.municipio}
                      </span>
                      {row.temAgendaProxima ? (
                        <span className="wr-expectativa-ranking-modal__cidade-alertas">
                          <button
                            type="button"
                            className="wr-expectativa-clean__agenda-alerta wr-expectativa-ranking-modal__agenda-alerta"
                            title={`Agenda nos próximos ${AGENDA_PROXIMOS_JANELA_DIAS} dias`}
                            aria-label={`Ver agenda dos próximos ${AGENDA_PROXIMOS_JANELA_DIAS} dias em ${row.municipio}`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setAgendaModalMunicipio(row.municipio)
                            }}
                          >
                            <Calendar
                              className="h-3.5 w-3.5"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          </button>
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    <EnterInt value={row.expectativa} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__peso-cell">
                    <PesoProgressBar
                      peso={row.peso}
                      maxPeso={maxPesoFiltrado}
                      resetKey={enterAnimKey}
                    />
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      row.populacao != null
                        ? `População: ${formatInt(row.populacao)}`
                        : undefined
                    }
                  >
                    <EnterInt value={row.eleitores} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__col-pesquisa wr-expectativa-ranking-modal__group-edge">
                    {row.pesquisa ? (
                      <button
                        type="button"
                        className={cn(
                          'wr-expectativa-ranking-modal__flag--btn',
                          'wr-expectativa-ranking-modal__pesquisa-split',
                        )}
                        aria-label={`Ver ranking da pesquisa em ${row.municipio}`}
                        title={
                          row.pesquisa
                            ? [
                                row.pesquisaNaoPontuou
                                  ? 'NP · não pontuou · 0%'
                                  : `${formatPosicaoPesquisa(row.pesquisaPosicao)} · ${formatPctPesquisa(row.pesquisaPctUltima)}`,
                                row.pesquisaPctAnterior != null
                                  ? `Anterior: ${formatPctPesquisa(row.pesquisaPctAnterior)}`
                                  : null,
                                `${row.pesquisa.instituto} · ${row.pesquisa.dataLabel} · ${row.pesquisa.cenario}`,
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
                        <span
                          className={cn(
                            'wr-expectativa-ranking-modal__flag',
                            'wr-expectativa-ranking-modal__pesquisa-pos',
                            (row.pesquisaNaoPontuou ||
                              (row.pesquisaPosicao != null &&
                                row.pesquisaPosicao > 5)) &&
                              'wr-expectativa-ranking-modal__flag--alerta',
                          )}
                        >
                          <PesquisaPosicaoMark
                            posicao={row.pesquisaPosicao}
                            naoPontuou={row.pesquisaNaoPontuou}
                          />
                        </span>
                        <span
                          className={cn(
                            'wr-expectativa-ranking-modal__flag',
                            'wr-expectativa-ranking-modal__pesquisa-pct-chip',
                            (row.pesquisaNaoPontuou ||
                              (row.pesquisaPosicao != null &&
                                row.pesquisaPosicao > 5)) &&
                              'wr-expectativa-ranking-modal__flag--alerta',
                          )}
                        >
                          <span className="wr-expectativa-ranking-modal__pesquisa-pct-group">
                            {row.pesquisaTendencia === 'alta' ? (
                              <TrendingUp
                                className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--alta"
                                strokeWidth={1.5}
                                aria-label="Crescimento"
                              />
                            ) : null}
                            {row.pesquisaTendencia === 'baixa' ? (
                              <TrendingDown
                                className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--baixa"
                                strokeWidth={1.5}
                                aria-label="Queda"
                              />
                            ) : null}
                            {row.pesquisaTendencia === 'estavel' ? (
                              <Minus
                                className="wr-expectativa-ranking-modal__trend wr-expectativa-ranking-modal__trend--estavel"
                                strokeWidth={1.5}
                                aria-label="Estabilidade"
                              />
                            ) : null}
                            <span className="wr-expectativa-ranking-modal__pesquisa-pct">
                              {row.pesquisaPctUltima != null ? (
                                <EnterPct value={row.pesquisaPctUltima} resetKey={enterAnimKey} />
                              ) : (
                                formatPctPesquisa(row.pesquisaPctUltima)
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                    ) : (
                      <span className="wr-expectativa-ranking-modal__pesquisa-empty">
                        {loadingPesquisas ? '…' : '—'}
                      </span>
                    )}
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      row.pesquisa && row.projPesquisaVotos != null
                        ? [
                            row.pesquisaNaoPontuou
                              ? 'NP · não pontuou · 0%'
                              : formatPctPesquisa(row.pesquisaPctUltima),
                            row.votosFederal2022 != null
                              ? `× ${formatInt(row.votosFederal2022)} votos DF 2022`
                              : null,
                            'válidos',
                            row.pesquisa.cenario,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : row.pesquisa
                          ? 'Sem total DF 2022 para projetar'
                          : undefined
                    }
                  >
                    {(row.pesquisa != null &&
                      loadingFederal2022 &&
                      row.projPesquisaVotos == null) ||
                    (loadingPesquisas && row.pesquisa == null)
                      ? '…'
                      : (
                        <EnterInt value={row.projPesquisaVotos} resetKey={enterAnimKey} />
                      )}
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {row.metaVsProjDiff != null ? (
                      <MetaVsProjValue
                        diff={row.metaVsProjDiff}
                        meta={row.expectativa}
                        projVotos={row.projPesquisaVotos}
                        resetKey={enterAnimKey}
                      />
                    ) : (
                      <span className="wr-expectativa-ranking-modal__flag wr-expectativa-ranking-modal__flag--nao">
                        {(loadingPesquisas || loadingFederal2022) &&
                        row.pesquisa == null
                          ? '…'
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="wr-expectativa-ranking-modal__center wr-expectativa-ranking-modal__group-edge">
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
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums wr-expectativa-ranking-modal__group-edge"
                    title={
                      [
                        row.visitaAlertaNivel
                          ? tituloVisitaAlerta(row.visitaAlertaNivel)
                          : null,
                        row.ultimaVisitaLabel !== '—'
                          ? `Última visita: ${row.ultimaVisitaLabel}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                  >
                    <span className="wr-expectativa-ranking-modal__visitas-cell">
                      {row.precisaVisita && row.visitaAlertaNivel ? (
                        <span
                          className={cn(
                            'wr-expectativa-ranking-modal__visita-alerta',
                            row.visitaAlertaNivel === 'prioridade' &&
                              'wr-expectativa-ranking-modal__visita-alerta--prioridade',
                          )}
                          aria-label={`Precisa visitar ${row.municipio}: ${tituloVisitaAlerta(row.visitaAlertaNivel)}`}
                        >
                          <AlertTriangle
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                            aria-hidden
                          />
                        </span>
                      ) : null}
                      <span>{row.diasDesdeLabel}</span>
                    </span>
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {row.proxVisitaLabel}
                  </td>
                  <td className="wr-expectativa-ranking-modal__center wr-expectativa-ranking-modal__col-comunicar">
                    {row.temAgendaProxima ? (
                      <button
                        type="button"
                        className="wr-expectativa-ranking-modal__comunicar-btn"
                        title={`Comunicar líderes · ${row.municipio}`}
                        aria-label={`Comunicar líderes em ${row.municipio}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setComunicarVisita({
                            municipio: row.municipio,
                            dataLabel: row.proxVisitaDataLabel,
                            horario: row.proxVisitaHorario,
                          })
                        }}
                      >
                        <Send className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                      </button>
                    ) : (
                      <span className="wr-expectativa-ranking-modal__flag wr-expectativa-ranking-modal__flag--nao">
                        —
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
                    <EnterInt value={totais.expectativa} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__col-peso tabular-nums">
                    <span className="wr-expectativa-ranking-modal__enter-num">
                      {formatPesoPct(totais.peso)}
                    </span>
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums"
                    title={
                      totais.populacao
                        ? `População: ${formatInt(totais.populacao)}`
                        : undefined
                    }
                  >
                    <EnterInt value={totais.eleitores} resetKey={enterAnimKey} />
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__center tabular-nums wr-expectativa-ranking-modal__group-edge"
                    title="Com pesquisa"
                  >
                    <EnterInt value={totais.comPesquisa} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    <EnterWarRoomNumber value={totais.projPesquisa} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums">
                    {totais.metaVsProjDiff != null ? (
                      <MetaVsProjValue
                        diff={totais.metaVsProjDiff}
                        meta={totais.expectativa}
                        projVotos={totais.projPesquisa}
                        resetKey={enterAnimKey}
                      />
                    ) : (
                      <span className="wr-expectativa-ranking-modal__flag wr-expectativa-ranking-modal__flag--nao">
                        —
                      </span>
                    )}
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__center tabular-nums wr-expectativa-ranking-modal__group-edge"
                    title="Com emendas"
                  >
                    <EnterInt value={totais.comEmendas} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__center tabular-nums" title="Com obras">
                    <EnterInt value={totais.comObras} resetKey={enterAnimKey} />
                  </td>
                  <td
                    className="wr-expectativa-ranking-modal__num tabular-nums wr-expectativa-ranking-modal__group-edge"
                    title="Com visita registrada"
                  >
                    <EnterInt value={totais.comUltimaVisita} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__num tabular-nums" title="Com próxima visita">
                    <EnterInt value={totais.comProxVisita} resetKey={enterAnimKey} />
                  </td>
                  <td className="wr-expectativa-ranking-modal__center wr-expectativa-ranking-modal__col-comunicar">
                    —
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
          loading={loadingObras && obrasAll == null}
          refreshing={refreshingObras}
          onRefresh={() => void carregarObras({ force: true })}
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

      {comunicarVisita ? (
        <WarRoomComunicarLideresModal
          visita={comunicarVisita}
          onClose={() => setComunicarVisita(null)}
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
