'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
  municipioCobertoCampo,
  ordenarMunicipiosMissao,
} from '@/lib/ipt-missoes'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import {
  formatAgendaTimePt,
  getCalendarEventDate,
  type CalendarEventRow,
} from '@/lib/agenda/calendar-event-utils'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { WarRoomUltimaVisitaModal } from '@/components/war-room/war-room-ultima-visita-modal'
import {
  WarRoomAgendaProximosModal,
  type WarRoomAgendaProximoItem,
} from '@/components/war-room/war-room-agenda-proximos-modal'
import { cn } from '@/lib/utils'

type MetaFiltro = 'todos' | 'com' | 'sem'

/** Ranking compacto — cabem mais linhas sem o subtítulo de diagnóstico. */
const TOP_N = 10
const AGENDA_JANELA_DIAS = 7
const WAR_ROOM_TZ = 'America/Sao_Paulo'

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

function calendarDateInTz(iso: string | Date, timeZone: string = WAR_ROOM_TZ): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function todayKeyInTz(timeZone: string = WAR_ROOM_TZ): string {
  return calendarDateInTz(new Date(), timeZone)
}

function addDaysToKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  if (!y || !m || !d) return dayKey
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function formatDataLabelBr(dayKey: string): string {
  const [y, m, d] = dayKey.split('-')
  if (!y || !m || !d) return dayKey
  return `${d}/${m}`
}

function normalizeAgendaHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const trimmed = String(hora).trim()
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5)
  return trimmed
}

/** Extrai município da location (ex.: "Luís Correia, PI, Brasil"). */
function municipioKeyFromAgendaEvent(event: CalendarEventRow): string | null {
  const loc = event.location?.trim()
  if (loc) {
    const first = loc.split(',')[0]?.trim()
    if (first && first !== '—') return normalizeIptMunicipio(first)
  }
  return null
}

function buildAgendaProximosPorMunicipio(
  events: CalendarEventRow[],
): Map<string, WarRoomAgendaProximoItem[]> {
  const today = todayKeyInTz()
  const endKey = addDaysToKey(today, AGENDA_JANELA_DIAS - 1)
  const byCity = new Map<string, WarRoomAgendaProximoItem[]>()

  for (const event of events) {
    if (event.status === 'cancelled') continue
    const date = getCalendarEventDate(event)
    if (!date) continue
    const dayKey = calendarDateInTz(date)
    if (!dayKey || dayKey < today || dayKey > endKey) continue

    const cityKey = municipioKeyFromAgendaEvent(event)
    if (!cityKey) continue

    const { title } = parseEventOriginFromSummary(event.summary || '')
    const item: WarRoomAgendaProximoItem = {
      id: event.id || `${cityKey}-${dayKey}-${title}`,
      titulo: title || 'Sem título',
      dataKey: dayKey,
      dataLabel: formatDataLabelBr(dayKey),
      horario: normalizeAgendaHora(formatAgendaTimePt(event)),
      local: event.location?.trim() || '—',
    }

    const list = byCity.get(cityKey) ?? []
    list.push(item)
    byCity.set(cityKey, list)
  }

  for (const [key, list] of byCity) {
    list.sort((a, b) => {
      const byDate = a.dataKey.localeCompare(b.dataKey)
      if (byDate !== 0) return byDate
      return a.horario.localeCompare(b.horario, 'pt-BR')
    })
    byCity.set(key, list)
  }

  return byCity
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
  const semVisita15d = !municipioCobertoCampo(municipio)

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

          {semVisita15d ? (
            <button
              type="button"
              className="wr-expectativa-clean__visita-alerta"
              title="Ver última visita"
              aria-label={`Ver última visita em ${municipio.municipio}`}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                onOpenVisita()
              }}
            >
              <IconPlane className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
            </button>
          ) : null}

          {!temAgendaProxima && !semVisita15d ? (
            <span className="wr-expectativa-clean__visita-slot" aria-hidden />
          ) : null}
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
  const [metaFiltro, setMetaFiltro] = useState<MetaFiltro>('todos')
  const [visitaModalMunicipio, setVisitaModalMunicipio] = useState<string | null>(null)
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(null)
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

  const top5 = useMemo(() => universo.slice(0, TOP_N), [universo])

  const snapshotLines = useMemo(
    () =>
      universo.map(
        (m, index) =>
          `${m.municipio}\t${index + 1}\t${m.expectativaVotos}`,
      ),
    [universo],
  )

  useWarRoomSnapshot({
    cardId: 'expectativa',
    lines: loading && universo.length === 0 ? null : snapshotLines,
    noun: 'município',
    ready: !loading || universo.length > 0,
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
            <p className="wr-decisoes-fila__sub">Top municípios do recorte</p>
          </div>
          {change ? <WarRoomChangeBadge change={change} /> : null}
        </div>
        <div className="wr-expectativa-clean__filtros" role="group" aria-label="Filtrar por expectativa">
          {META_FILTRO_OPCOES.map((opcao) => (
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
          ))}
        </div>
      </header>

      {loading && universo.length === 0 ? (
        <div className="wr-decisoes-fila__empty flex items-center justify-center">
          <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
        </div>
      ) : error ? (
        <p className="wr-decisoes-fila__empty text-[var(--wr-critical)]">{error}</p>
      ) : top5.length === 0 ? (
        <p className="wr-decisoes-fila__empty">Nenhum município no recorte atual.</p>
      ) : (
        <ul className="wr-decisoes-fila__list" aria-label="Ranking de municípios por expectativa">
          {top5.map((m, index) => {
            const cityKey = normalizeIptMunicipio(m.municipio)
            const temAgendaProxima = (agendaPorMunicipio.get(cityKey)?.length ?? 0) > 0
            return (
              <ExpectativaItem
                key={m.municipio}
                municipio={m}
                index={index}
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

      <Link href="/dashboard/territorio/ipt" className="wr-decisoes-fila__footer">
        <span>
          Ver ranking completo
          {universo.length > 0 ? ` (${universo.length})` : ''}
        </span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>

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
