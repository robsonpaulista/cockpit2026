'use client'

import Link from 'next/link'
import {
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  Instagram,
  Loader2,
  Megaphone,
  MessageCircle,
  Newspaper,
  Plus,
  Send,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/use-auth'
import { useIpt } from '@/hooks/use-ipt'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { cn } from '@/lib/utils'
import { calendarDateInTz, todayKeyInTz } from '@/lib/war-room/agenda-proximos'
import { resolveAgendaLiveStatus } from '@/components/war-room/war-room-agenda-card'
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
import { temExpectativa } from '@/lib/ipt-missoes'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { diasDesdeVisita } from '@/lib/war-room/expectativa-visita-alerta'
import { formatCountdownConfirmadosAgenda } from '@/lib/war-room/agenda-arrivals-refresh'
import {
  andamentoVisiveisNoCard,
  isPesquisaAndamentoFinalizadaRecente,
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
const RADAR_LOOKBACK_DAYS = 30
const AGENDA_PAGE_SIZE = 7
const RADAR_ADS_LIMIT = 400

const WarRoomCopilotoCoberturaView = dynamic(
  () =>
    import('@/components/war-room/war-room-copiloto-cobertura-view').then(
      (m) => m.WarRoomCopilotoCoberturaView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="wr-home__presenca-loading">
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
        Carregando presença territorial…
      </div>
    ),
  },
)
const RADAR_NEWS_LIMIT = 500
const LIST_PREVIEW_LIMIT = 3

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
  const [decisoesOpen, setDecisoesOpen] = useState(false)
  const [andamentoAll, setAndamentoAll] = useState<WarRoomPesquisaAndamento[]>([])
  const [andamentoModal, setAndamentoModal] = useState<
    WarRoomPesquisaAndamento | null | undefined
  >(undefined)
  const [agendaPage, setAgendaPage] = useState(0)

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
      const [pollRes, decRes, igCfg, adsRes, newsRes, andamentoRes] =
        await Promise.all([
          fetch('/api/pesquisa?limit=5000', { cache: 'no-store' }),
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

  const cidadesComMeta = useMemo(() => universo.filter(temExpectativa), [universo])
  const municipiosComMeta = cidadesComMeta.length

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
    () => andamentoVisiveisNoCard(andamentoAll).slice(0, LIST_PREVIEW_LIMIT),
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
  const agendaPageCount = Math.max(1, Math.ceil(agendaPreview.length / AGENDA_PAGE_SIZE))
  const agendaPageSafe = Math.min(agendaPage, agendaPageCount - 1)
  const agendaPageItems = useMemo(() => {
    const start = agendaPageSafe * AGENDA_PAGE_SIZE
    return agendaPreview.slice(start, start + AGENDA_PAGE_SIZE)
  }, [agendaPreview, agendaPageSafe])

  useEffect(() => {
    setAgendaPage(0)
  }, [agendaLista.length])

  useEffect(() => {
    setAgendaPage((p) => Math.min(p, Math.max(0, agendaPageCount - 1)))
  }, [agendaPageCount])

  const agendaStatuses = useMemo(
    () => resolveAgendaLiveStatus(agendaLista, nowMinutes),
    [agendaLista, nowMinutes],
  )
  const agendaProgress = useMemo(() => {
    let concluido = 0
    let aoVivo = 0
    let proximo = 0
    for (const item of agendaLista) {
      const st = agendaStatuses.get(item.id) ?? 'proximo'
      if (st === 'concluido') concluido += 1
      else if (st === 'ao_vivo') aoVivo += 1
      else proximo += 1
    }
    const total = agendaLista.length
    const pct = total > 0 ? Math.round((concluido / total) * 100) : 0
    return { concluido, aoVivo, proximo, total, pct }
  }, [agendaLista, agendaStatuses])

  const greeting = greetingForHour(hour)

  return (
    <div className="wr-home">
      <header className="wr-home__topbar" aria-label="Saudação">
        <p className="wr-home__headline wr-home__headline--compact">
          O PIAUÍ EM <span>TEMPO REAL</span>
        </p>
        <p className="wr-home__hello">
          {greeting}, {nome}!
        </p>
      </header>

      <div className="wr-home__grid">
        <section className="wr-home__hero wr-home__hero--map" aria-label="Presença no território">
          <div className="wr-home__presenca">
            <WarRoomCopilotoCoberturaView
              variant="home"
              municipios={municipios}
              loading={iptLoading}
            />
          </div>
        </section>

        <div className="wr-home__right">
          <aside className="wr-home__agenda-card">
            <header className="wr-home__agenda-head">
              <div className="wr-home__agenda-head-copy">
                <p className="wr-home__kicker wr-home__kicker--with-icon">
                  <Calendar className="wr-home__kicker-icon" strokeWidth={2} aria-hidden />
                  Agenda de hoje
                </p>
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
            {!agendaListaLoading && agendaProgress.total > 0 ? (
              <div className="wr-home__agenda-progress">
                <p className="wr-home__agenda-progress-sum">
                  <span className="tabular-nums">{agendaProgress.concluido}</span> concluídos
                  {' · '}
                  <span className="tabular-nums">{agendaProgress.aoVivo}</span> em deslocamento
                  {' · '}
                  <span className="tabular-nums">{agendaProgress.proximo}</span> pela frente
                </p>
                <div
                  className="wr-home__agenda-progress-bar"
                  role="progressbar"
                  aria-valuenow={agendaProgress.concluido}
                  aria-valuemin={0}
                  aria-valuemax={agendaProgress.total}
                  aria-label={`${agendaProgress.concluido} de ${agendaProgress.total} concluídos`}
                >
                  <span style={{ width: `${agendaProgress.pct}%` }} />
                </div>
                <p className="wr-home__agenda-progress-cap tabular-nums">
                  {agendaProgress.concluido} de {agendaProgress.total} concluídos
                </p>
              </div>
            ) : null}
            {agendaListaLoading ? (
              <p className="wr-home__muted wr-home__agenda-empty">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                Carregando agenda…
              </p>
            ) : agendaPreview.length === 0 ? (
              <p className="wr-home__muted wr-home__agenda-empty">Nenhum compromisso hoje.</p>
            ) : (
              <>
                <ol className="wr-home__agenda-list">
                  {agendaPageItems.map((item) => {
                    const parsed = parseEventOriginFromSummary(item.titulo)
                    const origin = parsed.origin?.replace(/\s*-\s*/g, ' · ')
                    const titulo = parsed.title || item.titulo
                    const status = agendaStatuses.get(item.id) ?? 'proximo'
                    const chegou = Boolean(item.arrivalTime)
                    const arrivalAgo = item.arrivalTime ? formatArrivalAgo(item.arrivalTime) : ''
                    const hint = [
                      item.horario,
                      item.titulo,
                      item.municipio !== '—' ? item.municipio : null,
                    ]
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
                              <span className="wr-home__agenda-chegou">
                                {arrivalAgo || 'Chegou'}
                              </span>
                            ) : null}
                          </span>
                          <span className="wr-home__agenda-title">{titulo}</span>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                {agendaPageCount > 1 ? (
                  <div className="wr-home__agenda-pager" role="navigation" aria-label="Páginas da agenda">
                    <button
                      type="button"
                      className="wr-home__agenda-pager-btn"
                      disabled={agendaPageSafe <= 0}
                      onClick={() => setAgendaPage((p) => Math.max(0, p - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                    <span className="wr-home__agenda-pager-label tabular-nums">
                      {agendaPageSafe + 1} / {agendaPageCount}
                    </span>
                    <button
                      type="button"
                      className="wr-home__agenda-pager-btn"
                      disabled={agendaPageSafe >= agendaPageCount - 1}
                      onClick={() =>
                        setAgendaPage((p) => Math.min(agendaPageCount - 1, p + 1))
                      }
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                ) : null}
              </>
            )}
            <Link href="/dashboard/agenda" className="wr-home__agenda-foot">
              Ver agenda completa
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </Link>
          </aside>

          <div className="wr-home__cards">
            <article className="wr-home__card wr-home__card--list">
              <p className="wr-home__kicker wr-home__kicker--with-icon">
                <Newspaper className="wr-home__kicker-icon" strokeWidth={2} aria-hidden />
                Radar de Imprensa
              </p>
              <p className="wr-home__metric-sm tabular-nums">
                {radarLoading ? '—' : noticiasCount.toLocaleString('pt-BR')}
                {!radarLoading ? (
                  <small>
                    {' '}
                    {noticiasCount === 1 ? 'matéria' : 'matérias'}
                  </small>
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
                        <strong>{(n.source_name ?? '').trim() || 'Fonte'}</strong>
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noreferrer"
                          className="wr-home__list-link"
                          title={n.title ?? 'Abrir notícia'}
                        >
                          {(n.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 64) ||
                            'Sem título'}
                        </a>
                      </span>
                      <time className="tabular-nums">
                        {dataHoraCurta(n.published_at || n.collected_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <div className="wr-home__card-foot">
                <GoBtn
                  href="/dashboard/noticias/monitoramento?tab=google-news"
                  label="Ver radar completo"
                />
              </div>
            </article>

            <article className="wr-home__card wr-home__card--list">
              <div className="wr-home__kicker-row">
                <p className="wr-home__kicker wr-home__kicker--with-icon">
                  <BarChart3 className="wr-home__kicker-icon" strokeWidth={2} aria-hidden />
                  Pulso das Pesquisas
                </p>
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
                {pollsLoading ? '—' : cidadesComPesquisa.toLocaleString('pt-BR')}
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
                        onClick={() => setAndamentoModal(item)}
                      >
                        <strong>{item.cidade}</strong>
                        <em className="wr-home__list-meta-inline">
                          {item.dataLabel} · {item.instituto}
                        </em>
                      </button>
                      <span className="wr-home__live">
                        <span className="wr-home__live-dot" aria-hidden />
                        EM ANDAMENTO
                      </span>
                    </li>
                  ))}
                  {pesquisasPreview.map((item) => (
                    <li key={`pesq-${item.id}`}>
                      <span>
                        <strong>{item.cidade}</strong>
                        <em>
                          {dataHoraCurta(item.data)}
                          {item.instituto ? ` · ${item.instituto}` : ''}
                        </em>
                      </span>
                      <span className="wr-home__pct tabular-nums">
                        {item.intencaoJadyel.toLocaleString('pt-BR', {
                          maximumFractionDigits: 1,
                        })}
                        %
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
                  de{' '}
                  {pollsLoading || iptLoading ? '—' : municipiosComMeta.toLocaleString('pt-BR')}{' '}
                  municípios
                </span>
                <span className="wr-home__coverage-bar" aria-hidden>
                  <span
                    style={{
                      width: pollsLoading || iptLoading ? '0%' : `${coberturaPesquisasPct}%`,
                    }}
                  />
                </span>
              </p>
              <div className="wr-home__card-foot">
                <GoBtn href="/dashboard/gestao-pesquisas" label="Ver todas as pesquisas" />
              </div>
            </article>

            <article className="wr-home__card wr-home__card--list wr-home__card--redes-lg">
              <div className="wr-home__kicker-row">
                <p className="wr-home__kicker wr-home__kicker--with-icon">
                  <Instagram className="wr-home__kicker-icon" strokeWidth={2} aria-hidden />
                  Pulso Digital
                </p>
              </div>
              <p className="wr-home__metric-sm tabular-nums">
                {redesLoading ? '—' : redesHoje.posts.toLocaleString('pt-BR')}
                {!redesLoading ? (
                  <small>
                    {' '}
                    {redesHoje.posts === 1 ? 'postagem' : 'postagens'} hoje
                  </small>
                ) : null}
              </p>
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
                      return d.toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    })()
                    const caption = (post.caption ?? '')
                      .replace(/\s+/g, ' ')
                      .trim()
                      .slice(0, 72)
                    const captionText =
                      caption.length > 0
                        ? `${caption}${post.caption.length > 72 ? '…' : ''}`
                        : ''

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
                        <ul
                          className="wr-home__eng-ig wr-home__eng-ig--post"
                          aria-label="Engajamento"
                        >
                          {REDES_ENG_ITENS.map((item) => {
                            const Icon = item.Icon
                            const value = formatWarRoomNumber(post.metrics[item.id])
                            return (
                              <li key={item.id} title={item.label}>
                                <Icon
                                  className="wr-home__eng-ig-icon"
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                                <span className="tabular-nums">{value}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="wr-home__card-foot">
                <GoBtn href="/dashboard/conteudo/redes" label="Ver redes sociais" />
              </div>
            </article>

            <article className="wr-home__card wr-home__card--list">
              <p className="wr-home__kicker wr-home__kicker--with-icon">
                <Megaphone className="wr-home__kicker-icon" strokeWidth={2} aria-hidden />
                Mídia em Campo
              </p>
              <p className="wr-home__metric-sm tabular-nums">
                {radarLoading ? '—' : anunciosAtivos.toLocaleString('pt-BR')}
                {!radarLoading ? (
                  <small>
                    {' '}
                    {anunciosAtivos === 1 ? 'ativo' : 'ativos'}
                  </small>
                ) : null}
              </p>
              <p className="wr-home__delta">
                {anunciosSpend ? anunciosSpend : 'Jadyel Alencar'}
              </p>
              {radarLoading ? (
                <p className="wr-home__muted">Carregando anúncios…</p>
              ) : anunciosRecentes.length === 0 ? (
                <p className="wr-home__muted">Sem anúncios ativos no período.</p>
              ) : (
                <ul>
                  {anunciosRecentes.map((ad) => (
                    <li key={ad.id}>
                      <span>
                        <strong>{(ad.page_name ?? '').trim() || 'Página'}</strong>
                        <em>
                          {(ad.ad_body ?? '').replace(/\s+/g, ' ').trim().slice(0, 58) ||
                            'Sem texto do anúncio'}
                        </em>
                      </span>
                      <time className="tabular-nums">
                        {dataHoraCurta(ad.started_running_at || ad.created_at)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <div className="wr-home__card-foot">
                <GoBtn
                  href="/dashboard/noticias/monitoramento?tab=meta-ads"
                  label="Ver campanhas"
                />
              </div>
            </article>
          </div>
        </div>
      </div>

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
