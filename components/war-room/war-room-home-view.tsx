'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Loader2,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useIpt } from '@/hooks/use-ipt'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { type CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { cn } from '@/lib/utils'
import {
  AGENDA_PROXIMOS_JANELA_DIAS,
  addDaysToKey,
  buildAgendaProximosPorMunicipio,
  listAgendaVisitasProximas,
  todayKeyInTz,
  type WarRoomAgendaProximoItem,
  type WarRoomAgendaVisita,
} from '@/lib/war-room/agenda-proximos'
import { resolveAgendaLiveStatus } from '@/components/war-room/war-room-agenda-card'
import { WarRoomAgendaProximosModal } from '@/components/war-room/war-room-agenda-proximos-modal'
import { WarRoomDecisoesModal } from '@/components/war-room/war-room-decisoes-modal'
import { useWarRoomRefresh } from '@/components/war-room/war-room-refresh-context'
import {
  fetchInstagramHistory,
  loadInstagramConfigAsync,
} from '@/lib/instagramApi'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import {
  WAR_ROOM_CRM_FUNNEL_STEPS,
  WAR_ROOM_MOBILIZACAO_MOCK,
  WAR_ROOM_PESQUISAS_ANDAMENTO,
  type WarRoomAgendaItem,
} from '@/lib/war-room/mock-data'
import { buildWarRoomPesquisasConsolidadas } from '@/lib/war-room/pesquisas-consolidadas'
import type { WarRoomDecisao } from '@/lib/war-room/decisoes'
import { groupDecisoesPorSecao } from '@/lib/war-room/decisoes-secoes'
import { formatWarRoomNumber } from '@/lib/war-room/format'

type Props = {
  agendaItems: WarRoomAgendaItem[]
  agendaLoading: boolean
}

function formatArrivalAgo(iso: string, now: Date = new Date()): string {
  const arrival = new Date(iso)
  if (Number.isNaN(arrival.getTime())) return 'Chegou'
  const minutes = Math.max(0, Math.floor((now.getTime() - arrival.getTime()) / 60_000))
  if (minutes < 1) return 'Chegou agora'
  if (minutes < 60) return `Chegou há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return `Chegou há ${hours} h`
  return `Chegou há ${hours} h ${rest} min`
}

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function firstName(full: string | undefined | null): string {
  const raw = (full ?? '').trim()
  if (!raw) return 'Jadyel'
  return raw.split(/\s+/)[0] ?? 'Jadyel'
}

function formatDeltaPct(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value * 10) / 10
  const abs = Math.abs(rounded).toLocaleString('pt-BR', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${abs}%`
}

function relativeFromIso(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`).getTime()
  if (!Number.isFinite(t)) return ''
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000))
  if (mins < 1) return 'agora'
  if (mins < 60) return `há ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  return `há ${days} d`
}

function Sparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  const pts = values.length > 1 ? values : [0, ...(values[0] != null ? [values[0]] : [0])]
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const d = pts
    .map((v, i) => {
      const x = (i / Math.max(1, pts.length - 1)) * 100
      const y = 28 - ((v - min) / span) * 24
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg className={className} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function PiauiDots({
  points,
}: {
  points: Array<{ lat: number; lng: number; visited: boolean }>
}) {
  if (points.length === 0) return null
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const toXY = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng || 1)) * 92 + 4
    const y = (1 - (lat - minLat) / (maxLat - minLat || 1)) * 72 + 4
    return { x, y }
  }
  return (
    <svg className="wr-home__pi-map" viewBox="0 0 100 80" aria-hidden>
      {points.map((p, i) => {
        const { x, y } = toXY(p.lat, p.lng)
        return (
          <circle
            key={`${p.lat}-${p.lng}-${i}`}
            cx={x}
            cy={y}
            r={p.visited ? 1.35 : 0.7}
            className={p.visited ? 'wr-home__pi-dot wr-home__pi-dot--on' : 'wr-home__pi-dot'}
          />
        )
      })}
    </svg>
  )
}

function GoBtn({ href, onClick, label }: { href?: string; onClick?: () => void; label: string }) {
  const inner = (
    <>
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      <span className="sr-only">{label}</span>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="wr-home__go" aria-label={label}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className="wr-home__go" onClick={onClick} aria-label={label}>
      {inner}
    </button>
  )
}

export function WarRoomHomeView({ agendaItems, agendaLoading }: Props) {
  const { user } = useAuth()
  const { municipios, loading: iptLoading } = useIpt()
  const { register } = useWarRoomRefresh()

  const [hour, setHour] = useState(() => new Date().getHours())
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })
  const [pollsCount, setPollsCount] = useState(0)
  const [pollsLoading, setPollsLoading] = useState(true)
  const [engDelta, setEngDelta] = useState<number | null>(null)
  const [engSeries, setEngSeries] = useState<number[]>([])
  const [decisoes, setDecisoes] = useState<WarRoomDecisao[]>([])
  const [proximas, setProximas] = useState<WarRoomAgendaVisita[]>([])
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(null)
  const [decisoesOpen, setDecisoesOpen] = useState(false)

  const nome = firstName(user?.profile?.name)

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setHour(now.getHours())
      setNowMinutes(now.getHours() * 60 + now.getMinutes())
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const loadExtras = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setPollsLoading(true)
    try {
      const [pollRes, agendaRes, decRes, igCfg] = await Promise.all([
        fetch('/api/pesquisa?limit=5000', { cache: 'no-store' }),
        silent
          ? Promise.resolve(null)
          : fetch('/api/agenda/events', { cache: 'no-store' }),
        fetch('/api/war-room/decisoes', { cache: 'no-store' }),
        loadInstagramConfigAsync().catch(() => ({ configured: false })),
      ])

      if (pollRes.ok) {
        const polls = (await pollRes.json()) as PollIptRow[]
        const built = buildWarRoomPesquisasConsolidadas(
          Array.isArray(polls) ? polls : [],
          resolveCandidatoIpt(),
          400,
        )
        setPollsCount(built.length)
      }

      if (agendaRes?.ok) {
        const json = (await agendaRes.json()) as { events?: CalendarEventRow[] }
        const events = json.events ?? []
        const visitas = listAgendaVisitasProximas(events, {
          janelaDias: AGENDA_PROXIMOS_JANELA_DIAS,
        })
        setProximas(visitas.slice(0, 4))
        setAgendaPorMunicipio(buildAgendaProximosPorMunicipio(events))
      }

      if (decRes.ok) {
        const json = (await decRes.json()) as { decisoes?: WarRoomDecisao[] }
        setDecisoes(Array.isArray(json.decisoes) ? json.decisoes : [])
      }

      if (igCfg.configured) {
        const history = await fetchInstagramHistory(14)
        const rows = [...(history?.history ?? [])].sort((a, b) =>
          a.snapshot_date.localeCompare(b.snapshot_date),
        )
        const series = rows.map((r) => r.total_interactions || 0)
        setEngSeries(series)
        if (series.length >= 2) {
          const first = series[0] ?? 0
          const last = series[series.length - 1] ?? 0
          setEngDelta(first === 0 ? null : ((last - first) / Math.abs(first)) * 100)
        } else {
          setEngDelta(null)
        }
      }
    } finally {
      if (!silent) setPollsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadExtras({ silent: false })
  }, [loadExtras])

  useEffect(() => {
    return register('home', async ({ silent }) => {
      await loadExtras({ silent })
    })
  }, [register, loadExtras])

  const universo = municipios

  const expectativaTotal = useMemo(
    () => universo.reduce((s, m) => s + (Number.isFinite(m.expectativaVotos) ? m.expectativaVotos : 0), 0),
    [universo],
  )

  const cidadesVisitadas = useMemo(
    () => universo.filter((m) => Boolean(m.ultimaVisita)).length,
    [universo],
  )

  const liderancasAtivas = useMemo(
    () => universo.reduce((s, m) => s + (m.liderancas || 0), 0),
    [universo],
  )

  const expectativaSeries = useMemo(() => {
    const top = [...universo]
      .sort((a, b) => b.pesoExpectativaPct - a.pesoExpectativaPct)
      .slice(0, 8)
    return top.map((m) => m.expectativaVotos)
  }, [universo])

  const piPoints = useMemo(
    () =>
      universo
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .map((m) => ({
          lat: m.lat,
          lng: m.lng,
          visited: Boolean(m.ultimaVisita),
        })),
    [universo],
  )

  const pesquisasAtivas = WAR_ROOM_PESQUISAS_ANDAMENTO.filter((r) => r.status !== 'entregue')
    .length

  const pesquisasValor = pesquisasAtivas > 0 ? pesquisasAtivas : pollsCount
  const pesquisasLabel = pesquisasAtivas > 0 ? 'ativas' : 'ondas'

  const atendimentosHoje = WAR_ROOM_CRM_FUNNEL_STEPS[0]?.value ?? 0
  const mobilizacaoPct = WAR_ROOM_MOBILIZACAO_MOCK.pctConcluido

  const alertasAcao = useMemo(() => {
    const live = decisoes.filter(
      (d) =>
        (d.status ?? 'pendente') !== 'resolvida' &&
        (d.status ?? 'pendente') !== 'arquivada' &&
        (d.prioridade === 'critica' || d.prioridade === 'alta' || d.destaque),
    )
    return live.length
  }, [decisoes])

  const agendaLista = agendaItems
  const agendaListaLoading = agendaLoading
  const agendaPreview = agendaLista
  const agendaStatuses = useMemo(
    () => resolveAgendaLiveStatus(agendaLista, nowMinutes),
    [agendaLista, nowMinutes],
  )

  const atualizacoes = useMemo(() => {
    const items: Array<{ cidade: string; texto: string; when: string }> = []
    const recentVisitas = [...universo]
      .filter((m) => m.ultimaVisita)
      .sort((a, b) => String(b.ultimaVisita).localeCompare(String(a.ultimaVisita)))
      .slice(0, 2)
    for (const m of recentVisitas) {
      items.push({
        cidade: m.municipio,
        texto: 'Visita registrada',
        when: relativeFromIso(m.ultimaVisita),
      })
    }
    for (const p of proximas.slice(0, 2)) {
      if (items.some((i) => i.cidade === p.municipioLabel && i.texto.startsWith('Agenda'))) continue
      items.push({
        cidade: p.municipioLabel,
        texto: 'Agenda confirmada',
        when: p.dataKey === todayKeyInTz() ? 'hoje' : `em ${p.dataLabel}`,
      })
    }
    return items.slice(0, 3)
  }, [universo, proximas])

  const municipiosTotal = universo.length || 224
  const deltaLabel = formatDeltaPct(engDelta)
  const greeting = greetingForHour(hour)

  return (
    <div className="wr-home">
      <div className="wr-home__grid">
        <section className="wr-home__hero" aria-label="O Piauí em tempo real">
          <div className="wr-home__hero-copy">
            <p className="wr-home__hello">
              {greeting}, {nome}!
            </p>
            <p className="wr-home__headline">
              O PIAUÍ
              <br />
              EM <span>TEMPO REAL</span>
            </p>
            <p className="wr-home__hero-stat">
              {municipiosTotal} municípios sendo acompanhados.
            </p>
          </div>
        </section>

        <div className="wr-home__right">
          <aside className="wr-home__agenda-card">
            <header className="wr-home__agenda-head">
              <p className="wr-home__kicker">Agenda de hoje</p>
              {!agendaListaLoading && agendaPreview.length > 0 ? (
                <span className="wr-home__agenda-count tabular-nums">
                  {agendaPreview.length}
                </span>
              ) : null}
            </header>
            {agendaListaLoading ? (
              <p className="wr-home__muted wr-home__agenda-empty">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                Carregando agenda…
              </p>
            ) : agendaPreview.length === 0 ? (
              <p className="wr-home__muted wr-home__agenda-empty">Nenhum compromisso hoje.</p>
            ) : (
              <ol className="wr-home__agenda-list">
                {agendaPreview.map((item) => {
                  const parsed = parseEventOriginFromSummary(item.titulo)
                  const origin = parsed.origin?.replace(/\s*-\s*/g, ' · ')
                  const titulo = parsed.title || item.titulo
                  const status = agendaStatuses.get(item.id) ?? 'proximo'
                  const chegou = Boolean(item.arrivalTime)
                  const arrivalAgo = item.arrivalTime ? formatArrivalAgo(item.arrivalTime) : ''
                  const hint = [item.horario, item.titulo, item.municipio !== '—' ? item.municipio : null]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <li
                      key={item.id}
                      title={hint}
                      className={cn(
                        'wr-home__agenda-item',
                        status === 'ao_vivo' && 'wr-home__agenda-item--live',
                        status === 'concluido' && 'wr-home__agenda-item--done',
                        chegou && 'wr-home__agenda-item--present',
                      )}
                    >
                      <time className="wr-home__agenda-hour tabular-nums" dateTime={item.horario}>
                        {item.horario}
                      </time>
                      <span className="wr-home__agenda-rail" aria-hidden>
                        <span className="wr-home__agenda-dot" />
                      </span>
                      <div className="wr-home__agenda-body">
                        <span className="wr-home__agenda-flags">
                          {origin ? <span className="wr-home__agenda-chip">{origin}</span> : null}
                          {chegou ? (
                            <span className="wr-home__agenda-chegou">{arrivalAgo || 'Chegou'}</span>
                          ) : null}
                        </span>
                        <span className="wr-home__agenda-title">{titulo}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            <Link href="/dashboard/agenda" className="wr-home__agenda-foot">
              Ver agenda completa
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </Link>
          </aside>

          <div className="wr-home__cards">
          <div className="wr-home__kpis">
            <article className="wr-home__card wr-home__card--kpi">
              <p className="wr-home__kicker">Expectativa de votos</p>
              <p className="wr-home__metric tabular-nums">
                {iptLoading ? '—' : expectativaTotal.toLocaleString('pt-BR')}
              </p>
              <p className="wr-home__delta wr-home__delta--up">universo PI</p>
              <Sparkline values={expectativaSeries} className="wr-home__spark" />
              <GoBtn href="/dashboard/territorio/ipt" label="Abrir ranking de expectativa" />
            </article>

            <article className="wr-home__card wr-home__card--kpi">
              <p className="wr-home__kicker">Cidades visitadas</p>
              <p className="wr-home__metric">
                <span className="tabular-nums">{iptLoading ? '—' : cidadesVisitadas}</span>
                <small> de {municipiosTotal} municípios</small>
              </p>
              <PiauiDots points={piPoints} />
              <GoBtn href="/dashboard/territorio/ipt" label="Abrir território" />
            </article>

            <article className="wr-home__card wr-home__card--kpi">
              <p className="wr-home__kicker">Compromissos hoje</p>
              <p className="wr-home__metric tabular-nums">
                {agendaListaLoading ? '—' : agendaLista.length}
                <small> agendas</small>
              </p>
              <Calendar className="wr-home__kpi-icon" strokeWidth={1.25} aria-hidden />
              <GoBtn href="/dashboard/agenda" label="Abrir agenda" />
            </article>
          </div>

          <div className="wr-home__minis">
            <article className="wr-home__card wr-home__card--mini">
              <p className="wr-home__kicker">Pesquisas</p>
              <p className="wr-home__metric-sm tabular-nums">
                {pollsLoading ? '—' : pesquisasValor} {pesquisasLabel}
              </p>
              <Sparkline
                values={[2, 4, 3, 6, 5, pesquisasValor || 4, 5]}
                className="wr-home__spark wr-home__spark--mini"
              />
              <GoBtn href="/dashboard/gestao-pesquisas" label="Abrir pesquisas" />
            </article>

            <article className="wr-home__card wr-home__card--mini">
              <p className="wr-home__kicker">Redes sociais</p>
              <p className="wr-home__metric-sm">
                {deltaLabel ? (
                  <span className={engDelta != null && engDelta < 0 ? 'wr-home__delta--down' : 'wr-home__delta--up'}>
                    {deltaLabel}
                  </span>
                ) : (
                  '—'
                )}{' '}
                <small>engajamento</small>
              </p>
              <Sparkline
                values={engSeries.length > 1 ? engSeries : [4, 6, 5, 8, 7, 9]}
                className="wr-home__spark wr-home__spark--mini"
              />
              <GoBtn href="/dashboard/conteudo/redes" label="Abrir redes" />
            </article>

            <article className="wr-home__card wr-home__card--mini">
              <p className="wr-home__kicker">Atendimentos</p>
              <p className="wr-home__metric-sm tabular-nums">
                {formatWarRoomNumber(atendimentosHoje)} <small>no funil</small>
              </p>
              <Sparkline values={[8, 10, 9, 12, 11, 14]} className="wr-home__spark wr-home__spark--mini" />
              <GoBtn href="/dashboard/whatsapp" label="Abrir CRM" />
            </article>

            <article className="wr-home__card wr-home__card--mini">
              <p className="wr-home__kicker">Mobilização</p>
              <p className="wr-home__metric-sm tabular-nums">
                {mobilizacaoPct}% <small>da meta</small>
              </p>
              <div
                className="wr-home__ring"
                style={{ ['--wr-ring' as string]: `${mobilizacaoPct}` }}
                aria-hidden
              />
              <GoBtn href="/dashboard/mobilizacao/config" label="Abrir mobilização" />
            </article>
          </div>

          <div className="wr-home__split">
            <article className="wr-home__card wr-home__card--status">
              <AlertTriangle className="wr-home__status-ico wr-home__status-ico--alert" strokeWidth={1.6} />
              <div>
                <p className="wr-home__kicker">Alertas prioritários</p>
                <p className="wr-home__status-copy">
                  <strong className="tabular-nums">{alertasAcao}</strong> requerem ação
                </p>
              </div>
              <GoBtn label="Abrir fila de decisões" onClick={() => setDecisoesOpen(true)} />
            </article>
            <article className="wr-home__card wr-home__card--status">
              <Users className="wr-home__status-ico wr-home__status-ico--ok" strokeWidth={1.6} />
              <div>
                <p className="wr-home__kicker">Lideranças ativas</p>
                <p className="wr-home__status-copy">
                  <strong className="tabular-nums">
                    {iptLoading ? '—' : liderancasAtivas.toLocaleString('pt-BR')}
                  </strong>{' '}
                  mobilizadas
                </p>
              </div>
              <GoBtn href="/dashboard/territorio/ipt" label="Abrir lideranças" />
            </article>
          </div>

          <div className="wr-home__bottom">
            <article className="wr-home__card wr-home__card--list">
              <p className="wr-home__kicker">Atualizações recentes</p>
              {atualizacoes.length === 0 ? (
                <p className="wr-home__muted">Sem movimentação recente.</p>
              ) : (
                <ul>
                  {atualizacoes.map((row) => (
                    <li key={`${row.cidade}-${row.texto}`}>
                      <span>
                        <strong>{row.cidade}</strong>
                        <em>{row.texto}</em>
                      </span>
                      <time>{row.when}</time>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="wr-home__text-link"
                onClick={() => setDecisoesOpen(true)}
              >
                Ver todas atualizações →
              </button>
            </article>

            <article className="wr-home__card wr-home__card--list">
              <p className="wr-home__kicker">Próximas visitas</p>
              {proximas.length === 0 ? (
                <p className="wr-home__muted">Nenhuma visita na janela.</p>
              ) : (
                <ul>
                  {proximas.slice(0, 3).map((v) => {
                    const hoje = todayKeyInTz()
                    const amanha = addDaysToKey(hoje, 1)
                    const quando =
                      v.dataKey === hoje
                        ? 'Hoje'
                        : v.dataKey === amanha
                          ? `Amanhã · ${v.dataLabel}`
                          : v.dataLabel
                    return (
                    <li key={v.id}>
                      <span>
                        <strong>{v.municipioLabel} - PI</strong>
                        <em>{quando}</em>
                      </span>
                      <time className="tabular-nums">{v.horario}</time>
                    </li>
                    )
                  })}
                </ul>
              )}
              <button
                type="button"
                className="wr-home__text-link"
                onClick={() =>
                  setAgendaModalMunicipio(proximas[0]?.municipioLabel ?? 'Piauí')
                }
              >
                Ver rota completa →
              </button>
            </article>

            <blockquote className="wr-home__quote">
              <p>Cada cidade. Cada pessoa. Um Piauí melhor para todos.</p>
              <footer>Jadyel</footer>
            </blockquote>
          </div>
          </div>
        </div>
      </div>

      {agendaModalMunicipio ? (
        <WarRoomAgendaProximosModal
          municipio={agendaModalMunicipio}
          itens={
            agendaPorMunicipio.get(
              proximas.find((p) => p.municipioLabel === agendaModalMunicipio)?.municipioKey ?? '',
            ) ?? proximas
          }
          hojeKey={todayKeyInTz()}
          municipiosIpt={municipios}
          agendaPorMunicipio={agendaPorMunicipio}
          onClose={() => setAgendaModalMunicipio(null)}
        />
      ) : null}
      {decisoesOpen ? (
        <WarRoomDecisoesModal
          secoes={groupDecisoesPorSecao(decisoes, { includeOutros: true })}
          onClose={() => setDecisoesOpen(false)}
        />
      ) : null}
    </div>
  )
}
