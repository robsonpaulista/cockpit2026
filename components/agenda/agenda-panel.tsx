'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type React from 'react'
import { GoogleCalendarConfigModal } from '@/components/google-calendar-config-modal'
import { Calendar, Clock, MapPin, Users, Settings, Loader2, Maximize2, X, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ArrivalTimer } from '@/components/arrival-timer'
import { ArrivalNotificationsPanel } from '@/components/arrival-notifications-panel'
import { formatEventDescriptionForDisplay } from '@/lib/agenda/event-present'
import {
  AgendaToCampoButton,
  type CampoGoogleLink,
} from '@/components/agenda/agenda-to-campo-button'
import { cn } from '@/lib/utils'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyBodyMutedClass,
  typographyContentRootClass,
  typographyMetricValueClass,
  typographySectionLabelClass,
  typographySectionLeadClass,
  typographySectionTitleClass,
} from '@/lib/typography-chrome'

/** Âmbar fixo da marca — não usar `text-accent-gold` (azul no tema republicanos). */
const agendaAmberIconClass = 'text-[#ff9800]'

const agendaAmberButtonClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-lg border border-accent-gold/40 bg-accent-gold/10 transition-colors hover:bg-accent-gold/15 disabled:cursor-not-allowed disabled:opacity-50',
  typographyBodyMediumClass,
  'text-text-primary',
)

interface CalendarConfig {
  calendarId: string
  serviceAccountEmail: string
  credentials: string
  subjectUser?: string
}

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  location?: string
  attendees?: Array<{ email: string; displayName?: string }>
  status?: string
  origin?: string // Origem extraída da descrição (ex: "THE - PI")
  attendance?: {
    attended: boolean
    notes?: string
    arrival_time?: string
  }
}

export function AgendaPanel({ embedded = true }: { embedded?: boolean }) {
  const { user, loading: authLoading } = useAuth()
  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, { attended: boolean; notes?: string; arrival_time?: string }>>({})
  const [confirmingArrival, setConfirmingArrival] = useState<Record<string, boolean>>({})
  const [upcomingEventAlert, setUpcomingEventAlert] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [campoLinks, setCampoLinks] = useState<Record<string, CampoGoogleLink>>({})

  // Função para destacar origem no texto (ex: "(THE - PI)" ou "(BSB)")
  const highlightOriginInText = (text: string): React.ReactNode => {
    if (!text) return text
    
    // Procurar no início do texto por parênteses
    const match = text.match(/^(\([^)]+\))(.*)/)
    if (match) {
      const origin = match[1] // "(THE - PI)"
      const rest = match[2] // resto do texto
      const originText = match[1].replace(/[()]/g, '') // "THE - PI"
      
      return (
        <>
          <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium tracking-normal !text-white', getOriginColor(originText))}>
            {origin}
          </span>
          {rest}
        </>
      )
    }
    
    return text
  }

  // Função para obter cor baseada na origem
  const getOriginColor = (origin?: string): string => {
    if (!origin) return 'bg-gray-500'
    
    const originLower = origin.toLowerCase()
    if (originLower.includes('the')) return 'bg-blue-500'
    if (originLower.includes('pi')) return 'bg-purple-500'
    if (originLower.includes('ma')) return 'bg-green-500'
    if (originLower.includes('ce')) return 'bg-yellow-500'
    if (originLower.includes('rn')) return 'bg-red-500'
    if (originLower.includes('pb')) return 'bg-pink-500'
    if (originLower.includes('pe')) return 'bg-orange-500'
    if (originLower.includes('al')) return 'bg-indigo-500'
    if (originLower.includes('se')) return 'bg-teal-500'
    if (originLower.includes('ba')) return 'bg-cyan-500'
    
    return 'bg-gray-500'
  }

  useEffect(() => {
    const loadConfig = async () => {
      // Aguardar autenticação terminar antes de decidir o estado da config
      if (authLoading) return

      if (!user?.id) {
        // Usuário não autenticado - tentar localStorage como fallback
        const savedConfig = localStorage.getItem('google_calendar_config')
        if (savedConfig) {
          try {
            const parsed = JSON.parse(savedConfig)
            setConfig(parsed)
          } catch (e) {
            console.error('Erro ao carregar configuração do localStorage:', e)
          }
        }
        setConfigLoaded(true)
        setLoading(false)
        return
      }

      setConfigLoaded(false)
      try {
        const response = await fetch('/api/agenda/google-calendar-config')
        if (response.ok) {
          const data = await response.json()
          if (data.config) {
            setConfig(data.config)
            localStorage.setItem('google_calendar_config', JSON.stringify(data.config))
            setConfigLoaded(true)
            setLoading(false)
            return
          }
        }

        // API falhou ou não encontrou config - tentar localStorage
        const savedConfig = localStorage.getItem('google_calendar_config')
        if (savedConfig) {
          try {
            const parsed = JSON.parse(savedConfig)
            setConfig(parsed)
            // Tentar sincronizar de volta ao banco se o usuário está autenticado
            if (user?.id) {
              fetch('/api/agenda/google-calendar-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed),
              }).catch(() => {})
            }
          } catch (e) {
            console.error('Erro ao carregar configuração do localStorage:', e)
          }
        }
      } catch (error) {
        console.error('Erro ao carregar configuração:', error)
        // Fallback para localStorage em caso de erro de rede
        const savedConfig = localStorage.getItem('google_calendar_config')
        if (savedConfig) {
          try {
            const parsed = JSON.parse(savedConfig)
            setConfig(parsed)
          } catch (e) {
            console.error('Erro ao carregar configuração do localStorage:', e)
          }
        }
      } finally {
        setConfigLoaded(true)
        setLoading(false)
      }
    }

    loadConfig()
  }, [user?.id, authLoading])

  const fetchEvents = useCallback(async (isManual = false) => {
    if (!config) return

    if (isManual) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/agenda/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: config.calendarId,
          serviceAccountEmail: config.serviceAccountEmail,
          credentials: config.credentials,
          subjectUser: config.subjectUser,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Não precisa processar origem separadamente, vamos destacar diretamente no texto
        setEvents(data.events || [])
      } else {
        setError(data.error || 'Erro ao buscar eventos')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google Calendar')
    } finally {
      if (isManual) {
        setIsRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [config])

  useEffect(() => {
    if (config) {
      fetchEvents(false) // Carregamento inicial (sem loading duplicado)
      
      // Atualização automática silenciosa a cada 30 minutos
      const interval = setInterval(() => {
        fetchEvents(false) // false = atualização automática (sem loading)
      }, 1800000) // 30 minutos (30 * 60 * 1000)

      return () => clearInterval(interval)
    }
  }, [config, fetchEvents])

  // Carregar status de atendimentos quando eventos mudarem
  useEffect(() => {
    if (events.length > 0 && user?.id) {
      loadAttendanceStatuses()
    }
  }, [events, user?.id])

  const loadCampoLinks = useCallback(async () => {
    if (!user?.id) return
    try {
      const response = await fetch('/api/campo/agendas/google-links')
      if (!response.ok) return
      const data = (await response.json()) as { links?: Record<string, CampoGoogleLink> }
      setCampoLinks(data.links ?? {})
    } catch {
      // coluna google_event_id pode ainda não existir no banco
    }
  }, [user?.id])

  useEffect(() => {
    void loadCampoLinks()
  }, [loadCampoLinks])

  const handleCampoLinked = useCallback((eventId: string, link: CampoGoogleLink) => {
    setCampoLinks((prev) => ({ ...prev, [eventId]: link }))
  }, [])

  // Verificar eventos próximos (5 minutos) para alerta intermitente
  useEffect(() => {
    if (events.length === 0) return

    const checkUpcomingEvents = () => {
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      const upcoming = events.find((event) => {
        const eventDate = event.start.dateTime 
          ? new Date(event.start.dateTime) 
          : event.start.date 
          ? new Date(event.start.date) 
          : null
        
        if (!eventDate) return false
        return eventDate >= now && eventDate <= fiveMinutesFromNow
      })

      setUpcomingEventAlert(upcoming?.id || null)
    }

    checkUpcomingEvents()
    const interval = setInterval(checkUpcomingEvents, 10000) // Verificar a cada 10 segundos

    return () => clearInterval(interval)
  }, [events])


  const loadAttendanceStatuses = async () => {
    if (!user?.id) return

    try {
      const promises = events.map(async (event) => {
        const response = await fetch(`/api/agenda/attendance?eventId=${event.id}`)
        if (response.ok) {
          const data = await response.json()
          return { eventId: event.id, attendance: data.attendance }
        }
        return { eventId: event.id, attendance: null }
      })

      const results = await Promise.all(promises)
      const statuses: Record<string, { attended: boolean; notes?: string; arrival_time?: string }> = {}
      
      results.forEach(({ eventId, attendance }) => {
        if (attendance) {
          statuses[eventId] = {
            attended: attendance.attended,
            notes: attendance.notes,
            arrival_time: attendance.arrival_time,
          }
        }
      })

      setAttendanceStatuses(statuses)
    } catch (err) {
      console.error('Erro ao carregar status de atendimentos:', err)
    }
  }

  const handleSaveConfig = async (newConfig: {
    calendarId: string
    serviceAccountEmail: string
    credentials: string
    subjectUser?: string
  }) => {
    try {
      // Salvar no banco de dados
      const response = await fetch('/api/agenda/google-calendar-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config || newConfig)
        // Também salva no localStorage como cache
        localStorage.setItem('google_calendar_config', JSON.stringify(data.config || newConfig))
        fetchEvents(true) // Atualização manual após salvar configuração
      } else {
        const errorData = await response.json()
        console.error('Erro ao salvar configuração:', errorData.error)
        alert('Erro ao salvar configuração. Tente novamente.')
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      alert('Erro ao salvar configuração. Tente novamente.')
    }
  }

  const handleAttendanceChange = async (eventId: string, attended: boolean) => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/agenda/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          attended,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAttendanceStatuses((prev) => ({
          ...prev,
          [eventId]: {
            attended: data.attendance.attended,
            notes: data.attendance.notes,
            arrival_time: data.attendance.arrival_time,
          },
        }))
      }
    } catch (err) {
      console.error('Erro ao salvar status de atendimento:', err)
    }
  }

  const handleConfirmArrival = async (eventId: string, eventSummary?: string) => {
    if (!user?.id) return

    const eventName = eventSummary || 'este evento'
    const linkedCampo = Boolean(campoLinks[eventId])
    const confirmMessage = linkedCampo
      ? `Deseja confirmar a chegada para "${eventName}"?\n\nO horário será registrado na agenda e o check-in em Campo & Agenda será sincronizado automaticamente.`
      : `Deseja realmente confirmar a chegada para "${eventName}"?\n\nEsta ação registrará o horário atual como momento da chegada.`

    if (!window.confirm(confirmMessage)) {
      return
    }

    setConfirmingArrival((prev) => ({ ...prev, [eventId]: true }))

    try {
      const response = await fetch('/api/agenda/attendance/confirm-arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      if (response.ok) {
        const data = (await response.json()) as {
          attendance: { arrival_time?: string }
          campoSync?: { synced: boolean; agendaId?: string; reason?: string }
        }
        setAttendanceStatuses((prev) => ({
          ...prev,
          [eventId]: {
            ...prev[eventId],
            arrival_time: data.attendance.arrival_time,
          },
        }))
        if (data.campoSync?.synced && data.campoSync.agendaId) {
          setCampoLinks((prev) => ({
            ...prev,
            [eventId]: {
              ...(prev[eventId] ?? {
                id: data.campoSync!.agendaId!,
                date: '',
                type: 'visita',
              }),
              id: data.campoSync!.agendaId!,
              status: 'concluida',
            },
          }))
        }
      } else {
        alert('Erro ao confirmar chegada. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao confirmar chegada:', err)
      alert('Erro ao confirmar chegada. Tente novamente.')
    } finally {
      setConfirmingArrival((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const formatDateOnly = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getEventDate = (event: CalendarEvent): Date | null => {
    if (event.start.dateTime) return new Date(event.start.dateTime)
    if (event.start.date) return new Date(event.start.date)
    return null
  }

  const isSameDay = (date1: Date, date2: Date): boolean => {
    // Normalizar datas para o timezone local (meia-noite local)
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
    return d1.getTime() === d2.getTime()
  }

  // Filtrar eventos por data selecionada
  const filteredEvents = useMemo(() => {
    if (!selectedDate) return events

    return events.filter((event) => {
      const eventDate = getEventDate(event)
      if (!eventDate) return false
      return isSameDay(eventDate, selectedDate)
    })
  }, [events, selectedDate])

  // Ordenar eventos por data
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateA = getEventDate(a)?.getTime() || 0
      const dateB = getEventDate(b)?.getTime() || 0
      return dateA - dateB
    })
  }, [filteredEvents])

  // Verificar se há avisos ativos para aplicar margem condicionalmente
  const hasActiveArrivals = useMemo(() => {
    return events.some((event) => {
      const attendance = attendanceStatuses[event.id]
      return attendance?.arrival_time && attendance?.attended === undefined
    })
  }, [events, attendanceStatuses])

  return (
    <div
      className={cn(
        typographyContentRootClass,
        embedded ? 'w-full min-w-0' : 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-bg-surface',
      )}
    >

      {/* Quadro de Avisos na Lateral Direita */}
      <ArrivalNotificationsPanel
        events={events}
        attendanceStatuses={attendanceStatuses}
        formatTime={formatTime}
      />

      <div
        className={cn(
          embedded ? undefined : 'px-4 py-6 lg:px-6',
          hasActiveArrivals && 'lg:mr-80',
        )}
      >
        {/* Botão de Configuração */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className={cn(typographySectionTitleClass, 'mb-2')}>Eventos do Google Calendar</h2>
            <p className={cn(typographySectionLeadClass, 'break-words')}>
              {!configLoaded
                ? 'Carregando...'
                : config
                  ? `Conectado ao calendário: ${config.calendarId}`
                  : 'Configure sua conexão com o Google Calendar para visualizar seus eventos'}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            {config && (
              <button
                onClick={() => fetchEvents(true)}
                disabled={isRefreshing || loading}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg border border-card bg-surface px-4 py-2 text-text-primary transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto',
                  typographyBodyClass,
                )}
                title="Atualizar eventos manualmente"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Atualizando...' : 'Atualizar'}
              </button>
            )}
            <button
              onClick={() => setShowConfig(true)}
              disabled={!configLoaded}
              className={cn(agendaAmberButtonClass, 'w-full justify-center px-4 py-2 sm:w-auto')}
            >
              <Settings className="w-4 h-4" />
              {config ? 'Reconfigurar' : 'Configurar'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-status-error/30 bg-status-error/10">
            <p className={cn(typographyBodyClass, 'text-status-error')}>{error}</p>
          </div>
        )}

        {/* Alerta de evento próximo (5 minutos) */}
        {upcomingEventAlert && (
          <div className={`mb-6 p-4 rounded-xl border-2 border-status-warning/50 bg-status-warning/20 animate-pulse`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-status-warning animate-pulse" />
              <p className={cn(typographyBodyMediumClass, 'text-status-warning')}>
                ⚠️ Evento próximo! Faltam menos de 5 minutos para o próximo compromisso.
              </p>
            </div>
          </div>
        )}

        {!configLoaded ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
            <span className={cn('ml-2', typographyBodyMutedClass)}>Carregando configuração...</span>
          </div>
        ) : !config ? (
          <div className="bg-surface rounded-2xl border border-card p-8 text-center">
            <Calendar className="w-16 h-16 text-secondary mx-auto mb-4" />
            <h3 className={cn(typographySectionTitleClass, 'mb-2')}>
              Nenhuma configuração encontrada
            </h3>
            <p className={cn(typographySectionLeadClass, 'mb-4')}>
              Configure sua conexão com o Google Calendar para começar a visualizar seus eventos.
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className={cn(agendaAmberButtonClass, 'px-6 py-3')}
            >
              Configurar Google Calendar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
            <span className={cn('ml-2', typographyBodyMutedClass)}>Carregando eventos...</span>
          </div>
        ) : (
          <>
            {/* Filtro de Data */}
            <div className="mb-6 rounded-xl border border-card bg-surface p-4">
              <label className={cn('mb-2 block', typographyBodyMediumClass)}>
                Filtrar por Data
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <input
                  type="date"
                  value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      // Criar data no timezone local para evitar problemas de timezone
                      const [year, month, day] = e.target.value.split('-').map(Number)
                      const date = new Date(year, month - 1, day) // month é 0-indexed
                      setSelectedDate(date)
                    } else {
                      setSelectedDate(null)
                    }
                  }}
                  min="2026-01-01"
                  className={cn(
                    'w-full rounded-lg border border-card bg-background px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:w-auto',
                    typographyBodyClass,
                  )}
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className={cn(
                      'w-full px-4 py-2 text-center transition-colors hover:text-text-primary sm:w-auto sm:text-left',
                      typographyBodyMutedClass,
                    )}
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              {selectedDate && (
                <p className={cn('mt-2', typographyBodyMutedClass)}>
                  Mostrando eventos de {formatDateOnly(selectedDate)} ({sortedEvents.length} evento{sortedEvents.length !== 1 ? 's' : ''})
                </p>
              )}
            </div>

            {/* Lista de Eventos */}
            <div className="py-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className={cn(typographySectionTitleClass, 'flex items-center gap-2')}>
                  <Calendar className={cn('h-5 w-5', agendaAmberIconClass)} />
                  {selectedDate ? `Eventos de ${formatDateOnly(selectedDate)}` : 'Todos os Eventos'}
                </h3>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {sortedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className={typographyBodyMutedClass}>
                    {selectedDate ? 'Nenhum evento encontrado para esta data' : 'Nenhum evento encontrado'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedEvents.map((event) => {
                    const eventDate = getEventDate(event)
                    const isPast = eventDate ? eventDate < new Date() : false
                    const isUpcoming = upcomingEventAlert === event.id
                    const attendance = attendanceStatuses[event.id]

                    return (
                      <div
                        key={event.id}
                        className={`p-4 rounded-xl border border-card hover:bg-background/50 transition-colors relative ${
                          isUpcoming ? 'ring-2 ring-status-warning animate-pulse' : ''
                        } ${isPast ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className={cn(typographyBodyMediumClass, 'min-w-0 flex-1 font-semibold')}>
                            {highlightOriginInText(event.summary || 'Sem título')}
                          </h4>
                          <div className="shrink-0 text-right">
                            <p className={typographyBodyMediumClass}>
                              {event.start.dateTime
                                ? formatDate(event.start.dateTime)
                                : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                            </p>
                            {isPast ? (
                              <p className={cn(typographyBodyMutedClass, 'mt-1')}>Passado</p>
                            ) : null}
                          </div>
                        </div>
                        <div className={cn('mt-1 flex flex-wrap items-center gap-3', typographyBodyMutedClass)}>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span className={typographyMetricValueClass}>
                              {event.start.dateTime
                                ? formatTime(event.start.dateTime)
                                : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                            </span>
                          </div>
                          {event.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>{event.location}</span>
                            </div>
                          ) : null}
                          {event.attendees && event.attendees.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              <span>{event.attendees.length} participante(s)</span>
                            </div>
                          ) : null}
                        </div>
                        {user?.id ? (
                          <div className="mt-3 flex flex-wrap items-center gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`attendance-${event.id}`}
                                checked={attendance?.attended === true}
                                onChange={() => handleAttendanceChange(event.id, true)}
                                className="h-4 w-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                              />
                              <span className={cn(typographyBodyMutedClass, 'flex items-center gap-1')}>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Atendido
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`attendance-${event.id}`}
                                checked={attendance?.attended === false}
                                onChange={() => handleAttendanceChange(event.id, false)}
                                className="h-4 w-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                              />
                              <span className={cn(typographyBodyMutedClass, 'flex items-center gap-1')}>
                                <XCircle className="h-4 w-4 text-red-600" />
                                Não Atendido
                              </span>
                            </label>
                            {attendance === undefined ? (
                              <span className={typographyBodyMutedClass}>Não marcado</span>
                            ) : null}
                            {attendance?.arrival_time ? (
                              <div className="flex flex-col items-start gap-1">
                                <ArrivalTimer arrivalTime={attendance.arrival_time} />
                                {campoLinks[event.id]?.status === 'concluida' ? (
                                  <span className={cn(typographyBodyMutedClass, 'font-medium text-green-600')}>
                                    Check-in Campo sincronizado
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleConfirmArrival(event.id, event.summary)}
                                disabled={confirmingArrival[event.id]}
                                className={cn(agendaAmberButtonClass, 'px-3 py-1.5')}
                              >
                                {confirmingArrival[event.id] ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Confirmando...
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Confirmar Chegada
                                  </>
                                )}
                              </button>
                            )}
                            <AgendaToCampoButton
                              event={event}
                              linked={campoLinks[event.id]}
                              onLinked={handleCampoLinked}
                            />
                          </div>
                        ) : null}
                        {formatEventDescriptionForDisplay(event.description) ? (
                          <p className={cn(typographyBodyMutedClass, 'mt-3 leading-relaxed')}>
                            {formatEventDescriptionForDisplay(event.description)}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de Configuração */}
      {showConfig && (
        <GoogleCalendarConfigModal
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
          currentConfig={config || undefined}
        />
      )}

      {/* Modal de Tela Cheia */}
      {showFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg-surface">
          {/* Quadro de Avisos na Lateral Direita - dentro do modal */}
          <ArrivalNotificationsPanel
            events={events}
            attendanceStatuses={attendanceStatuses}
            formatTime={formatTime}
            zIndex={60}
          />
          
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className={cn(typographySectionTitleClass, 'flex items-center gap-2')}>
              <Calendar className={cn('h-6 w-6', agendaAmberIconClass)} />
              {selectedDate ? `Eventos de ${formatDateOnly(selectedDate)}` : 'Todos os Eventos'}
            </h2>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-secondary" />
            </button>
          </div>
          <div className={cn('flex-1 overflow-auto p-4 sm:p-6', hasActiveArrivals && 'lg:mr-80')}>
            <div className="max-w-5xl mx-auto">
              {sortedEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className={typographyBodyMutedClass}>
                    {selectedDate ? 'Nenhum evento encontrado para esta data' : 'Nenhum evento encontrado'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedEvents.map((event) => {
                    const eventDate = getEventDate(event)
                    const isPast = eventDate ? eventDate < new Date() : false
                    const isUpcoming = upcomingEventAlert === event.id
                    const attendance = attendanceStatuses[event.id]

                    return (
                      <div
                        key={event.id}
                        className={`p-5 rounded-xl border border-card hover:bg-background/50 transition-colors ${
                          isUpcoming ? 'ring-2 ring-status-warning animate-pulse' : ''
                        } ${isPast ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className={cn(typographySectionTitleClass, 'min-w-0 flex-1')}>
                            {highlightOriginInText(event.summary || 'Sem título')}
                          </h4>
                          <div className="shrink-0 text-right">
                            <p className={typographyBodyMediumClass}>
                              {event.start.dateTime
                                ? formatDate(event.start.dateTime)
                                : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                            </p>
                            {isPast ? (
                              <p className={cn(typographyBodyMutedClass, 'mt-1')}>Passado</p>
                            ) : null}
                          </div>
                        </div>
                        <div className={cn('mt-2 flex flex-wrap items-center gap-4', typographyBodyMutedClass)}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className={typographyMetricValueClass}>
                              {event.start.dateTime
                                ? formatTime(event.start.dateTime)
                                : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                            </span>
                          </div>
                          {event.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                          ) : null}
                          {event.attendees && event.attendees.length > 0 ? (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{event.attendees.length} participante(s)</span>
                            </div>
                          ) : null}
                        </div>
                        {user?.id ? (
                          <div className="mt-4 flex flex-wrap items-center gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`attendance-fullscreen-${event.id}`}
                                checked={attendance?.attended === true}
                                onChange={() => handleAttendanceChange(event.id, true)}
                                className="h-4 w-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                              />
                              <span className={cn(typographyBodyMutedClass, 'flex items-center gap-1')}>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                Atendido
                              </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name={`attendance-fullscreen-${event.id}`}
                                checked={attendance?.attended === false}
                                onChange={() => handleAttendanceChange(event.id, false)}
                                className="h-4 w-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                              />
                              <span className={cn(typographyBodyMutedClass, 'flex items-center gap-1')}>
                                <XCircle className="h-4 w-4 text-red-600" />
                                Não Atendido
                              </span>
                            </label>
                            {attendance === undefined ? (
                              <span className={typographyBodyMutedClass}>Não marcado</span>
                            ) : null}
                            {attendance?.arrival_time ? (
                              <div className="flex flex-col items-start gap-1">
                                <ArrivalTimer arrivalTime={attendance.arrival_time} />
                                {campoLinks[event.id]?.status === 'concluida' ? (
                                  <span className={cn(typographyBodyMutedClass, 'font-medium text-green-600')}>
                                    Check-in Campo sincronizado
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleConfirmArrival(event.id, event.summary)}
                                disabled={confirmingArrival[event.id]}
                                className={cn(agendaAmberButtonClass, 'px-3 py-1.5')}
                              >
                                {confirmingArrival[event.id] ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Confirmando...
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Confirmar Chegada
                                  </>
                                )}
                              </button>
                            )}
                            <AgendaToCampoButton
                              event={event}
                              linked={campoLinks[event.id]}
                              onLinked={handleCampoLinked}
                            />
                          </div>
                        ) : null}
                        {formatEventDescriptionForDisplay(event.description) ? (
                          <p className={cn(typographyBodyMutedClass, 'mt-3 leading-relaxed')}>
                            {formatEventDescriptionForDisplay(event.description)}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
