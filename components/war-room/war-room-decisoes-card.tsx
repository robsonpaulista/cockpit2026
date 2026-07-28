'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconAlertTriangleFilled,
  IconChevronRight,
  IconFileText,
  IconFlag,
  IconInfoCircle,
  IconLoader2,
  IconMessageCircle,
  type Icon,
} from '@tabler/icons-react'
import {
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import {
  WarRoomMiniPager,
  warRoomPageCount,
} from '@/components/war-room/war-room-mini-pager'
import { WarRoomDecisoesModal } from '@/components/war-room/war-room-decisoes-modal'
import type {
  WarRoomDecisao,
  WarRoomDecisaoIcone,
  WarRoomDecisaoPrioridade,
} from '@/lib/war-room/decisoes'
import {
  AGENDA_FLUXO_CHANGED_EVENT,
  WR_OPEN_AGENDA_FLUXO_EVENT,
} from '@/lib/war-room/agenda-fluxo'
import { buildDecisoesVisitasFluxoIncompleto } from '@/lib/war-room/decisoes-visitas-fluxo'
import { buildDecisoesPesquisasForaTop5 } from '@/lib/war-room/decisoes-pesquisas'
import { buildDecisaoNoticiasLiderPeriodo } from '@/lib/war-room/decisoes-noticias'
import { buildDecisaoPostEngajamentoDestaque } from '@/lib/war-room/decisoes-redes-engajamento'
import { buildWarRoomPesquisasConsolidadas } from '@/lib/war-room/pesquisas-consolidadas'
import { WAR_ROOM_DISPAROS } from '@/lib/war-room/mock-data'
import {
  fetchInstagramData,
  loadInstagramConfig,
  loadInstagramConfigAsync,
} from '@/lib/instagramApi'
import { useIpt } from '@/hooks/use-ipt'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import { filtrarMunicipiosVisaoUniverso } from '@/lib/ipt-missoes'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { buildPanoramaHeatmapActorColumns } from '@/lib/monitoramento-panorama'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 4
const NOTICIAS_LOOKBACK_DAYS = 7
const NOTICIAS_FETCH_LIMIT = 500
const HIDDEN_NOTICIAS_SLUGS = new Set(['instagram-causa-animal'])

const PRIORIDADE_LABEL: Record<WarRoomDecisaoPrioridade, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  info: 'Info',
}

const PRIORIDADE_RANK: Record<WarRoomDecisaoPrioridade, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
  info: 4,
}

const ICON_BY_TIPO: Record<WarRoomDecisaoIcone, Icon> = {
  alerta: IconAlertTriangleFilled,
  mensagem: IconMessageCircle,
  bandeira: IconFlag,
  documento: IconFileText,
  info: IconInfoCircle,
}

type ApiPayload = {
  error?: string
  decisoes?: WarRoomDecisao[]
  total?: number
  pendingMigration?: boolean
  message?: string
}

function sortFila(a: WarRoomDecisao, b: WarRoomDecisao): number {
  const aVisita = a.categoria === 'Visita agendada' ? 0 : 1
  const bVisita = b.categoria === 'Visita agendada' ? 0 : 1
  if (aVisita !== bVisita) return aVisita - bVisita
  const rank =
    (PRIORIDADE_RANK[a.prioridade] ?? 99) - (PRIORIDADE_RANK[b.prioridade] ?? 99)
  if (rank !== 0) return rank
  if (Boolean(a.destaque) !== Boolean(b.destaque)) return a.destaque ? -1 : 1
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
}

function DecisaoItem({
  decisao,
  onActivate,
}: {
  decisao: WarRoomDecisao
  onActivate?: (decisao: WarRoomDecisao) => void
}) {
  const ItemIcon = ICON_BY_TIPO[decisao.icone]
  const content = (
    <>
      <span
        className={cn(
          'wr-decisoes-fila__icon',
          decisao.destaque && 'wr-decisoes-fila__icon--alerta',
        )}
        aria-hidden
      >
        <ItemIcon className="h-[18px] w-[18px]" stroke={1.6} />
      </span>

      <div className="wr-decisoes-fila__body min-w-0 flex-1">
        <p className="wr-decisoes-fila__title">{decisao.problema}</p>
        <p className="wr-decisoes-fila__meta">
          Prioridade: {PRIORIDADE_LABEL[decisao.prioridade]}
          <span aria-hidden> • </span>
          {decisao.acao || decisao.categoria}
        </p>
      </div>

      <time
        className="wr-decisoes-fila__hora shrink-0 tabular-nums"
        dateTime={decisao.createdAt ?? decisao.hora}
      >
        {decisao.hora}
      </time>
    </>
  )

  const itemClass = cn(
    'wr-decisoes-fila__item',
    decisao.destaque && 'wr-decisoes-fila__item--destaque',
  )

  if (onActivate) {
    return (
      <li>
        <button type="button" className={itemClass} onClick={() => onActivate(decisao)}>
          {content}
        </button>
      </li>
    )
  }

  if (decisao.href) {
    return (
      <li>
        <Link href={decisao.href} className={itemClass}>
          {content}
        </Link>
      </li>
    )
  }

  return <li className={itemClass}>{content}</li>
}

type Props = {
  className?: string
  onTotalChange?: (total: number) => void
}

/** Fila de decisões / alertas — visitas com fluxo incompleto + Supabase. */
export function WarRoomDecisoesCard({ className, onTotalChange }: Props) {
  const { register } = useWarRoomRefresh()
  const { municipios } = useIpt()
  const [apiItems, setApiItems] = useState<WarRoomDecisao[]>([])
  const [apiTotal, setApiTotal] = useState(0)
  const [visitaItems, setVisitaItems] = useState<WarRoomDecisao[]>([])
  const [pesquisaItems, setPesquisaItems] = useState<WarRoomDecisao[]>([])
  const [noticiaItems, setNoticiaItems] = useState<WarRoomDecisao[]>([])
  const [redesItems, setRedesItems] = useState<WarRoomDecisao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  /** Mesmo universo do card Expectativa de votos (onde o ícone de agenda aparece). */
  const municipiosExpectativa = useMemo(() => {
    const filtrados = filtrarMunicipiosVisaoUniverso(
      municipios,
      'expectativa',
      'com_expectativa',
    )
    return new Map(
      filtrados.map((m) => [normalizeIptMunicipio(m.municipio), m.municipio] as const),
    )
  }, [municipios])

  const carregarVisitasFluxo = useCallback(async () => {
    if (municipiosExpectativa.size === 0) {
      setVisitaItems([])
      return
    }
    try {
      const res = await fetch('/api/agenda/events', { cache: 'no-store' })
      if (!res.ok) {
        setVisitaItems([])
        return
      }
      const data = (await res.json()) as { events?: CalendarEventRow[] }
      setVisitaItems(
        buildDecisoesVisitasFluxoIncompleto(data.events ?? [], WAR_ROOM_DISPAROS, {
          municipiosExpectativa,
        }),
      )
    } catch {
      setVisitaItems([])
    }
  }, [municipiosExpectativa])

  const carregarApi = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch(
        `/api/war-room/decisoes?limit=50&status=pendente,em_andamento`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as ApiPayload
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar decisões')
      }
      if (json.pendingMigration) {
        setApiItems([])
        setApiTotal(0)
        if (!silent) {
          setError(json.message || 'Tabela war_room_decisoes ainda não criada.')
        }
        return
      }
      setApiItems(json.decisoes ?? [])
      setApiTotal(json.total ?? json.decisoes?.length ?? 0)
      setError(null)
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Erro na busca')
        setApiItems([])
        setApiTotal(0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const carregarPesquisasForaTop5 = useCallback(async () => {
    try {
      const res = await fetch('/api/pesquisa?limit=5000', { cache: 'no-store' })
      if (!res.ok) {
        setPesquisaItems([])
        return
      }
      const data = (await res.json()) as PollIptRow[]
      const foco = resolveCandidatoIpt()
      const built = buildWarRoomPesquisasConsolidadas(
        Array.isArray(data) ? data : [],
        foco,
        5000,
      )
      const label = foco.trim().split(/\s+/)[0] || 'Jadyel'
      setPesquisaItems(buildDecisoesPesquisasForaTop5(built, { candidatoLabel: label }))
    } catch {
      setPesquisaItems([])
    }
  }, [])

  const carregarNoticiasLider = useCallback(async () => {
    try {
      const [actorsRes, mentionsRes] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(
          `/api/google-news/mentions?politico=all&days=${NOTICIAS_LOOKBACK_DAYS}&limit=${NOTICIAS_FETCH_LIMIT}&channel=news`,
          { cache: 'no-store' },
        ),
      ])
      if (!actorsRes.ok || !mentionsRes.ok) {
        setNoticiaItems([])
        return
      }
      const actorsJson = (await actorsRes.json()) as {
        actors?: PoliticalActorWithTerms[]
      }
      const mentionsJson = (await mentionsRes.json()) as {
        mentions?: GoogleNewsMentionWithActor[]
      }
      const columns = buildPanoramaHeatmapActorColumns(
        (actorsJson.actors ?? []).filter((a) => !HIDDEN_NOTICIAS_SLUGS.has(a.slug)),
      )
      const lider = buildDecisaoNoticiasLiderPeriodo(
        columns,
        mentionsJson.mentions ?? [],
        { windowDays: NOTICIAS_LOOKBACK_DAYS },
      )
      setNoticiaItems(lider ? [lider] : [])
    } catch {
      setNoticiaItems([])
    }
  }, [])

  const carregarRedesEngajamento = useCallback(async () => {
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.token || !cfg.businessAccountId) {
        cfg = await loadInstagramConfigAsync()
      }
      if (!cfg.token || !cfg.businessAccountId) {
        setRedesItems([])
        return
      }
      const data = await fetchInstagramData(
        cfg.token,
        cfg.businessAccountId,
        '7d',
        false,
      )
      const destaque = buildDecisaoPostEngajamentoDestaque(data?.posts ?? [])
      setRedesItems(destaque ? [destaque] : [])
    } catch {
      setRedesItems([])
    }
  }, [])

  const carregar = useCallback(
    async (opts?: { silent?: boolean }) => {
      await Promise.all([
        carregarApi(opts),
        carregarVisitasFluxo(),
        carregarPesquisasForaTop5(),
        carregarNoticiasLider(),
        carregarRedesEngajamento(),
      ])
    },
    [
      carregarApi,
      carregarVisitasFluxo,
      carregarPesquisasForaTop5,
      carregarNoticiasLider,
      carregarRedesEngajamento,
    ],
  )

  useEffect(() => {
    void carregar({ silent: false })
  }, [carregar])

  useEffect(() => {
    return register('decisoes', async ({ silent }) => {
      await carregar({ silent })
    })
  }, [register, carregar])

  useEffect(() => {
    const onFluxoChanged = () => {
      void carregarVisitasFluxo()
    }
    window.addEventListener(AGENDA_FLUXO_CHANGED_EVENT, onFluxoChanged)
    return () => {
      window.removeEventListener(AGENDA_FLUXO_CHANGED_EVENT, onFluxoChanged)
    }
  }, [carregarVisitasFluxo])

  const fila = useMemo(
    () =>
      [
        ...visitaItems,
        ...pesquisaItems,
        ...noticiaItems,
        ...redesItems,
        ...apiItems,
      ].sort(sortFila),
    [visitaItems, pesquisaItems, noticiaItems, redesItems, apiItems],
  )

  useEffect(() => {
    const pages = warRoomPageCount(fila.length, PAGE_SIZE)
    if (page > pages - 1) setPage(Math.max(0, pages - 1))
  }, [fila.length, page])

  const items = useMemo(() => {
    const start = page * PAGE_SIZE
    return fila.slice(start, start + PAGE_SIZE)
  }, [fila, page])

  const total =
    visitaItems.length +
    pesquisaItems.length +
    noticiaItems.length +
    redesItems.length +
    apiTotal

  useEffect(() => {
    onTotalChange?.(total)
  }, [total, onTotalChange])

  const snapshotLines = useMemo(
    () =>
      fila.map(
        (d) =>
          `dec\t${d.id}\t${d.prioridade}\t${d.problema}\t${d.status ?? ''}`,
      ),
    [fila],
  )

  useWarRoomSnapshot({
    cardId: 'decisoes',
    lines: loading && fila.length === 0 ? null : snapshotLines,
    noun: 'decisão',
    ready: !loading || fila.length > 0 || error != null,
  })

  const onActivate = useCallback((decisao: WarRoomDecisao) => {
    if (decisao.categoria === 'Visita agendada' && decisao.contexto) {
      setModalOpen(false)
      window.dispatchEvent(
        new CustomEvent(WR_OPEN_AGENDA_FLUXO_EVENT, {
          detail: { municipioKey: decisao.contexto },
        }),
      )
      return
    }
    if (decisao.href) {
      setModalOpen(false)
      window.location.assign(decisao.href)
    }
  }, [])

  return (
    <section
      id="wr-decisoes"
      className={cn('wr-decisoes-fila', 'wr-cell--decisoes', className)}
      aria-label="Fila de decisões e alertas"
    >
      <header className="wr-decisoes-fila__header">
        <h2 className="wr-decisoes-fila__heading">Fila de decisões / alertas</h2>
        <p className="wr-decisoes-fila__sub">
          Visitas, pesquisas, notícias e redes
        </p>
      </header>

      {loading && fila.length === 0 ? (
        <div className="wr-decisoes-fila__empty flex items-center justify-center gap-2">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando…
        </div>
      ) : error && fila.length === 0 ? (
        <p className="wr-decisoes-fila__empty text-[var(--wr-critical)]">{error}</p>
      ) : fila.length === 0 ? (
        <p className="wr-decisoes-fila__empty">Nenhuma decisão pendente no momento.</p>
      ) : (
        <ul className="wr-decisoes-fila__list">
          {items.map((decisao) => (
            <DecisaoItem
              key={decisao.id}
              decisao={decisao}
              onActivate={
                decisao.categoria === 'Visita agendada' || decisao.href
                  ? onActivate
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      <div className="wr-decisoes-fila__footer-bar">
        <WarRoomMiniPager
          page={page}
          total={fila.length}
          pageSize={PAGE_SIZE}
          onChange={setPage}
          className="wr-decisoes-fila__pager"
        />
        <button
          type="button"
          className="wr-decisoes-fila__footer"
          onClick={() => setModalOpen(true)}
          disabled={fila.length === 0 && !loading}
        >
          <span>Ver todas ({total})</span>
          <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
        </button>
      </div>

      {modalOpen ? (
        <WarRoomDecisoesModal
          items={fila}
          onClose={() => setModalOpen(false)}
          onActivate={onActivate}
        />
      ) : null}
    </section>
  )
}
