'use client'

import { Bot, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { type WarRoomAgendaItem } from '@/lib/war-room/mock-data'
import { type CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { useSetDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { WarRoomCidadeProvider } from '@/components/war-room/war-room-cidade-context'
import {
  WarRoomRefreshProvider,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import {
  WarRoomViewModeProvider,
  useWarRoomViewMode,
} from '@/components/war-room/war-room-view-mode-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { parseAgendaMinutes } from '@/components/war-room/war-room-agenda-card'
import { WarRoomCopilotoView } from '@/components/war-room/war-room-copiloto-view'
import { WarRoomHomeView } from '@/components/war-room/war-room-home-view'
import { listAgendaDoDia, mapAgendaDoDiaItem } from '@/lib/war-room/agenda-proximos'
import {
  fetchCalendarAttendances,
  mergeAgendaAttendance,
} from '@/lib/agenda/fetch-calendar-attendance'
import { proximaAtualizacaoConfirmadosAgenda } from '@/lib/war-room/agenda-arrivals-refresh'

const WAR_ROOM_CONFIRMADOS_SCOPE = { scope: 'global' as const }
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'
import '@/app/dashboard/war-room/war-room-home.css'

function mapGoogleEventToWarRoom(
  event: CalendarEventRow,
  index: number,
  attendance?: { attended?: boolean | null; arrivalTime?: string | null },
): WarRoomAgendaItem {
  const attended = attendance?.attended === true
  return {
    ...mapAgendaDoDiaItem(event, index),
    tipo: 'google-calendar',
    status: attended ? 'concluido' : 'planejada',
    attended: attendance?.attended ?? null,
    arrivalTime: attendance?.arrivalTime ?? null,
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
  const [agendaItems, setAgendaItems] = useState<WarRoomAgendaItem[]>([])
  const [agendaLoading, setAgendaLoading] = useState(true)
  const [agendaError, setAgendaError] = useState<string | null>(null)
  const [confirmadosProximaSyncEm, setConfirmadosProximaSyncEm] = useState<number | null>(
    null,
  )
  const agendaItemsRef = useRef(agendaItems)
  agendaItemsRef.current = agendaItems
  const arrivalsInFlight = useRef(false)

  const bumpConfirmadosSyncSchedule = useCallback(() => {
    setConfirmadosProximaSyncEm(proximaAtualizacaoConfirmadosAgenda())
  }, [])

  const { register, refreshAll, refreshing } = useWarRoomRefresh()
  const { isCopiloto, toggleCopiloto } = useWarRoomViewMode()

  const refreshArrivals = useCallback(async () => {
    const current = agendaItemsRef.current
    const ids = current.map((item) => item.id).filter(Boolean)
    if (ids.length === 0 || arrivalsInFlight.current) {
      bumpConfirmadosSyncSchedule()
      return
    }
    arrivalsInFlight.current = true
    try {
      const attendanceById = await fetchCalendarAttendances(ids, WAR_ROOM_CONFIRMADOS_SCOPE)
      setAgendaItems((prev) => mergeAgendaAttendance(prev, attendanceById))
    } finally {
      arrivalsInFlight.current = false
      bumpConfirmadosSyncSchedule()
    }
  }, [bumpConfirmadosSyncSchedule])

  const loadAgenda = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (silent) {
      await refreshArrivals()
      return
    }
    setAgendaLoading(true)
    setAgendaError(null)
    try {
      const res = await fetch('/api/agenda/events', { cache: 'no-store' })
      const data = (await res.json()) as {
        error?: string
        events?: CalendarEventRow[]
      }
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar agenda')

      const todaysEvents = listAgendaDoDia(data.events ?? [])
      const attendanceById = await fetchCalendarAttendances(
        todaysEvents.map((event) => event.id).filter(Boolean),
        WAR_ROOM_CONFIRMADOS_SCOPE,
      )

      const mapped = todaysEvents
        .map((event, index) => {
          const att = event.id ? attendanceById[event.id] : undefined
          return mapGoogleEventToWarRoom(event, index, {
            attended: att?.attended ?? null,
            arrivalTime: att?.arrival_time ?? null,
          })
        })
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
      bumpConfirmadosSyncSchedule()
    } catch (e) {
      setAgendaItems([])
      setAgendaError(e instanceof Error ? e.message : 'Erro ao carregar agenda')
    } finally {
      setAgendaLoading(false)
    }
  }, [refreshArrivals, bumpConfirmadosSyncSchedule])

  useEffect(() => {
    document.body.setAttribute('data-war-room-clean', '')
    return () => {
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
    if (confirmadosProximaSyncEm == null) return

    const ms = confirmadosProximaSyncEm - Date.now()
    if (ms <= 0) {
      if (document.visibilityState !== 'hidden') void refreshArrivals()
      return
    }

    const id = window.setTimeout(() => {
      if (document.visibilityState !== 'hidden') void refreshArrivals()
    }, ms)
    return () => window.clearTimeout(id)
  }, [confirmadosProximaSyncEm, refreshArrivals])

  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === 'visible' &&
        confirmadosProximaSyncEm != null &&
        Date.now() >= confirmadosProximaSyncEm
      ) {
        void refreshArrivals()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [confirmadosProximaSyncEm, refreshArrivals])

  useEffect(() => {
    return register('agenda', async ({ silent }) => {
      await loadAgenda({ silent })
    })
  }, [register, loadAgenda])

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

  const refreshButton = useMemo(
    () => (
      <button
        type="button"
        onClick={() => void refreshAll({ silent: false })}
        disabled={refreshing}
        className="wr-topbar-clean__refresh inline-flex items-center gap-1.5 rounded-[10px] border border-[#2b2d31] bg-white px-3 py-1.5 text-[13px] font-medium text-[#2b2d31] transition-colors hover:border-[#f2d06b] hover:bg-[#f2d06b] disabled:opacity-50"
      >
        <RefreshCw
          className={cn('wr-icon', refreshing && 'animate-spin')}
          strokeWidth={1.5}
        />
        Atualizar
      </button>
    ),
    [refreshAll, refreshing],
  )

  const topbarExtras = useMemo(() => {
    return {
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
            <Bot className="wr-icon shrink-0" strokeWidth={1.5} aria-hidden />
            {isCopiloto ? 'Sair do Copiloto' : 'Acionar Copiloto'}
          </button>
          {refreshButton}
        </>
      ),
    }
  }, [refreshButton, isCopiloto, toggleCopiloto])

  useSetDashboardTopbarExtras(topbarExtras)

  return (
    <DashboardPageShell>
      <DashboardPageChrome>{null}</DashboardPageChrome>

      <DashboardPageContent
        className={cn(
          typographyContentRootClass,
          'pt-2 md:pt-3',
          !isCopiloto && 'overflow-hidden',
        )}
      >
        <div
          className={cn(
            'wr-page-canvas',
            isCopiloto ? 'wr-page-canvas--copiloto' : 'wr-page-canvas--scroll min-h-0 flex-1',
          )}
        >
          {isCopiloto ? (
            <WarRoomCopilotoView />
          ) : (
            <WarRoomHomeView
              agendaItems={agendaItems}
              agendaLoading={agendaLoading}
              confirmadosProximaSyncEm={confirmadosProximaSyncEm}
            />
          )}
        </div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
