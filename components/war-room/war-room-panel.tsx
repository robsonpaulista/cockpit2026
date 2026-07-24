'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  IconActivity,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconHeart,
  IconLoader2,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconSend,
  IconShare,
  IconBookmark,
  IconTags,
  IconUsersGroup,
  type Icon,
} from '@tabler/icons-react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { municipalityCardClass } from '@/lib/premium-ui-classes'
import {
  fetchInstagramData,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import { aggregateInstagramMetricsByCaptionCity } from '@/lib/instagram-city-caption-stats'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import {
  WAR_ROOM_AGENDA_MOCK,
  WAR_ROOM_CRM_ASSUNTOS,
  WAR_ROOM_CRM_FUNNEL,
  WAR_ROOM_DISPAROS,
  WAR_ROOM_MATERIAIS,
  WAR_ROOM_MOBILIZACAO_MOCK,
  type WarRoomAgendaItem,
} from '@/lib/war-room/mock-data'
import { formatWarRoomNumber, formatWarRoomPct } from '@/lib/war-room/format'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useSetDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { WarRoomBloco1 } from '@/components/war-room/war-room-bloco1'
import { WarRoomCidadeProvider } from '@/components/war-room/war-room-cidade-context'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomNoticiasCard } from '@/components/war-room/war-room-noticias-card'
import {
  WarRoomRefreshProvider,
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import {
  WarRoomPesquisasAndamentoCard,
  WarRoomPesquisasConsolidadasCard,
} from '@/components/war-room/war-room-pesquisas-cards'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/war-room/war-room-clean.css'

const WAR_ROOM_PAGE_SIZE = 4
const WAR_ROOM_TZ = 'America/Sao_Paulo'

function pageSlice<T>(items: T[], page: number, pageSize: number = WAR_ROOM_PAGE_SIZE): T[] {
  const start = page * pageSize
  return items.slice(start, start + pageSize)
}

function pageCount(total: number, pageSize: number = WAR_ROOM_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

function MiniPager({
  page,
  total,
  onChange,
}: {
  page: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = pageCount(total)
  const show = total > WAR_ROOM_PAGE_SIZE

  return (
    <div className="mt-2 flex h-7 items-center justify-end gap-1.5">
      {show ? (
        <>
          <button
            type="button"
            aria-label="Página anterior"
            disabled={page <= 0}
            onClick={() => onChange(page - 1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
          >
            <IconChevronLeft className="h-3.5 w-3.5" stroke={1.5} />
          </button>
          <span className="min-w-[2.5rem] text-center text-[11px] tabular-nums text-[#78716c]">
            {page + 1}/{pages}
          </span>
          <button
            type="button"
            aria-label="Próxima página"
            disabled={page >= pages - 1}
            onClick={() => onChange(page + 1)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#ebe8e4] text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:pointer-events-none disabled:opacity-35"
          >
            <IconChevronRight className="h-3.5 w-3.5" stroke={1.5} />
          </button>
        </>
      ) : null}
    </div>
  )
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

function formatTodayLabel(timeZone: string = WAR_ROOM_TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())
}

function formatPostTime(iso: string, timeZone: string = WAR_ROOM_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const sectionClass =
  'rounded-[18px] border border-[#ebe8e4] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)] md:p-4'

/** Card de célula do board 3×3 — mesma altura na linha. */
const cellClass = cn(sectionClass, 'flex h-full min-h-0 flex-col overflow-hidden')

/** Cards da 1ª linha: altura pelo conteúdo (Redes como referência), sem cortar. */
const cellLeadClass = cn(sectionClass, 'flex h-full flex-col overflow-visible')

/** Bloco 1 — coluna com 2 cards (Universo 70% + secundário 30%). */
const bloco1ColClass = 'wr-col-bloco1 min-h-[420px] lg:min-h-0'

/** Bloco 2 — pesquisas (Consolidadas 58% + andamento + reservado). */
const bloco2ColClass = 'wr-col-bloco2 min-h-[420px] lg:min-h-0'

/** Card Universo (70%). */
const bloco1UniversoClass = cn(sectionClass, 'wr-col-bloco1__universo flex flex-col')

/** Linha 1 = auto (cabe Redes); colunas 2–4 compactas. */
const boardClass =
  'wr-board mb-6 grid grid-cols-1 gap-4 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-3.5 lg:min-h-[calc(100vh-8.5rem)]'

type AgendaLiveStatus = 'concluido' | 'ao_vivo' | 'proximo'

function parseAgendaMinutes(horario: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(horario.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function nowMinutesInTz(timeZone: string = WAR_ROOM_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

function isAgendaMarkedDone(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return (
    normalized.includes('conclu') ||
    normalized === 'finalizada' ||
    normalized === 'finalizado' ||
    normalized === 'done'
  )
}

/** Status ao vivo: evento atual até o próximo começar; anteriores viram concluídos. */
function resolveAgendaLiveStatus(
  items: WarRoomAgendaItem[],
  nowMinutes: number,
): Map<string, AgendaLiveStatus> {
  const sorted = [...items].sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR'))
  const result = new Map<string, AgendaLiveStatus>()

  for (let index = 0; index < sorted.length; index += 1) {
    const item = sorted[index]
    if (isAgendaMarkedDone(item.status)) {
      result.set(item.id, 'concluido')
      continue
    }

    const start = parseAgendaMinutes(item.horario)
    const nextStart =
      index < sorted.length - 1 ? parseAgendaMinutes(sorted[index + 1].horario) : null

    if (start == null) {
      result.set(item.id, 'proximo')
      continue
    }

    const endsAt = nextStart ?? Number.POSITIVE_INFINITY
    if (nowMinutes >= endsAt) {
      result.set(item.id, 'concluido')
    } else if (nowMinutes >= start) {
      result.set(item.id, 'ao_vivo')
    } else {
      result.set(item.id, 'proximo')
    }
  }

  return result
}

function AgendaTimeline({
  items,
  nowMinutes,
}: {
  items: WarRoomAgendaItem[]
  nowMinutes: number
}) {
  const statuses = useMemo(
    () => resolveAgendaLiveStatus(items, nowMinutes),
    [items, nowMinutes],
  )
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR')),
    [items],
  )

  return (
    <ol className="wr-agenda-timeline" aria-label="Linha do tempo da agenda do dia">
      {sorted.map((item) => {
        const status = statuses.get(item.id) ?? 'proximo'
        return (
          <li
            key={item.id}
            className={cn(
              'wr-agenda-timeline__item',
              status === 'ao_vivo' && 'wr-agenda-timeline__item--live',
              status === 'concluido' && 'wr-agenda-timeline__item--done',
            )}
          >
            <div className="wr-agenda-timeline__rail" aria-hidden>
              <span className="wr-agenda-timeline__dot" />
            </div>
            <time className="wr-agenda-timeline__time" dateTime={item.horario}>
              {item.horario}
            </time>
            <div className="wr-agenda-timeline__body">
              <p className="wr-agenda-timeline__title">{item.titulo}</p>
              <p className="wr-agenda-timeline__meta">{item.municipio}</p>
            </div>
            {status === 'concluido' ? (
              <span className="wr-agenda-timeline__badge wr-agenda-timeline__badge--done">
                Concluído
              </span>
            ) : status === 'ao_vivo' ? (
              <span className="wr-agenda-timeline__badge wr-agenda-timeline__badge--live">
                Ao vivo
              </span>
            ) : (
              <span className="invisible h-5 w-0" aria-hidden>
                —
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function normalizeAgendaHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const trimmed = String(hora).trim()
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5)
  return trimmed
}

function mapCampoAgendaToWarRoom(
  row: {
    id?: string
    description?: string | null
    hora_evento?: string | null
    type?: string | null
    status?: string | null
    cities?: { name?: string | null } | null
  },
  index: number,
): WarRoomAgendaItem {
  return {
    id: String(row.id ?? `agenda-${index}`),
    titulo: (row.description || 'Compromisso sem descrição').trim(),
    horario: normalizeAgendaHora(row.hora_evento),
    municipio: (row.cities?.name || '—').trim(),
    tipo: String(row.type || 'outro'),
    status: String(row.status || 'planejada'),
  }
}

function SectionHead({
  title,
  href,
  linkLabel = 'Ver detalhes',
  icon: Icon,
  badge,
}: {
  title: string
  href: string
  linkLabel?: string
  icon: Icon
  badge?: ReactNode
}) {
  return (
    <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#57534e]">
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]"
          stroke={1.5}
          aria-hidden
        />
        <span className="truncate">{title}</span>
        {badge}
      </h2>
      <Link
        href={href}
        className="shrink-0 text-[12px] font-medium text-[rgb(var(--color-primary))] transition-opacity hover:opacity-80"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

function ShareBars({
  items,
  barClassName,
}: {
  items: Array<{ label: string; pct: number; valueLabel?: string }>
  barClassName: string
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate text-[#57534e]">{item.label}</span>
            <span className="tabular-nums text-[#1c1917]">
              {item.valueLabel ?? formatWarRoomPct(item.pct)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f1ec]">
            <div
              className={cn('h-full rounded-full', barClassName)}
              style={{ width: `${Math.min(100, Math.max(0, item.pct))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function getPostIdentifier(post: { id: string; postedAt?: string; caption?: string }): string {
  if (post.id) return post.id
  if (post.postedAt && post.caption) {
    const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
    const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return `${dateStr}_${captionHash}`
  }
  return `post_${Date.now()}`
}

type PostClassification = {
  theme?: string
  isBoosted?: boolean
}

function KpiTile({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: string
  icon: typeof IconEye
  loading?: boolean
}) {
  return (
    <div className={cn(municipalityCardClass, 'min-w-0 p-2 text-center')}>
      <div className="mb-1 flex items-center justify-center gap-0.5">
        <Icon className="h-3 w-3 shrink-0 text-[rgb(var(--color-primary))]" stroke={1.5} aria-hidden />
        <span className="truncate text-[9px] font-medium uppercase tracking-wide text-[#78716c]">
          {label}
        </span>
      </div>
      {loading ? (
        <IconLoader2 className="mx-auto h-4 w-4 animate-spin text-[#a8a29e]" stroke={1.5} />
      ) : (
        <p className="truncate text-[15px] font-semibold leading-none tabular-nums text-[#1c1917]">
          {value}
        </p>
      )}
    </div>
  )
}

export function WarRoomPanel() {
  return (
    <WarRoomCidadeProvider>
      <WarRoomRefreshProvider>
        <WarRoomPanelInner />
      </WarRoomRefreshProvider>
    </WarRoomCidadeProvider>
  )
}

function WarRoomPanelInner() {
  const topbarVisible = useDashboardTopbarVisible()
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [loadingIg, setLoadingIg] = useState(true)
  const [igError, setIgError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const [classifications, setClassifications] = useState<Record<string, PostClassification>>({})
  const [crmTemaPage, setCrmTemaPage] = useState(0)
  const [disparosPage, setDisparosPage] = useState(0)
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesInTz())
  const [agendaItems, setAgendaItems] = useState<WarRoomAgendaItem[]>(WAR_ROOM_AGENDA_MOCK)
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [agendaFromApi, setAgendaFromApi] = useState(false)

  const loadClassifications = async () => {
    try {
      const response = await fetch('/api/instagram/classifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        success?: boolean
        classifications?: Record<string, PostClassification>
      }
      if (data.success && data.classifications) {
        setClassifications(data.classifications)
        return
      }
    } catch {
      // fallback localStorage
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('instagram_post_classifications')
      if (saved) {
        try {
          setClassifications(JSON.parse(saved) as Record<string, PostClassification>)
        } catch {
          // ignore
        }
      }
    }
  }

  const { register, refreshAll, refreshing } = useWarRoomRefresh()
  const agendaChange = useWarRoomCardChange('agenda')
  const redesChange = useWarRoomCardChange('redes')

  const loadInstagram = useCallback(async (opts?: {
    silent?: boolean
    forceRefresh?: boolean
  }) => {
    const silent = opts?.silent === true
    const forceRefresh = opts?.forceRefresh === true
    if (!silent) {
      setLoadingIg(true)
      setIgError(null)
    }
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.token || !cfg.businessAccountId) {
        cfg = await loadInstagramConfigAsync()
      }
      if (!cfg.token || !cfg.businessAccountId) {
        setConfigured(false)
        if (!silent) {
          setMetrics(null)
          setIgError('Instagram Pessoal não configurado')
        }
        return
      }
      setConfigured(true)
      const data = await fetchInstagramData(
        cfg.token,
        cfg.businessAccountId,
        '1d',
        forceRefresh,
      )
      if (!data) {
        if (!silent) {
          setIgError('Não foi possível carregar o Instagram')
          setMetrics(null)
        }
        return
      }
      setMetrics(data)
      await loadClassifications()
    } catch (err) {
      if (!silent) {
        setIgError(err instanceof Error ? err.message : 'Erro ao carregar Instagram')
        setMetrics(null)
      }
    } finally {
      if (!silent) setLoadingIg(false)
    }
  }, [])

  const loadAgenda = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setAgendaLoading(true)
    try {
      const res = await fetch('/api/campo/agendas', { cache: 'no-store' })
      if (!res.ok) throw new Error('agenda')
      const data = (await res.json()) as Array<{
        id?: string
        date?: string
        description?: string | null
        hora_evento?: string | null
        type?: string | null
        status?: string | null
        cities?: { name?: string | null } | null
      }>
      const today = todayKeyInTz()
      const todays = (Array.isArray(data) ? data : [])
        .filter((row) => {
          if (!row.date) return false
          const dateKey = String(row.date).slice(0, 10)
          return dateKey === today
        })
        .map((row, index) => mapCampoAgendaToWarRoom(row, index))
        .sort((a, b) => a.horario.localeCompare(b.horario, 'pt-BR'))

      if (todays.length > 0) {
        setAgendaItems(todays)
        setAgendaFromApi(true)
      } else {
        setAgendaItems(WAR_ROOM_AGENDA_MOCK)
        setAgendaFromApi(false)
      }
    } catch {
      if (!silent) {
        setAgendaItems(WAR_ROOM_AGENDA_MOCK)
        setAgendaFromApi(false)
      }
    } finally {
      if (!silent) setAgendaLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    document.body.setAttribute('data-war-room-clean', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
      document.body.removeAttribute('data-war-room-clean')
    }
  }, [])

  useEffect(() => {
    void loadInstagram({ silent: false })
  }, [loadInstagram])

  useEffect(() => {
    void loadAgenda({ silent: false })
  }, [loadAgenda])

  useEffect(() => {
    return register('agenda', async ({ silent }) => {
      await loadAgenda({ silent })
    })
  }, [register, loadAgenda])

  useEffect(() => {
    return register('redes', async ({ silent }) => {
      await loadInstagram({ silent, forceRefresh: false })
    })
  }, [register, loadInstagram])

  useEffect(() => {
    const tick = () => setNowMinutes(nowMinutesInTz())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const todayPosts = useMemo(() => {
    const today = todayKeyInTz()
    return (metrics?.posts ?? []).filter((post) => calendarDateInTz(post.postedAt) === today)
  }, [metrics])

  const socialKpis = useMemo(() => {
    const posts = todayPosts
    const shares = posts.reduce((s, p) => s + (p.metrics.shares || 0), 0)
    const saves = posts.reduce((s, p) => s + (p.metrics.saves || 0), 0)
    const engagement = posts.reduce((s, p) => s + (p.metrics.engagement || 0), 0)
    const views = posts.reduce((s, p) => s + (p.metrics.views || 0), 0)
    return { views, engagement, shares, saves, postsCount: posts.length }
  }, [todayPosts])

  const topCities = useMemo(() => {
    const agg = aggregateInstagramMetricsByCaptionCity(todayPosts)
    const cities = agg.cities.slice(0, 5)
    const maxEngagement = Math.max(...cities.map((c) => c.engagement), 0)
    return cities.map((city) => ({
      label: city.municipio,
      engagement: city.engagement,
      pct: maxEngagement > 0 ? Math.round((city.engagement / maxEngagement) * 100) : 0,
      valueLabel: formatWarRoomNumber(city.engagement),
    }))
  }, [todayPosts])

  const todayThemePosts = useMemo(() => {
    return [...todayPosts]
      .map((post) => {
        const id = getPostIdentifier(post)
        const theme = classifications[id]?.theme?.trim() || 'Sem tema'
        const header = instagramCaptionHeader(post.caption) || 'Sem cabeçalho na legenda'
        return {
          id,
          header,
          theme,
          postedAt: post.postedAt,
          timeLabel: formatPostTime(post.postedAt),
          views: post.metrics.views || 0,
          engagement: post.metrics.engagement || 0,
          likes: post.metrics.likes || 0,
          comments: post.metrics.comments || 0,
        }
      })
      .sort((a, b) => b.engagement - a.engagement)
  }, [todayPosts, classifications])

  const themePerformance = useMemo(() => {
    const byTheme = new Map<string, number>()
    for (const post of todayThemePosts) {
      byTheme.set(post.theme, (byTheme.get(post.theme) || 0) + post.engagement)
    }
    const entries = [...byTheme.entries()]
    if (entries.length === 0) return []
    const maxEngagement = Math.max(...entries.map(([, eng]) => eng), 0)
    return entries
      .map(([label, engagement]) => ({
        label,
        engagement,
        pct: maxEngagement > 0 ? Math.round((engagement / maxEngagement) * 100) : 0,
        valueLabel: formatWarRoomNumber(engagement),
      }))
      .sort(
        (a, b) =>
          b.engagement - a.engagement || a.label.localeCompare(b.label, 'pt-BR'),
      )
  }, [todayThemePosts])

  const todayLabel = formatTodayLabel()

  const agendaSnapshotLines = useMemo(
    () =>
      agendaItems.map(
        (item) => `${item.id}\t${item.horario}\t${item.titulo}\t${item.municipio}`,
      ),
    [agendaItems],
  )

  useWarRoomSnapshot({
    cardId: 'agenda',
    lines: agendaSnapshotLines,
    noun: 'compromisso',
    ready: !agendaLoading,
  })

  const redesSnapshotLines = useMemo(() => {
    if (!metrics) return null
    const posts = (metrics.posts ?? []).map(
      (p) => `${p.id}\t${p.metrics.engagement}\t${p.metrics.views}`,
    )
    return [
      `kpis\t${socialKpis.views}\t${socialKpis.engagement}\t${socialKpis.shares}\t${socialKpis.saves}`,
      ...posts,
    ]
  }, [metrics, socialKpis])

  useWarRoomSnapshot({
    cardId: 'redes',
    lines: redesSnapshotLines,
    noun: 'indicador',
    ready: !loadingIg || metrics != null,
  })

  const descriptionText = `Monitoramento do dia (${todayLabel}) · Instagram real · mobilização e materiais em mock`

  const topbarExtras = useMemo(() => {
    if (!topbarVisible) return null
    return {
      hidePageTitle: true,
      description: (
        <span className="inline-flex min-w-0 max-w-full items-baseline gap-2">
          <span className="shrink-0 text-[15px] font-bold uppercase tracking-[0.08em] text-[var(--wr-orange,#f6a700)] sm:text-base">
            War Room
          </span>
          <span className="min-w-0 truncate text-[12px] text-[#78716c]" title={descriptionText}>
            {descriptionText}
          </span>
        </span>
      ),
      actions: (
        <button
          type="button"
          onClick={() => void refreshAll({ silent: false })}
          disabled={refreshing || loadingIg}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#ebe8e4] bg-white px-3 py-1.5 text-[13px] font-medium text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:opacity-50"
        >
          <IconRefresh
            className={cn('h-4 w-4', (refreshing || loadingIg) && 'animate-spin')}
            stroke={1.5}
          />
          Atualizar
        </button>
      ),
    }
  }, [topbarVisible, descriptionText, refreshing, loadingIg, refreshAll])

  useSetDashboardTopbarExtras(topbarExtras)

  const refreshButton = (
    <button
      type="button"
      onClick={() => void refreshAll({ silent: false })}
      disabled={refreshing || loadingIg}
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#ebe8e4] bg-white px-3 py-1.5 text-[13px] font-medium text-[#57534e] transition-colors hover:bg-[#f6f5f2] disabled:opacity-50"
    >
      <IconRefresh
        className={cn('h-4 w-4', (refreshing || loadingIg) && 'animate-spin')}
        stroke={1.5}
      />
      Atualizar
    </button>
  )

  const crmTemasPageItems = useMemo(
    () => pageSlice(WAR_ROOM_CRM_ASSUNTOS, crmTemaPage),
    [crmTemaPage],
  )
  const disparosPageItems = useMemo(
    () => pageSlice(WAR_ROOM_DISPAROS, disparosPage),
    [disparosPage],
  )

  useEffect(() => {
    const maxCrm = pageCount(WAR_ROOM_CRM_ASSUNTOS.length) - 1
    if (crmTemaPage > maxCrm) setCrmTemaPage(Math.max(0, maxCrm))
  }, [crmTemaPage])

  useEffect(() => {
    const maxDisp = pageCount(WAR_ROOM_DISPAROS.length) - 1
    if (disparosPage > maxDisp) setDisparosPage(Math.max(0, maxDisp))
  }, [disparosPage])

  const mobilizacao = WAR_ROOM_MOBILIZACAO_MOCK

  const funnel: Array<{ key: string; label: string; value: number; accent?: boolean }> = [
    { key: 'entradas', label: 'Entradas', value: WAR_ROOM_CRM_FUNNEL.entradas, accent: true },
    { key: 'respondidas', label: 'Respondidas', value: WAR_ROOM_CRM_FUNNEL.respondidas },
    { key: 'pendentes', label: 'Pendentes', value: WAR_ROOM_CRM_FUNNEL.pendentes },
    { key: 'resolvidas', label: 'Resolvidas', value: WAR_ROOM_CRM_FUNNEL.resolvidas },
  ]

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? null : (
          <DashboardPageHeader
            title="WAR ROOM"
            description={<span className={typographyPageLeadClass}>{descriptionText}</span>}
            action={refreshButton}
          />
        )}
      </DashboardPageChrome>

      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        <div className={boardClass}>
          {/* Bloco 1 — Expectativa (70%) + Evolução (30%) */}
          <WarRoomBloco1
            colClassName={bloco1ColClass}
            universoClassName={bloco1UniversoClass}
            resumoClassName="wr-col-bloco1__secundario"
          />

          {/* Bloco 2 — Consolidadas + andamento + notícias */}
          <div className={bloco2ColClass}>
            <WarRoomPesquisasConsolidadasCard className="wr-col-bloco2__consolidadas" />
            <WarRoomPesquisasAndamentoCard className="wr-col-bloco2__andamento" />
            <WarRoomNoticiasCard className="wr-col-bloco2__reservado" />
          </div>

          {/* Linha 1 — agenda */}
          <section className={cellLeadClass} aria-label="Agenda do dia">
              <SectionHead
                title="Agenda do dia"
                href="/dashboard/agenda"
                linkLabel="Ver agenda completa"
                icon={IconCalendarEvent}
                badge={<WarRoomChangeBadge change={agendaChange} />}
              />
              <div className="flex min-h-0 flex-1 flex-col">
              {agendaLoading ? (
                <div className="flex flex-1 items-center justify-center py-6">
                  <IconLoader2 className="h-5 w-5 animate-spin text-[#a8a29e]" stroke={1.5} />
                </div>
              ) : agendaItems.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-[#78716c]">
                  Nenhum compromisso para hoje.
                </p>
              ) : (
                <>
                  {!agendaFromApi ? (
                    <p className="mb-2 shrink-0 text-[11px] text-[#a8a29e]">
                      Sem compromissos na API para hoje · exibindo mock
                    </p>
                  ) : null}
                  <div className="min-h-0 flex-1">
                    <AgendaTimeline items={agendaItems} nowMinutes={nowMinutes} />
                  </div>
                </>
              )}
              </div>
            </section>

          {/* Linha 1 col 3 — redes */}
          <section className={cellLeadClass} aria-label="Redes sociais">
          <SectionHead
            title="Redes sociais"
            href="/dashboard/conteudo/redes"
            icon={IconBrandInstagram}
            badge={<WarRoomChangeBadge change={redesChange} />}
          />

          <div className="flex flex-1 flex-col">

          {!configured && !loadingIg ? (
            <p className="mb-3 rounded-xl border border-[#ebe8e4] bg-[#f6f5f2] px-3 py-2 text-[12px] text-[#78716c]">
              Configure o Instagram Pessoal para ver visualizações, engajamento e top cidades.{' '}
              <Link href="/dashboard/conteudo/redes" className="font-medium text-[rgb(var(--color-primary))]">
                Abrir Instagram Pessoal
              </Link>
            </p>
          ) : null}
          {igError && configured ? (
            <p className="mb-3 text-[12px] text-[#dc2626]">{igError}</p>
          ) : null}
          {!loadingIg && configured && socialKpis.postsCount === 0 ? (
            <p className="mb-3 text-[12px] text-[#78716c]">
              Nenhuma publicação de hoje ainda.
            </p>
          ) : null}

          {!loadingIg && todayThemePosts.length > 0 ? (
            <div className="mb-3 divide-y divide-[#f0eeea] border-y border-[#f0eeea]">
              {todayThemePosts.map((post) => (
                <div key={post.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-snug text-[#1c1917]">
                      {post.header}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[rgb(var(--color-primary))]">
                      {post.theme}
                      {post.timeLabel ? (
                        <span className="text-[#a8a29e]"> · {post.timeLabel}</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] tabular-nums leading-tight text-[#78716c]">
                    <p>{formatWarRoomNumber(post.views)} views</p>
                    <p>{formatWarRoomNumber(post.engagement)} eng.</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mb-3 grid grid-cols-4 gap-2">
            <KpiTile
              label="Visualizações"
              value={formatWarRoomNumber(socialKpis.views)}
              icon={IconEye}
              loading={loadingIg}
            />
            <KpiTile
              label="Engajamento"
              value={formatWarRoomNumber(socialKpis.engagement)}
              icon={IconHeart}
              loading={loadingIg}
            />
            <KpiTile
              label="Compartilhamentos"
              value={formatWarRoomNumber(socialKpis.shares)}
              icon={IconShare}
              loading={loadingIg}
            />
            <KpiTile
              label="Salvamentos"
              value={formatWarRoomNumber(socialKpis.saves)}
              icon={IconBookmark}
              loading={loadingIg}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn(municipalityCardClass, 'p-3')}>
              <div className="mb-2.5 flex items-center gap-1.5">
                <IconMapPin className="h-3.5 w-3.5 text-[rgb(var(--color-primary))]" stroke={1.5} />
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#78716c]">
                  Top cidades (eng.)
                </h3>
              </div>
              {loadingIg ? (
                <div className="flex justify-center py-6">
                  <IconLoader2 className="h-5 w-5 animate-spin text-[#a8a29e]" stroke={1.5} />
                </div>
              ) : topCities.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[#78716c]">
                  Sem cidade nas legendas de hoje.
                </p>
              ) : (
                <ShareBars
                  items={topCities.map(({ label, pct, valueLabel }) => ({
                    label,
                    pct,
                    valueLabel,
                  }))}
                  barClassName="bg-[rgb(var(--color-primary))]"
                />
              )}
            </div>

            <div className={cn(municipalityCardClass, 'p-3')}>
              <div className="mb-2.5 flex items-center gap-1.5">
                <IconTags className="h-3.5 w-3.5 text-[rgb(var(--color-primary))]" stroke={1.5} />
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#78716c]">
                  Por tema (eng.)
                </h3>
              </div>
              {loadingIg ? (
                <div className="flex justify-center py-6">
                  <IconLoader2 className="h-5 w-5 animate-spin text-[#a8a29e]" stroke={1.5} />
                </div>
              ) : themePerformance.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-[#78716c]">
                  Sem temas de hoje.
                </p>
              ) : (
                <ShareBars
                  items={themePerformance.map(({ label, pct, valueLabel }) => ({
                    label,
                    pct,
                    valueLabel,
                  }))}
                  barClassName="bg-[rgb(var(--color-primary))]"
                />
              )}
            </div>
          </div>
          </div>
          </section>

          {/* Linha 2 — mobilização */}
          <section className={cellClass} aria-label="Mobilização">
              <SectionHead
                title="Mobilização do evento atual"
                href="/dashboard/mobilizacao"
                icon={IconUsersGroup}
              />
              <div className="mb-3 shrink-0 rounded-xl border border-[#ebe8e4] bg-[#faf9f7] px-3 py-2.5">
                <p className="truncate text-[12px] font-medium text-[#1c1917]">
                  {mobilizacao.eventoTitulo}
                </p>
                <p className="mt-0.5 text-[11px] text-[#78716c]">
                  {mobilizacao.eventoHorario}
                  {' · '}
                  {mobilizacao.eventoMunicipio}
                  <span className="text-[#a8a29e]"> · mock</span>
                </p>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-[#f0eeea] overflow-y-auto border-t border-[#f0eeea]">
                {mobilizacao.metricas.map((m) => {
                  const pct =
                    m.meta && m.meta > 0 ? Math.min(100, Math.round((m.value / m.meta) * 100)) : 0
                  return (
                    <div key={m.label} className="py-2">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-medium text-[#1c1917]">{m.label}</span>
                        <span className="tabular-nums text-[#78716c]">
                          {formatWarRoomNumber(m.value)}
                          {m.meta ? (
                            <span className="text-[#a8a29e]"> / {formatWarRoomNumber(m.meta)}</span>
                          ) : null}
                        </span>
                      </div>
                      {m.meta ? (
                        <div className="h-1 overflow-hidden rounded-full bg-[#f3f1ec]">
                          <div
                            className="h-full rounded-full bg-[rgb(var(--color-primary))]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
          </section>

          {/* Linha 2 — CRM */}
          <section className={cellClass}>
          <SectionHead
            title="CRM & WhatsApp • Hoje"
            href="/dashboard/whatsapp"
            icon={IconBrandWhatsapp}
          />

          <div className="wr-funnel wr-funnel--vivid mb-3" role="list" aria-label="Funil CRM do dia">
            {funnel.map((step) => (
              <div
                key={step.key}
                role="listitem"
                className={cn('wr-funnel__step', step.accent && 'wr-funnel__step--accent')}
              >
                <p className="wr-funnel__label">{step.label}</p>
                <p className="wr-funnel__value">{formatWarRoomNumber(step.value)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-[#f0eeea]">
            <div className="divide-y divide-[#f0eeea]">
              {Array.from({ length: WAR_ROOM_PAGE_SIZE }, (_, index) => {
                const tema = crmTemasPageItems[index]
                return (
                  <div
                    key={tema?.label ?? `crm-slot-${index}`}
                    className="flex h-7 items-center justify-between gap-3 text-[12px]"
                  >
                    {tema ? (
                      <>
                        <span className="min-w-0 truncate font-medium text-[#1c1917]">
                          {tema.label}
                        </span>
                        <span className="shrink-0 tabular-nums text-[#78716c]">
                          {formatWarRoomPct(tema.pct)}
                        </span>
                      </>
                    ) : (
                      <span className="invisible">—</span>
                    )}
                  </div>
                )
              })}
            </div>
            <MiniPager
              page={crmTemaPage}
              total={WAR_ROOM_CRM_ASSUNTOS.length}
              onChange={setCrmTemaPage}
            />
          </div>
        </section>

          {/* Linha 3 — materiais */}
          <section className={cellClass} aria-label="Materiais">
              <SectionHead
                title="Materiais de campanha"
                href="/dashboard/material-campanha"
                linkLabel="Ver todos"
                icon={IconPackage}
              />
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[320px] text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#ebe8e4] text-[10px] uppercase tracking-wide text-[#a8a29e]">
                      <th className="pb-1.5 pr-2 font-medium">Item</th>
                      <th className="pb-1.5 pr-2 text-right font-medium">Disp.</th>
                      <th className="pb-1.5 pr-2 text-right font-medium">Trânsito</th>
                      <th className="pb-1.5 text-right font-medium">Solic.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WAR_ROOM_MATERIAIS.map((row) => (
                      <tr key={row.item} className="border-b border-[#f3f1ec] last:border-0">
                        <td className="h-8 py-0 pr-2 font-medium text-[#1c1917]">{row.item}</td>
                        <td className="h-8 py-0 pr-2 text-right tabular-nums text-[#1c1917]">
                          {row.disponivel.toLocaleString('pt-BR')}
                        </td>
                        <td className="h-8 py-0 pr-2 text-right tabular-nums text-[#78716c]">
                          {row.emTransito.toLocaleString('pt-BR')}
                        </td>
                        <td className="h-8 py-0 text-right tabular-nums text-[#78716c]">
                          {row.solicitado.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          {/* Linha 3 col 3 — disparos */}
          <section className={cellClass}>
          <SectionHead
            title="Disparos recentes"
            href="/dashboard/whatsapp"
            linkLabel="Ver todos"
            icon={IconSend}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-[#ebe8e4] text-[10px] uppercase tracking-wide text-[#a8a29e]">
                  <th className="pb-1.5 pr-2 font-medium">Campanha</th>
                  <th className="pb-1.5 pr-2 font-medium">Público</th>
                  <th className="pb-1.5 pr-2 text-right font-medium">Env.</th>
                  <th className="pb-1.5 text-right font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: WAR_ROOM_PAGE_SIZE }, (_, index) => {
                  const row = disparosPageItems[index]
                  return (
                    <tr
                      key={row?.campanha ?? `disp-slot-${index}`}
                      className="border-b border-[#f3f1ec] last:border-0"
                    >
                      <td className="h-8 py-0 pr-2 font-medium text-[#1c1917]">
                        {row?.campanha ?? ''}
                      </td>
                      <td className="h-8 py-0 pr-2 text-[#78716c]">{row?.publico ?? ''}</td>
                      <td className="h-8 py-0 pr-2 text-right tabular-nums text-[#1c1917]">
                        {row ? row.enviados.toLocaleString('pt-BR') : ''}
                      </td>
                      <td className="h-8 py-0 text-right tabular-nums font-medium text-[var(--wr-blue)]">
                        {row ? formatWarRoomPct(row.clicksPct) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <MiniPager
            page={disparosPage}
            total={WAR_ROOM_DISPAROS.length}
            onChange={setDisparosPage}
          />
        </section>
        </div>

        <p className="mb-4 flex items-center gap-1.5 text-[11px] text-[#a8a29e]">
          <IconActivity className="h-3.5 w-3.5" stroke={1.5} />
          War Room · Cockpit 2026
        </p>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
