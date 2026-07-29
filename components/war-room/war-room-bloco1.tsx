'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconCalendarEvent,
  IconChevronRight,
  IconLoader2,
  IconMapPin,
  IconPlane,
} from '@tabler/icons-react'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { useWarRoomCidade } from '@/components/war-room/war-room-cidade-context'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { useIpt } from '@/hooks/use-ipt'
import { usePermissions } from '@/hooks/use-permissions'
import {
  filtrarMunicipiosVisaoUniverso,
  ordenarMunicipiosMissao,
} from '@/lib/ipt-missoes'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { type CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import {
  buildExpectativaDesempenhoKpis,
  calcExpectativaDesempenho,
} from '@/lib/war-room/expectativa-desempenho'
import {
  precisaVisitaAltaExpectativa,
  formatUltimaVisitaCurta,
  WR_VISITA_ALERTA_DIAS,
  WR_VISITA_ALERTA_EXPECTATIVA_MIN,
} from '@/lib/war-room/expectativa-visita-alerta'
import { WarRoomUltimaVisitaModal } from '@/components/war-room/war-room-ultima-visita-modal'
import { WarRoomExpectativaRankingModal } from '@/components/war-room/war-room-expectativa-ranking-modal'
import { WarRoomExpectativaDesempenhoView } from '@/components/war-room/war-room-expectativa-desempenho-view'
import {
  WarRoomAgendaProximosModal,
} from '@/components/war-room/war-room-agenda-proximos-modal'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'
import {
  buildAgendaProximosPorMunicipio,
  todayKeyInTz,
} from '@/lib/war-room/agenda-proximos'
import { WR_OPEN_AGENDA_FLUXO_EVENT } from '@/lib/war-room/agenda-fluxo'
import {
  WarRoomMiniPager,
  warRoomPageCount,
} from '@/components/war-room/war-room-mini-pager'
import { cn } from '@/lib/utils'

type VisaoId = 'ranking' | 'desempenho'
type MetaFiltro = 'todos' | 'com' | 'sem'

/** Ranking paginado — 10 municípios por página. */
const PAGE_SIZE = 8

const VISAO_OPCOES: Array<{ id: VisaoId; label: string }> = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'desempenho', label: 'Desempenho' },
]

const META_FILTRO_OPCOES: Array<{ id: MetaFiltro; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'com', label: 'Com meta' },
  { id: 'sem', label: 'Sem meta' },
]

function formatPesoPct(pct: number): string {
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

type Props = {
  className?: string
}

function ExpectativaItem({
  municipio,
  index,
  ativo,
  podeVerExpectativa,
  temAgendaProxima,
  onSelect,
  onOpenVisita,
  onOpenAgenda,
}: {
  municipio: IptMunicipio
  index: number
  ativo: boolean
  podeVerExpectativa: boolean
  temAgendaProxima: boolean
  onSelect: () => void
  onOpenVisita: () => void
  onOpenAgenda: () => void
}) {
  const precisaVisita = precisaVisitaAltaExpectativa(municipio)
  const visitaAlertaTitle = `Sem visita há ${WR_VISITA_ALERTA_DIAS}+ dias · expectativa ≥ ${WR_VISITA_ALERTA_EXPECTATIVA_MIN.toLocaleString('pt-BR')}`
  const ultimaVisitaLabel = formatUltimaVisitaCurta(municipio.ultimaVisita)

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-current={ativo}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
        className={cn(
          'wr-decisoes-fila__item wr-expectativa-clean__item',
          ativo && 'wr-decisoes-fila__item--destaque',
        )}
      >
        <span
          className={cn(
            'wr-decisoes-fila__icon',
            ativo && 'wr-decisoes-fila__icon--alerta',
          )}
          aria-hidden
        >
          {index === 0 ? (
            <IconMapPin className="h-[18px] w-[18px]" stroke={1.6} />
          ) : (
            <span className="wr-expectativa-clean__rank">{index + 1}</span>
          )}
        </span>

        <div className="wr-decisoes-fila__body min-w-0 flex-1">
          <p className="wr-decisoes-fila__title truncate">{municipio.municipio}</p>
        </div>

        <span className="wr-expectativa-clean__alerts shrink-0">
          {temAgendaProxima ? (
            <button
              type="button"
              className="wr-expectativa-clean__agenda-alerta"
              title="Agenda nos próximos 7 dias"
              aria-label={`Ver agenda dos próximos 7 dias em ${municipio.municipio}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                onOpenAgenda()
              }}
            >
              <IconCalendarEvent className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
            </button>
          ) : null}

          {precisaVisita ? (
            <button
              type="button"
              className="wr-expectativa-clean__visita-alerta"
              title={visitaAlertaTitle}
              aria-label={`${visitaAlertaTitle} em ${municipio.municipio}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                onOpenVisita()
              }}
            >
              <IconPlane className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
            </button>
          ) : ultimaVisitaLabel ? (
            <button
              type="button"
              className="wr-expectativa-clean__visita-data"
              title={`Última visita · ${ultimaVisitaLabel}`}
              aria-label={`Última visita em ${municipio.municipio}: ${ultimaVisitaLabel}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                onOpenVisita()
              }}
            >
              <span className="tabular-nums">{ultimaVisitaLabel}</span>
            </button>
          ) : (
            <span className="wr-expectativa-clean__visita-slot" aria-hidden />
          )}
        </span>

        <span className="wr-expectativa-clean__votos shrink-0 tabular-nums">
          {podeVerExpectativa ? formatWarRoomNumber(municipio.expectativaVotos) : '•••'}
        </span>

        <span
          className="wr-expectativa-clean__peso shrink-0 tabular-nums"
          title="% do universo"
        >
          {formatPesoPct(municipio.pesoExpectativaPct)}
        </span>
      </div>
    </li>
  )
}

/** Card Expectativa de Votos — mesmo design clean da fila de decisões. */
export function WarRoomExpectativaCard({ className }: Props) {
  const { loading, error, municipios, recarregar } = useIpt()
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('expectativa')
  const { isAdmin, canAccess } = usePermissions()
  const podeVerExpectativa =
    isAdmin || canAccess('territorio') || canAccess('ipt')
  const { municipio: selecionado, setMunicipio: setSelecionado } =
    useWarRoomCidade()
  const [visao, setVisao] = useState<VisaoId>('ranking')
  const [metaFiltro, setMetaFiltro] = useState<MetaFiltro>('todos')
  const [page, setPage] = useState(0)
  const [visitaModalMunicipio, setVisitaModalMunicipio] = useState<string | null>(null)
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(null)
  const [rankingModalOpen, setRankingModalOpen] = useState(false)
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())

  const loadAgendaProximos = useCallback(async () => {
    try {
      const res = await fetch('/api/agenda/events', { cache: 'no-store' })
      if (!res.ok) {
        setAgendaPorMunicipio(new Map())
        return
      }
      const data = (await res.json()) as { events?: CalendarEventRow[] }
      setAgendaPorMunicipio(buildAgendaProximosPorMunicipio(data.events ?? []))
    } catch {
      setAgendaPorMunicipio(new Map())
    }
  }, [])

  useEffect(() => {
    void loadAgendaProximos()
  }, [loadAgendaProximos])

  useEffect(() => {
    return register('expectativa', async ({ silent }) => {
      await Promise.all([recarregar({ silent }), loadAgendaProximos()])
    })
  }, [register, recarregar, loadAgendaProximos])

  useEffect(() => {
    const onOpenAgenda = (event: Event) => {
      const detail = (event as CustomEvent<{ municipioKey?: string }>).detail
      const key = detail?.municipioKey?.trim()
      if (!key) return

      const match = municipios.find(
        (m) => normalizeIptMunicipio(m.municipio) === key,
      )
      const label = match?.municipio
      if (!label) return

      setSelecionado(label)
      setAgendaModalMunicipio(label)
      document.getElementById('wr-expectativa')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
    }

    window.addEventListener(WR_OPEN_AGENDA_FLUXO_EVENT, onOpenAgenda)
    return () => {
      window.removeEventListener(WR_OPEN_AGENDA_FLUXO_EVENT, onOpenAgenda)
    }
  }, [municipios, setSelecionado])

  const universo = useMemo(() => {
    const filtrados = filtrarMunicipiosVisaoUniverso(
      municipios,
      'expectativa',
      'com_expectativa',
    )
    const ordenados = ordenarMunicipiosMissao(
      filtrados,
      'expectativa',
      'com_expectativa',
    )
    if (metaFiltro === 'com') {
      return ordenados.filter((m) => m.expectativaVotos > 0)
    }
    if (metaFiltro === 'sem') {
      return ordenados.filter((m) => m.expectativaVotos <= 0)
    }
    return ordenados
  }, [municipios, metaFiltro])

  useEffect(() => {
    setPage(0)
  }, [metaFiltro])

  useEffect(() => {
    const pages = warRoomPageCount(universo.length, PAGE_SIZE)
    if (page > pages - 1) setPage(Math.max(0, pages - 1))
  }, [universo.length, page])

  const pagina = useMemo(() => {
    const start = page * PAGE_SIZE
    return universo.slice(start, start + PAGE_SIZE)
  }, [universo, page])

  const desempenhoKpis = useMemo(() => {
    if (!podeVerExpectativa) return []
    return buildExpectativaDesempenhoKpis(
      calcExpectativaDesempenho(municipios, {
        agendaMunicipioKeys: agendaPorMunicipio.keys(),
      }),
    )
  }, [municipios, podeVerExpectativa, agendaPorMunicipio])

  const snapshotLines = useMemo(() => {
    if (visao === 'desempenho') {
      return desempenhoKpis.map(
        (k) => `desempenho\t${k.id}\t${k.valueLabel}\t${k.detail ?? ''}`,
      )
    }
    return universo.map(
      (m, index) =>
        `${m.municipio}\t${index + 1}\t${m.expectativaVotos}`,
    )
  }, [visao, desempenhoKpis, universo])

  useWarRoomSnapshot({
    cardId: 'expectativa',
    lines: loading && universo.length === 0 && desempenhoKpis.length === 0 ? null : snapshotLines,
    noun: visao === 'desempenho' ? 'indicador' : 'município',
    ready: !loading || universo.length > 0 || desempenhoKpis.length > 0,
  })

  useEffect(() => {
    if (universo.length === 0) return
    const aindaNaLista =
      selecionado != null && universo.some((m) => m.municipio === selecionado)
    if (!aindaNaLista) {
      setSelecionado(universo[0].municipio)
    }
  }, [universo, selecionado, setSelecionado])

  const agendaModalItens = useMemo(() => {
    if (!agendaModalMunicipio) return []
    return agendaPorMunicipio.get(normalizeIptMunicipio(agendaModalMunicipio)) ?? []
  }, [agendaModalMunicipio, agendaPorMunicipio])

  return (
    <section
      id="wr-expectativa"
      className={cn('wr-decisoes-fila', 'wr-cell--expectativa', className)}
      aria-label="Expectativa de votos"
    >
      <header className="wr-decisoes-fila__header wr-expectativa-clean__header">
        <div className="wr-expectativa-clean__title-row">
          <div>
            <h2 className="wr-decisoes-fila__heading">Expectativa de votos</h2>
            <p className="wr-decisoes-fila__sub">
              {visao === 'desempenho'
                ? 'Cobertura · campo · eleitorado'
                : universo.length > 0
                  ? `${universo.length} municípios · ${PAGE_SIZE} por página`
                  : 'Top municípios do recorte'}
            </p>
          </div>
          {change ? <WarRoomChangeBadge change={change} /> : null}
        </div>
        <div
          className="wr-expectativa-clean__filtros"
          role="group"
          aria-label="Visão e filtros da expectativa"
        >
          {VISAO_OPCOES.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={visao === opcao.id}
              className={cn(
                'wr-expectativa-clean__filtro',
                visao === opcao.id && 'wr-expectativa-clean__filtro--ativo',
              )}
              onClick={() => setVisao(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
          {visao === 'ranking'
            ? META_FILTRO_OPCOES.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  aria-pressed={metaFiltro === opcao.id}
                  className={cn(
                    'wr-expectativa-clean__filtro',
                    metaFiltro === opcao.id && 'wr-expectativa-clean__filtro--ativo',
                  )}
                  onClick={() => setMetaFiltro(opcao.id)}
                >
                  {opcao.label}
                </button>
              ))
            : null}
        </div>
      </header>

      {loading && universo.length === 0 ? (
        <div className="wr-decisoes-fila__empty flex items-center justify-center">
          <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
        </div>
      ) : error ? (
        <p className="wr-decisoes-fila__empty text-[var(--wr-critical)]">{error}</p>
      ) : visao === 'desempenho' ? (
        !podeVerExpectativa ? (
          <p className="wr-decisoes-fila__empty">
            Sem permissão para ver os indicadores de expectativa.
          </p>
        ) : (
          <WarRoomExpectativaDesempenhoView kpis={desempenhoKpis} />
        )
      ) : pagina.length === 0 ? (
        <p className="wr-decisoes-fila__empty">Nenhum município no recorte atual.</p>
      ) : (
        <ul className="wr-decisoes-fila__list" aria-label="Ranking de municípios por expectativa">
          {pagina.map((m, index) => {
            const rankIndex = page * PAGE_SIZE + index
            const cityKey = normalizeIptMunicipio(m.municipio)
            const temAgendaProxima = (agendaPorMunicipio.get(cityKey)?.length ?? 0) > 0
            return (
              <ExpectativaItem
                key={m.municipio}
                municipio={m}
                index={rankIndex}
                ativo={m.municipio === selecionado}
                podeVerExpectativa={podeVerExpectativa}
                temAgendaProxima={temAgendaProxima}
                onSelect={() => setSelecionado(m.municipio)}
                onOpenVisita={() => setVisitaModalMunicipio(m.municipio)}
                onOpenAgenda={() => setAgendaModalMunicipio(m.municipio)}
              />
            )
          })}
        </ul>
      )}

      {visao === 'ranking' ? (
        <div className="wr-expectativa-clean__footer-bar">
          <WarRoomMiniPager
            page={page}
            total={universo.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
            className="wr-expectativa-clean__pager"
          />
          <button
            type="button"
            className="wr-decisoes-fila__footer wr-expectativa-clean__footer-link"
            onClick={() => setRankingModalOpen(true)}
            disabled={universo.length === 0}
          >
            <span>
              Ver ranking completo
              {universo.length > 0 ? ` (${universo.length})` : ''}
            </span>
            <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      {rankingModalOpen ? (
        <WarRoomExpectativaRankingModal
          municipios={universo}
          agendaPorMunicipio={agendaPorMunicipio}
          onClose={() => setRankingModalOpen(false)}
        />
      ) : null}

      {visitaModalMunicipio ? (
        <WarRoomUltimaVisitaModal
          municipio={visitaModalMunicipio}
          onClose={() => setVisitaModalMunicipio(null)}
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
    </section>
  )
}

/** @deprecated Prefer WarRoomExpectativaCard — mantido para imports legados. */
export function WarRoomBloco1(props: {
  universoClassName?: string
  resumoClassName?: string
  colClassName?: string
}) {
  return <WarRoomExpectativaCard className={props.colClassName ?? props.universoClassName} />
}
