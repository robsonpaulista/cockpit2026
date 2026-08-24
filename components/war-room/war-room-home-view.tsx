'use client'

import Link from 'next/link'
import {
  ArrowUpRight,
  Bookmark,
  Calendar,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useIpt } from '@/hooks/use-ipt'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { type CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { cn } from '@/lib/utils'
import {
  addDaysToKey,
  buildAgendaProximosPorMunicipio,
  calendarDateInTz,
  listCidadesComAgendaProxima,
  todayKeyInTz,
  type WarRoomAgendaProximoItem,
  type WarRoomAgendaVisita,
} from '@/lib/war-room/agenda-proximos'
import { resolveAgendaLiveStatus } from '@/components/war-room/war-room-agenda-card'
import { WarRoomAgendaProximosModal } from '@/components/war-room/war-room-agenda-proximos-modal'
import { WarRoomDecisoesModal } from '@/components/war-room/war-room-decisoes-modal'
import { WarRoomPesquisaAndamentoModal } from '@/components/war-room/war-room-pesquisa-andamento-modal'
import { useWarRoomRefresh } from '@/components/war-room/war-room-refresh-context'
import {
  fetchInstagramData,
  loadInstagramConfigAsync,
  type InstagramClientConfig,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'
import { buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import { type PollIptRow } from '@/lib/ipt-pesquisa'
import { chavePesquisaDistinta } from '@/lib/pesquisa-tendencia-executive'
import { type WarRoomAgendaItem } from '@/lib/war-room/mock-data'
import type { WarRoomDecisao } from '@/lib/war-room/decisoes'
import { groupDecisoesPorSecao } from '@/lib/war-room/decisoes-secoes'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { IPT_TOTAL_MUNICIPIOS_PI, temExpectativa } from '@/lib/ipt-missoes'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { diasDesdeVisita } from '@/lib/war-room/expectativa-visita-alerta'
import { formatCountdownConfirmadosAgenda } from '@/lib/war-room/agenda-arrivals-refresh'
import {
  andamentoAtivos,
  type WarRoomPesquisaAndamento,
} from '@/lib/war-room/pesquisas-andamento'
import { fetchPesquisasAndamento } from '@/lib/war-room/pesquisas-andamento-client'

type RedesHojeTotais = {
  posts: number
  likes: number
  comments: number
  shares: number
  saves: number
}

const REDES_HOJE_VAZIO: RedesHojeTotais = {
  posts: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
}

const REDES_ENG_ITENS: Array<{
  id: keyof Omit<RedesHojeTotais, 'posts'>
  label: string
  Icon: LucideIcon
}> = [
  { id: 'likes', label: 'Curtidas', Icon: Heart },
  { id: 'comments', label: 'Comentários', Icon: MessageCircle },
  { id: 'shares', label: 'Compartilhamentos', Icon: Send },
  { id: 'saves', label: 'Salvamentos', Icon: Bookmark },
]

type Props = {
  agendaItems: WarRoomAgendaItem[]
  agendaLoading: boolean
  confirmadosProximaSyncEm: number | null
}

const HOME_JANELA_DIAS = 60
const PROXIMAS_VISITAS_JANELA_DIAS = 7
const RADAR_LOOKBACK_DAYS = 30
const RADAR_ADS_LIMIT = 400
const RADAR_NEWS_LIMIT = 500
const LIST_PREVIEW_LIMIT = 3

function visitadaNosUltimosDias(m: IptMunicipio, janelaDias: number): boolean {
  const dias = diasDesdeVisita(m.ultimaVisita)
  if (dias != null && dias >= 0 && dias <= janelaDias) return true
  if (janelaDias >= 15 && (m.detalhes?.visitasUltimos15Dias ?? 0) > 0) return true
  if (janelaDias >= 30 && (m.detalhes?.visitasNoPeriodo ?? 0) > 0) return true
  if (janelaDias >= 60 && (m.detalhes?.visitasPeriodoAnterior ?? 0) > 0) return true
  return false
}

function nomeCidadePoll(poll: PollIptRow): string {
  const c = poll.cities
  if (!c) return ''
  if (Array.isArray(c)) return (c[0]?.name ?? '').trim()
  return (c.name ?? '').trim()
}

function nomeNormalizado(valor: string | null | undefined): string {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Cidades com ≥1 pesquisa distinta (data + instituto + cidade) na janela. */
function municipiosComPesquisaNaJanela(
  polls: PollIptRow[],
  janelaDias: number,
): Set<string> {
  const ondas = new Set<string>()
  const cidades = new Set<string>()
  for (const poll of polls) {
    const cidade = nomeCidadePoll(poll)
    if (!cidade) continue
    const dias = diasDesdeVisita(poll.data)
    if (dias == null || dias < 0 || dias > janelaDias) continue
    const ondaKey = chavePesquisaDistinta({
      data: poll.data,
      tipo: poll.tipo,
      candidato_nome: poll.candidato_nome,
      intencao: poll.intencao,
      instituto: poll.instituto ?? '',
      cidadeId: poll.cidade_id ?? null,
      cidadeNome: cidade,
    })
    if (ondas.has(ondaKey)) continue
    ondas.add(ondaKey)
    cidades.add(normalizeIptMunicipio(cidade))
  }
  return cidades
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

function dataHoraCurta(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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

function useConfirmadosCountdown(proximoSyncEm: number | null): string | null {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (proximoSyncEm == null) return
    const tick = () => setAgora(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [proximoSyncEm])

  if (proximoSyncEm == null) return null
  return formatCountdownConfirmadosAgenda(proximoSyncEm - agora)
}

export function WarRoomHomeView({
  agendaItems,
  agendaLoading,
  confirmadosProximaSyncEm,
}: Props) {
  const { user } = useAuth()
  const { municipios, loading: iptLoading } = useIpt()
  const { register } = useWarRoomRefresh()

  const [hour, setHour] = useState(() => new Date().getHours())
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })
  const [polls, setPolls] = useState<PollIptRow[]>([])
  const [pollsLoading, setPollsLoading] = useState(true)
  const [redesHoje, setRedesHoje] = useState<RedesHojeTotais>(REDES_HOJE_VAZIO)
  const [redesHojePosts, setRedesHojePosts] = useState<InstagramMetrics['posts']>([])
  const [redesLoading, setRedesLoading] = useState(true)
  const [anunciosAtivos, setAnunciosAtivos] = useState(0)
  const [anunciosSpend, setAnunciosSpend] = useState<string | null>(null)
  const [anunciosRecentes, setAnunciosRecentes] = useState<MetaAdsMentionWithActor[]>([])
  const [noticiasCount, setNoticiasCount] = useState(0)
  const [noticiasRecentes, setNoticiasRecentes] = useState<GoogleNewsMentionWithActor[]>([])
  const [radarLoading, setRadarLoading] = useState(true)
  const [decisoes, setDecisoes] = useState<WarRoomDecisao[]>([])
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())
  const [agendaModalMunicipio, setAgendaModalMunicipio] = useState<string | null>(null)
  const [decisoesOpen, setDecisoesOpen] = useState(false)
  const [andamentoAll, setAndamentoAll] = useState<WarRoomPesquisaAndamento[]>([])
  const [andamentoModal, setAndamentoModal] = useState<
    WarRoomPesquisaAndamento | null | undefined
  >(undefined)

  const nome = firstName(user?.profile?.name)
  const confirmadosCountdown = useConfirmadosCountdown(confirmadosProximaSyncEm)

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
    if (!silent) {
      setPollsLoading(true)
      setRedesLoading(true)
      setRadarLoading(true)
    }
    try {
      const [pollRes, agendaRes, decRes, igCfg, adsRes, newsRes, andamentoRes] =
        await Promise.all([
          fetch('/api/pesquisa?limit=5000', { cache: 'no-store' }),
          silent
            ? Promise.resolve(null)
            : fetch('/api/agenda/events', { cache: 'no-store' }),
          fetch('/api/war-room/decisoes', { cache: 'no-store' }),
          loadInstagramConfigAsync().catch((): InstagramClientConfig => ({
            configured: false,
            token: '',
            businessAccountId: '',
          })),
          fetch(
            `/api/meta-ads/mentions?politico=${OWN_CANDIDATE_SLUG}&days=${RADAR_LOOKBACK_DAYS}&limit=${RADAR_ADS_LIMIT}`,
            { cache: 'no-store' },
          ),
          fetch(
            `/api/google-news/mentions?politico=${OWN_CANDIDATE_SLUG}&days=${RADAR_LOOKBACK_DAYS}&limit=${RADAR_NEWS_LIMIT}&channel=news`,
            { cache: 'no-store' },
          ),
          fetchPesquisasAndamento(),
        ])

      if (pollRes.ok) {
        const rows = (await pollRes.json()) as PollIptRow[]
        setPolls(Array.isArray(rows) ? rows : [])
      }

      setAndamentoAll(andamentoRes.items)

      if (agendaRes?.ok) {
        const json = (await agendaRes.json()) as { events?: CalendarEventRow[] }
        setAgendaPorMunicipio(
          buildAgendaProximosPorMunicipio(json.events ?? [], {
            janelaDias: PROXIMAS_VISITAS_JANELA_DIAS,
          }),
        )
      }

      if (decRes.ok) {
        const json = (await decRes.json()) as { decisoes?: WarRoomDecisao[] }
        setDecisoes(Array.isArray(json.decisoes) ? json.decisoes : [])
      }

      if (adsRes.ok) {
        const json = (await adsRes.json()) as { ads?: MetaAdsMentionWithActor[] }
        const active = (json.ads ?? []).filter((ad) => ad.is_active === true)
        setAnunciosAtivos(active.length)
        const spend = buildMetaAdsPeriodTotals(active).spendLabel
        setAnunciosSpend(spend && spend !== '—' ? spend : null)
        const ordenados = [...active].sort((a, b) =>
          String(b.started_running_at || b.created_at).localeCompare(
            String(a.started_running_at || a.created_at),
          ),
        )
        setAnunciosRecentes(ordenados.slice(0, LIST_PREVIEW_LIMIT))
      } else {
        setAnunciosAtivos(0)
        setAnunciosSpend(null)
        setAnunciosRecentes([])
      }

      if (newsRes.ok) {
        const json = (await newsRes.json()) as { mentions?: GoogleNewsMentionWithActor[] }
        const mentions = json.mentions ?? []
        const unique = new Set(mentions.map((m) => m.article_id || m.url || m.id))
        setNoticiasCount(unique.size)
        const dedup = new Map<string, GoogleNewsMentionWithActor>()
        for (const m of mentions) {
          const key = m.article_id || m.url || m.id
          if (!dedup.has(key)) dedup.set(key, m)
        }
        const ordenadas = [...dedup.values()].sort((a, b) =>
          String(b.published_at || b.collected_at).localeCompare(
            String(a.published_at || a.collected_at),
          ),
        )
        setNoticiasRecentes(ordenadas.slice(0, LIST_PREVIEW_LIMIT))
      } else {
        setNoticiasCount(0)
        setNoticiasRecentes([])
      }

      if (igCfg.configured) {
        const data = await fetchInstagramData(
          igCfg.token,
          igCfg.businessAccountId,
          '7d',
        ).catch(() => null)
        const today = todayKeyInTz()
        const postsHoje = (data?.posts ?? []).filter(
          (post) => calendarDateInTz(post.postedAt) === today,
        )
        setRedesHojePosts(postsHoje)
        setRedesHoje({
          posts: postsHoje.length,
          likes: postsHoje.reduce((s, p) => s + (p.metrics.likes || 0), 0),
          comments: postsHoje.reduce((s, p) => s + (p.metrics.comments || 0), 0),
          shares: postsHoje.reduce((s, p) => s + (p.metrics.shares || 0), 0),
          saves: postsHoje.reduce((s, p) => s + (p.metrics.saves || 0), 0),
        })
      } else {
        setRedesHoje(REDES_HOJE_VAZIO)
      }
    } finally {
      if (!silent) {
        setPollsLoading(false)
        setRedesLoading(false)
        setRadarLoading(false)
      }
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

  const proximas = useMemo(
    () => listCidadesComAgendaProxima(universo, agendaPorMunicipio),
    [universo, agendaPorMunicipio],
  )

  const expectativaTotal = useMemo(
    () => universo.reduce((s, m) => s + (Number.isFinite(m.expectativaVotos) ? m.expectativaVotos : 0), 0),
    [universo],
  )

  const cidadesComMeta = useMemo(() => universo.filter(temExpectativa), [universo])
  const municipiosComMeta = cidadesComMeta.length
  const coberturaMetaPct =
    IPT_TOTAL_MUNICIPIOS_PI > 0
      ? Math.min(100, (municipiosComMeta / IPT_TOTAL_MUNICIPIOS_PI) * 100)
      : 0

  const cidadesVisitadas = useMemo(
    () =>
      cidadesComMeta.filter((m) => visitadaNosUltimosDias(m, HOME_JANELA_DIAS)).length,
    [cidadesComMeta],
  )
  const coberturaVisitasPct =
    municipiosComMeta > 0
      ? Math.min(100, (cidadesVisitadas / municipiosComMeta) * 100)
      : 0

  const cidadesComPesquisa = useMemo(() => {
    const comPesquisa = municipiosComPesquisaNaJanela(polls, HOME_JANELA_DIAS)
    return cidadesComMeta.filter((m) => comPesquisa.has(normalizeIptMunicipio(m.municipio)))
      .length
  }, [polls, cidadesComMeta])
  const coberturaPesquisasPct =
    municipiosComMeta > 0
      ? Math.min(100, (cidadesComPesquisa / municipiosComMeta) * 100)
      : 0

  const pesquisasRecentes = useMemo(() => {
    type Item = {
      id: string
      cidade: string
      instituto: string
      data: string
      tipo: 'estimulada' | 'espontanea'
      intencaoJadyel: number
      posicaoJadyel: number
    }

    const alvo = 'jadyel'
    const linhasNaJanela = polls.filter((poll) => {
      const dias = diasDesdeVisita(poll.data)
      return dias != null && dias >= 0 && dias <= HOME_JANELA_DIAS
    })

    const porOnda = new Map<string, PollIptRow[]>()
    for (const poll of linhasNaJanela) {
      const cidade = nomeCidadePoll(poll)
      if (!cidade) continue
      const key = [
        poll.data.includes('T') ? poll.data.split('T')[0] : poll.data,
        (poll.instituto ?? '').trim().toLowerCase(),
        normalizeIptMunicipio(cidade),
      ].join('|')
      const bucket = porOnda.get(key)
      if (bucket) bucket.push(poll)
      else porOnda.set(key, [poll])
    }

    const itens: Item[] = []
    for (const [key, rows] of porOnda) {
      const amostra = rows[0]
      const cidade = nomeCidadePoll(amostra)
      if (!cidade) continue

      const rowEstimulada = rows.find(
        (r) => r.tipo === 'estimulada' && nomeNormalizado(r.candidato_nome).includes(alvo),
      )
      const rowEspontanea = rows.find(
        (r) => r.tipo === 'espontanea' && nomeNormalizado(r.candidato_nome).includes(alvo),
      )
      const escolhida = rowEstimulada ?? rowEspontanea
      if (!escolhida || !Number.isFinite(escolhida.intencao)) continue
      const candidatosDoTipo = rows
        .filter((r) => r.tipo === escolhida.tipo && Number.isFinite(r.intencao))
        .sort((a, b) => b.intencao - a.intencao)
      const posicaoJadyel =
        candidatosDoTipo.findIndex((r) => r === escolhida) >= 0
          ? candidatosDoTipo.findIndex((r) => r === escolhida) + 1
          : 0

      itens.push({
        id: `${key}|${escolhida.tipo}`,
        cidade,
        instituto: (amostra.instituto ?? '').trim() || 'Instituto não informado',
        data: amostra.data,
        tipo: escolhida.tipo,
        intencaoJadyel: escolhida.intencao,
        posicaoJadyel,
      })
    }

    return itens
      .sort((a, b) => String(b.data).localeCompare(String(a.data)))
      .slice(0, LIST_PREVIEW_LIMIT)
  }, [polls])

  const andamentoPreview = useMemo(
    () => andamentoAtivos(andamentoAll).slice(0, LIST_PREVIEW_LIMIT),
    [andamentoAll],
  )
  const pesquisasPreview = useMemo(() => {
    const slots = Math.max(0, LIST_PREVIEW_LIMIT - andamentoPreview.length)
    return pesquisasRecentes.slice(0, slots)
  }, [andamentoPreview.length, pesquisasRecentes])

  // Alertas prioritários e Lideranças ativas foram removidos da Home.

  const agendaLista = agendaItems
  const agendaListaLoading = agendaLoading
  const agendaPreview = agendaLista
  const agendaStatuses = useMemo(
    () => resolveAgendaLiveStatus(agendaLista, nowMinutes),
    [agendaLista, nowMinutes],
  )

  const ultimasVisitas = useMemo(() => {
    return [...universo]
      .filter((m) => m.ultimaVisita)
      .sort((a, b) => String(b.ultimaVisita).localeCompare(String(a.ultimaVisita)))
      .slice(0, 3)
      .map((m) => ({
        cidade: m.municipio,
        texto: 'Visita realizada',
        when: relativeFromIso(m.ultimaVisita),
      }))
  }, [universo])

  const municipiosTotal = universo.length || 224
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
              <div className="wr-home__agenda-head-copy">
                <p className="wr-home__kicker">Agenda de hoje</p>
                {confirmadosCountdown ? (
                  <p
                    className="wr-home__agenda-sync tabular-nums"
                    title="Próxima atualização silenciosa dos confirmados na agenda"
                  >
                    Confirmados em {confirmadosCountdown}
                  </p>
                ) : null}
              </div>
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
              <p className="wr-home__kicker">Meta de Votos</p>
              <p className="wr-home__metric tabular-nums">
                {iptLoading ? '—' : expectativaTotal.toLocaleString('pt-BR')}
              </p>
              <p className="wr-home__delta wr-home__delta--up">universo PI</p>
              <p
                className="wr-home__coverage"
                aria-label={
                  iptLoading
                    ? 'Carregando cobertura da meta de votos'
                    : `${municipiosComMeta} de ${IPT_TOTAL_MUNICIPIOS_PI} municípios com meta de votos`
                }
              >
                <span className="wr-home__coverage-label">
                  <span className="tabular-nums">
                    {iptLoading ? '—' : municipiosComMeta.toLocaleString('pt-BR')}
                  </span>{' '}
                  de {IPT_TOTAL_MUNICIPIOS_PI} municípios
                </span>
                <span className="wr-home__coverage-bar" aria-hidden>
                  <span style={{ width: iptLoading ? '0%' : `${coberturaMetaPct}%` }} />
                </span>
              </p>
              <GoBtn href="/dashboard/territorio/ipt" label="Abrir ranking de expectativa" />
            </article>

            <article className="wr-home__card wr-home__card--kpi">
              <p className="wr-home__kicker">Cidades visitadas</p>
              <p className="wr-home__metric tabular-nums">
                {iptLoading ? '—' : cidadesVisitadas.toLocaleString('pt-BR')}
              </p>
              <p className="wr-home__delta">últimos {HOME_JANELA_DIAS} dias</p>
              <p
                className="wr-home__coverage"
                aria-label={
                  iptLoading
                    ? 'Carregando cidades visitadas'
                    : `${cidadesVisitadas} de ${municipiosComMeta} municípios com meta visitados nos últimos ${HOME_JANELA_DIAS} dias`
                }
              >
                <span className="wr-home__coverage-label">
                  <span className="tabular-nums">
                    {iptLoading ? '—' : cidadesVisitadas.toLocaleString('pt-BR')}
                  </span>{' '}
                  de {iptLoading ? '—' : municipiosComMeta.toLocaleString('pt-BR')} municípios
                </span>
                <span className="wr-home__coverage-bar" aria-hidden>
                  <span style={{ width: iptLoading ? '0%' : `${coberturaVisitasPct}%` }} />
                </span>
              </p>
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
            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <p className="wr-home__kicker">Notícias</p>
              <p className="wr-home__metric-sm tabular-nums">
                {radarLoading ? '—' : noticiasCount.toLocaleString('pt-BR')}
                {!radarLoading ? (
                  <small> {noticiasCount === 1 ? 'matéria' : 'matérias'}</small>
                ) : null}
              </p>
              <p className="wr-home__delta">últimos {RADAR_LOOKBACK_DAYS} dias</p>
              {radarLoading ? (
                <p className="wr-home__muted">Carregando notícias…</p>
              ) : noticiasRecentes.length === 0 ? (
                <p className="wr-home__muted">Sem notícias no período.</p>
              ) : (
                <ul>
                  {noticiasRecentes.map((n) => (
                    <li key={n.id}>
                      <span>
                        <strong>{(n.source_name ?? '').trim() || 'Fonte não identificada'}</strong>
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noreferrer"
                          className="wr-home__list-link"
                          title={n.title ?? 'Abrir notícia'}
                        >
                          {(n.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 64)}
                        </a>
                      </span>
                      <time className="tabular-nums">{dataHoraCurta(n.published_at || n.collected_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
              <GoBtn
                href="/dashboard/noticias/monitoramento?tab=google-news"
                label="Abrir notícias no Radar Eleitoral"
              />
            </article>

            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <div className="wr-home__kicker-row">
                <p className="wr-home__kicker">Pesquisas</p>
                <button
                  type="button"
                  className="wr-home__incluir"
                  onClick={() => setAndamentoModal(null)}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  Incluir
                </button>
              </div>
              <p className="wr-home__metric-sm tabular-nums">
                {pollsLoading || iptLoading ? '—' : cidadesComPesquisa.toLocaleString('pt-BR')}
              </p>
              <p className="wr-home__delta">últimos {HOME_JANELA_DIAS} dias</p>
              {pollsLoading ? (
                <p className="wr-home__muted">Carregando pesquisas…</p>
              ) : andamentoPreview.length === 0 && pesquisasPreview.length === 0 ? (
                <p className="wr-home__muted">Sem pesquisas na janela.</p>
              ) : (
                <ul>
                  {andamentoPreview.map((item) => (
                    <li key={`and-${item.id}`}>
                      <button
                        type="button"
                        className="wr-home__pesquisa-live"
                        title={`${item.dataLabel} · ${item.instituto} · em andamento`}
                        onClick={() => setAndamentoModal(item)}
                      >
                        <strong>{item.cidade}</strong>
                        <em className="wr-home__list-meta-inline">
                          {item.dataLabel} · {item.instituto} ·{' '}
                          <span className="wr-home__live">
                            <span className="wr-home__live-dot" aria-hidden />
                            Em campo
                          </span>
                        </em>
                      </button>
                    </li>
                  ))}
                  {pesquisasPreview.map((item) => (
                    <li key={item.id}>
                      <span>
                        <strong>{item.cidade}</strong>
                        <em
                          className="wr-home__list-meta-inline"
                          title={`${dataHoraCurta(item.data)} · ${item.instituto} · ${item.intencaoJadyel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · ${item.posicaoJadyel > 0 ? `${item.posicaoJadyel}º lugar` : 'posição n/d'}`}
                        >
                          {dataHoraCurta(item.data)} · {item.instituto} ·{' '}
                          {item.intencaoJadyel.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ·{' '}
                          <span className="wr-home__rank-chip">
                            <Trophy className="wr-home__rank-icon" strokeWidth={1.7} aria-hidden />
                            {item.posicaoJadyel > 0 ? `${item.posicaoJadyel}º` : 'n/d'}
                          </span>
                        </em>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="wr-home__coverage">
                <span className="wr-home__coverage-label">
                  <span className="tabular-nums">
                    {pollsLoading || iptLoading ? '—' : cidadesComPesquisa.toLocaleString('pt-BR')}
                  </span>{' '}
                  de {pollsLoading || iptLoading ? '—' : municipiosComMeta.toLocaleString('pt-BR')} municípios
                </span>
                <span className="wr-home__coverage-bar" aria-hidden>
                  <span style={{ width: pollsLoading || iptLoading ? '0%' : `${coberturaPesquisasPct}%` }} />
                </span>
              </p>
              <GoBtn href="/dashboard/gestao-pesquisas" label="Abrir pesquisas" />
            </article>

            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <p className="wr-home__kicker">Últimas visitas realizadas</p>
              {ultimasVisitas.length === 0 ? (
                <p className="wr-home__muted">Sem visitas registradas recentemente.</p>
              ) : (
                <ul>
                  {ultimasVisitas.map((row) => (
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
              <Link href="/dashboard/territorio/ipt" className="wr-home__text-link">
                Abrir território →
              </Link>
            </article>
          </div>

          <div className="wr-home__bottom">
            <article className="wr-home__card wr-home__card--list">
              <p className="wr-home__kicker">Próximas visitas</p>
              <p className="wr-home__delta">próximos {PROXIMAS_VISITAS_JANELA_DIAS} dias</p>
              {proximas.length === 0 ? (
                <p className="wr-home__muted">Nenhuma visita nos próximos {PROXIMAS_VISITAS_JANELA_DIAS} dias.</p>
              ) : (
                <ul>
                  {proximas.map((v) => {
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

            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <p className="wr-home__kicker">Redes sociais</p>
              <p className="wr-home__metric-sm tabular-nums">
                {redesLoading ? '—' : redesHoje.posts.toLocaleString('pt-BR')}
                {!redesLoading ? (
                  <small>
                    {' '}
                    {redesHoje.posts === 1 ? 'postagem' : 'postagens'}
                  </small>
                ) : null}
              </p>
              <p className="wr-home__delta">hoje</p>
              {redesLoading ? (
                <p className="wr-home__muted">Carregando postagens…</p>
              ) : redesHojePosts.length === 0 ? (
                <p className="wr-home__muted">Sem postagens hoje.</p>
              ) : (
                <ul className="wr-home__posts-list">
                  {redesHojePosts.map((post) => {
                    const time = (() => {
                      const d = new Date(post.postedAt)
                      if (Number.isNaN(d.getTime())) return ''
                      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    })()
                    const caption = (post.caption ?? '')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 54)
                    const captionText = caption.length > 0 ? `${caption}${post.caption.length > 54 ? '…' : ''}` : ''

                    return (
                      <li key={post.id} className="wr-home__post-item">
                        <div className="wr-home__post-head">
                          <span className="wr-home__post-time tabular-nums">{time}</span>
                          {captionText ? (
                            <span className="wr-home__post-caption">{captionText}</span>
                          ) : (
                            <span className="wr-home__post-caption wr-home__muted">Sem texto</span>
                          )}
                        </div>

                        <ul className="wr-home__eng-ig wr-home__eng-ig--post" aria-label="Engajamento da postagem">
                          {REDES_ENG_ITENS.map((item) => {
                            const Icon = item.Icon
                            const value = formatWarRoomNumber(post.metrics[item.id])
                            return (
                              <li key={item.id} title={item.label}>
                                <Icon className="wr-home__eng-ig-icon" strokeWidth={1.75} aria-hidden />
                                <span className="tabular-nums">{value}</span>
                                <span className="sr-only">
                                  {item.label}: {value}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              )}
              <GoBtn href="/dashboard/conteudo/redes" label="Abrir redes" />
            </article>

            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <p className="wr-home__kicker">Anúncios Ativos</p>
              <p className="wr-home__metric-sm tabular-nums">
                {radarLoading ? '—' : anunciosAtivos.toLocaleString('pt-BR')}
                {!radarLoading ? (
                  <small> {anunciosAtivos === 1 ? 'ativo' : 'ativos'}</small>
                ) : null}
              </p>
              <p className="wr-home__delta">Jadyel Alencar</p>
              {radarLoading ? (
                <p className="wr-home__muted">Carregando anúncios…</p>
              ) : anunciosRecentes.length === 0 ? (
                <p className="wr-home__muted">Sem anúncios ativos no período.</p>
              ) : (
                <ul>
                  {anunciosRecentes.map((ad) => (
                    <li key={ad.id}>
                      <span>
                        <strong>{(ad.page_name ?? '').trim() || 'Página não identificada'}</strong>
                        <em>{(ad.ad_body ?? '').replace(/\s+/g, ' ').trim().slice(0, 58) || 'Sem texto do anúncio'}</em>
                      </span>
                      <time className="tabular-nums">{dataHoraCurta(ad.started_running_at || ad.created_at)}</time>
                    </li>
                  ))}
                </ul>
              )}
              {anunciosSpend ? (
                <p className="wr-home__coverage-label">{anunciosSpend}</p>
              ) : null}
              <GoBtn
                href="/dashboard/noticias/monitoramento?tab=meta-ads"
                label="Abrir anúncios no Radar Eleitoral"
              />
            </article>
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
      {andamentoModal !== undefined ? (
        <WarRoomPesquisaAndamentoModal
          initial={andamentoModal}
          onClose={() => setAndamentoModal(undefined)}
          onSaved={(item) => {
            setAndamentoAll((prev) => {
              const without = prev.filter((row) => row.id !== item.id)
              return [item, ...without]
            })
            setAndamentoModal(undefined)
          }}
        />
      ) : null}
    </div>
  )
}
