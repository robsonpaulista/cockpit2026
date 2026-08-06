'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  IconActivity,
  IconRefresh,
  IconRobot,
  IconBell,
} from '@tabler/icons-react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import {
  WAR_ROOM_CRM_FUNNEL,
  type WarRoomAgendaItem,
} from '@/lib/war-room/mock-data'
import {
  formatAgendaTimePt,
  getCalendarEventDate,
  type CalendarEventRow,
} from '@/lib/agenda/calendar-event-utils'
import { parseEventOriginFromSummary } from '@/lib/agenda/event-present'
import { resolveCrmCardStatus } from '@/lib/war-room/card-status'
import { useSetDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { WarRoomExpectativaCard } from '@/components/war-room/war-room-bloco1'
import { WarRoomOpsBar } from '@/components/war-room/war-room-ops-bar'
import { WarRoomTopbarCountdown } from '@/components/war-room/war-room-topbar-countdown'
import { WarRoomCidadeProvider } from '@/components/war-room/war-room-cidade-context'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomNoticiasCard } from '@/components/war-room/war-room-noticias-card'
import {
  WarRoomRefreshProvider,
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import {
  WarRoomViewModeProvider,
  useWarRoomViewMode,
} from '@/components/war-room/war-room-view-mode-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import {
  WarRoomPesquisasConsolidadasCard,
} from '@/components/war-room/war-room-pesquisas-cards'
import { WarRoomDecisoesCard } from '@/components/war-room/war-room-decisoes-card'
import { WarRoomAgendaCard, parseAgendaMinutes } from '@/components/war-room/war-room-agenda-card'
import { WarRoomCrmCard } from '@/components/war-room/war-room-crm-card'
import { WarRoomDisparosCard } from '@/components/war-room/war-room-disparos-card'
// Oculto por hora: WarRoomFeedCard (Linha viva)
import { WarRoomRedesCard } from '@/components/war-room/war-room-redes-card'
import { WarRoomInstagramRadarCard } from '@/components/war-room/war-room-instagram-radar-card'
import { WarRoomVisitasCidadeCard } from '@/components/war-room/war-room-visitas-cidade-card'
import { WarRoomCopilotoView } from '@/components/war-room/war-room-copiloto-view'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/war-room/war-room-clean.css'

const WAR_ROOM_TZ = 'America/Sao_Paulo'

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

const boardClass = 'wr-board'

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

function normalizeAgendaHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const trimmed = String(hora).trim()
  if (/^\d{2}:\d{2}/.test(trimmed)) return trimmed.slice(0, 5)
  return trimmed
}

function mapGoogleEventToWarRoom(
  event: CalendarEventRow,
  index: number,
  attended = false,
): WarRoomAgendaItem {
  const { origin, title } = parseEventOriginFromSummary(event.summary || '')
  const municipio = (event.location?.trim() || origin || '—').trim()
  return {
    id: event.id || `agenda-${index}`,
    titulo: title,
    horario: normalizeAgendaHora(formatAgendaTimePt(event)),
    municipio,
    tipo: 'google-calendar',
    status: attended ? 'concluido' : 'planejada',
  }
}

export function WarRoomPanel() {
  return (
    <WarRoomCidadeProvider>
      <WarRoomRefreshProvider>
        <WarRoomViewModeProvider>
          <WarRoomPanelInner />
        </WarRoomViewModeProvider>
      </WarRoomRefreshProvider>
    </WarRoomCidadeProvider>
  )
}

function WarRoomPanelInner() {
  const [nowMinutes, setNowMinutes] = useState(() => nowMinutesInTz())
  const [agendaItems, setAgendaItems] = useState<WarRoomAgendaItem[]>([])
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)

  const { register, refreshAll, refreshing, lastRefreshAt } = useWarRoomRefresh()
  const { isDesempenho, isCopiloto, toggleDesempenho, toggleCopiloto } =
    useWarRoomViewMode()
  const agendaChange = useWarRoomCardChange('agenda')

  const loadAgenda = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setAgendaLoading(true)
      setAgendaError(null)
    }
    try {
      // Mesma fonte da página /dashboard/agenda (config salva do Google Calendar).
      const res = await fetch('/api/agenda/events', { cache: 'no-store' })
      const data = (await res.json()) as {
        error?: string
        events?: CalendarEventRow[]
      }
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar agenda')

      const today = todayKeyInTz()
      const todaysEvents = (data.events ?? []).filter((event) => {
        if (event.status === 'cancelled') return false
        const date = getCalendarEventDate(event)
        if (!date) return false
        return calendarDateInTz(date) === today
      })

      const attendanceById: Record<string, boolean> = {}
      await Promise.all(
        todaysEvents.map(async (event) => {
          if (!event.id) return
          try {
            const attRes = await fetch(`/api/agenda/attendance?eventId=${event.id}`, {
              cache: 'no-store',
            })
            if (!attRes.ok) return
            const attJson = (await attRes.json()) as {
              attendance?: { attended?: boolean } | null
            }
            attendanceById[event.id] = Boolean(attJson.attendance?.attended)
          } catch {
            // Attendance é opcional — a timeline ainda resolve por horário.
          }
        }),
      )

      const mapped = todaysEvents
        .map((event, index) =>
          mapGoogleEventToWarRoom(event, index, attendanceById[event.id || ''] === true),
        )
        .sort((a, b) => {
          const am = parseAgendaMinutes(a.horario)
          const bm = parseAgendaMinutes(b.horario)
          if (am == null && bm == null) return a.titulo.localeCompare(b.titulo, 'pt-BR')
          if (am == null) return -1
          if (bm == null) return 1
          return am - bm
        })

      setAgendaItems(mapped)
      setAgendaError(null)
    } catch (e) {
      if (!silent) {
        setAgendaItems([])
        setAgendaError(e instanceof Error ? e.message : 'Erro ao carregar agenda')
      }
    } finally {
      if (!silent) setAgendaLoading(false)
    }
  }, [])

  useEffect(() => {
    document.body.setAttribute('data-war-room-clean', '')
    return () => {
      document.body.removeAttribute('data-war-room-clean')
      document.body.removeAttribute('data-wr-copiloto')
    }
  }, [])

  useEffect(() => {
    if (isCopiloto) {
      document.body.setAttribute('data-wr-copiloto', '')
    } else {
      document.body.removeAttribute('data-wr-copiloto')
    }
  }, [isCopiloto])

  useEffect(() => {
    void loadAgenda({ silent: false })
  }, [loadAgenda])

  useEffect(() => {
    return register('agenda', async ({ silent }) => {
      await loadAgenda({ silent })
    })
  }, [register, loadAgenda])

  useEffect(() => {
    const tick = () => setNowMinutes(nowMinutesInTz())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

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

  const [decisoesTotal, setDecisoesTotal] = useState(0)
  const notificationCount = decisoesTotal

  const refreshButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => void refreshAll({ silent: false })}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--wr-border)] bg-[var(--wr-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--wr-muted)] transition-colors hover:bg-[var(--wr-page-bg)] disabled:opacity-50"
      >
        <IconRefresh
          className={cn('h-4 w-4', refreshing && 'animate-spin')}
          stroke={1.5}
        />
        Atualizar
      </button>
    ),
    [refreshAll, refreshing],
  )

  const topbarExtras = useMemo(() => {
    return {
      description: <WarRoomTopbarCountdown />,
      actions: (
        <>
          <button
            type="button"
            className={cn(
              'wr-topbar-clean__copiloto',
              isCopiloto && 'wr-topbar-clean__copiloto--active',
            )}
            aria-pressed={isCopiloto}
            onClick={toggleCopiloto}
          >
            <IconRobot className="h-4 w-4 shrink-0" stroke={1.75} aria-hidden />
            {isCopiloto ? 'Sair do Copiloto' : 'Acionar Copiloto'}
          </button>
          <button
            type="button"
            className="wr-topbar-clean__bell"
            aria-label={`${notificationCount} notificações`}
            onClick={() => {
              if (isCopiloto) {
                toggleCopiloto()
                window.setTimeout(() => {
                  document.getElementById('wr-decisoes')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }, 50)
                return
              }
              document.getElementById('wr-decisoes')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }}
          >
            <IconBell className="h-[18px] w-[18px]" stroke={1.75} aria-hidden />
            {notificationCount > 0 ? (
              <span className="wr-topbar-clean__bell-badge">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            ) : null}
          </button>
          {refreshButton}
        </>
      ),
    }
  }, [
    notificationCount,
    refreshButton,
    isCopiloto,
    toggleCopiloto,
  ])

  useSetDashboardTopbarExtras(topbarExtras)

  const crmPendentes = WAR_ROOM_CRM_FUNNEL.pendentes
  const crmStatus = resolveCrmCardStatus(crmPendentes)
  const alertCount = crmStatus === 'critico' ? 1 : 0

  return (
    <DashboardPageShell>
      <DashboardPageChrome>{null}</DashboardPageChrome>

      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        <div className={cn('wr-page-canvas', isCopiloto && 'wr-page-canvas--copiloto')}>
          {isCopiloto ? (
            <WarRoomCopilotoView />
          ) : (
            <>
              <WarRoomOpsBar
                alertCount={alertCount}
                lastRefreshAt={lastRefreshAt}
                desempenhoActive={isDesempenho}
                onToggleDesempenho={toggleDesempenho}
              />

              <div className="wr-layout">
                <aside className="wr-col wr-col--lead" aria-label="Agenda e expectativa">
                  <WarRoomAgendaCard
                    items={agendaItems}
                    nowMinutes={nowMinutes}
                    loading={agendaLoading}
                    error={agendaError}
                    badge={<WarRoomChangeBadge change={agendaChange} />}
                  />
                  <WarRoomExpectativaCard />
                  <WarRoomVisitasCidadeCard />
                </aside>

                <div className={cn('wr-col wr-col--board', boardClass)} aria-label="Painel operacional">
                  <div className="wr-board-stack wr-cell--pesquisas-noticias">
                    <WarRoomPesquisasConsolidadasCard />
                    <WarRoomNoticiasCard />
                  </div>

                  <div className="wr-board-stack wr-cell--redes">
                    <WarRoomRedesCard />
                    <WarRoomInstagramRadarCard />
                  </div>

                  <div className="wr-board-stack wr-cell--crm-evolucao">
                    <WarRoomDisparosCard />
                    <WarRoomCrmCard />
                    {/* Ocultos por enquanto: Evolução no IPT, Mobilização, Materiais */}
                  </div>

                  <div className="wr-board-stack wr-cell--prioridades" aria-label="Fila de decisões">
                    <WarRoomDecisoesCard onTotalChange={setDecisoesTotal} />
                    {/* Oculto por hora: <WarRoomFeedCard /> (Linha viva) */}
                  </div>
                </div>
              </div>

              <p className="mb-4 flex items-center gap-1.5 text-[11px] text-[var(--wr-muted)]">
                <IconActivity className="h-3.5 w-3.5" stroke={1.5} />
                War Room · Cockpit 2026
              </p>
            </>
          )}
        </div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
