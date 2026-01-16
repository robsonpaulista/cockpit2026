'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Header } from '@/components/header'
import { GoogleCalendarConfigModal } from '@/components/google-calendar-config-modal'
import { Calendar, CalendarDays, Clock, MapPin, Users, Settings, Loader2, Maximize2, X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

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
  }
}

export default function AgendaPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [attendanceStatuses, setAttendanceStatuses] = useState<Record<string, { attended: boolean; notes?: string }>>({})
  const [upcomingEventAlert, setUpcomingEventAlert] = useState<string | null>(null)

  // Função para extrair origem do início do título (ex: "(THE - PI)" ou "(BSB)")
  const extractOrigin = (text?: string): string | undefined => {
    if (!text) return undefined
    // Procurar no início do texto por parênteses
    const match = text.match(/^\(([^)]+)\)/)
    return match ? match[1] : undefined
  }

  // Função para remover origem do título
  const removeOriginFromTitle = (title: string): string => {
    return title.replace(/^\([^)]+\)\s*/, '').trim()
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
    const savedConfig = localStorage.getItem('google_calendar_config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
      } catch (e) {
        console.error('Erro ao carregar configuração:', e)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (config) {
      fetchEvents()
      
      // Atualização automática silenciosa a cada 10 segundos
      const interval = setInterval(() => {
        fetchEvents()
      }, 10000) // 10 segundos

      return () => clearInterval(interval)
    }
  }, [config])

  // Carregar status de atendimentos quando eventos mudarem
  useEffect(() => {
    if (events.length > 0 && user?.id) {
      loadAttendanceStatuses()
    }
  }, [events, user?.id])

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

  const fetchEvents = async () => {
    if (!config) return

    setLoading(true)
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
        // Processar eventos: extrair origem do título (summary) e adicionar aos eventos
        const processedEvents = (data.events || []).map((event: CalendarEvent) => ({
          ...event,
          origin: extractOrigin(event.summary), // Extrair do título, não da descrição
        }))
        setEvents(processedEvents)
      } else {
        setError(data.error || 'Erro ao buscar eventos')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google Calendar')
    } finally {
      setLoading(false)
    }
  }

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
      const statuses: Record<string, { attended: boolean; notes?: string }> = {}
      
      results.forEach(({ eventId, attendance }) => {
        if (attendance) {
          statuses[eventId] = {
            attended: attendance.attended,
            notes: attendance.notes,
          }
        }
      })

      setAttendanceStatuses(statuses)
    } catch (err) {
      console.error('Erro ao carregar status de atendimentos:', err)
    }
  }

  const handleSaveConfig = (newConfig: {
    calendarId: string
    serviceAccountEmail: string
    credentials: string
    subjectUser?: string
  }) => {
    setConfig(newConfig)
    localStorage.setItem('google_calendar_config', JSON.stringify(newConfig))
    fetchEvents()
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
          },
        }))
      }
    } catch (err) {
      console.error('Erro ao salvar status de atendimento:', err)
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

  // Eventos de hoje
  const todayEvents = useMemo(() => {
    const today = new Date()
    return events.filter((event) => {
      const eventDate = getEventDate(event)
      if (!eventDate) return false
      return isSameDay(eventDate, today)
    })
  }, [events])

  // Próximos eventos (futuros)
  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events
      .filter((event) => {
        const eventDate = getEventDate(event)
        return eventDate && eventDate >= now
      })
      .sort((a, b) => {
        const dateA = getEventDate(a)?.getTime() || 0
        const dateB = getEventDate(b)?.getTime() || 0
        return dateA - dateB
      })
      .slice(0, 10)
  }, [events])

  return (
    <div className="min-h-screen bg-background">
      <Header title="Agenda" subtitle="Integração com Google Calendar" showFilters={false} />

      <div className="px-4 py-6 lg:px-6">
        {/* Botão de Configuração */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-strong mb-2">Eventos do Google Calendar</h2>
            <p className="text-sm text-text-muted">
              {config 
                ? `Conectado ao calendário: ${config.calendarId}` 
                : 'Configure sua conexão com o Google Calendar para visualizar seus eventos'}
            </p>
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {config ? 'Reconfigurar' : 'Configurar'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-status-error/30 bg-status-error/10">
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Alerta de evento próximo (5 minutos) */}
        {upcomingEventAlert && (
          <div className={`mb-6 p-4 rounded-xl border-2 border-status-warning/50 bg-status-warning/20 animate-pulse`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-status-warning animate-pulse" />
              <p className="text-sm font-semibold text-status-warning">
                ⚠️ Evento próximo! Faltam menos de 5 minutos para o próximo compromisso.
              </p>
            </div>
          </div>
        )}

        {!config ? (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <Calendar className="w-16 h-16 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-strong mb-2">
              Nenhuma configuração encontrada
            </h3>
            <p className="text-sm text-text-muted mb-4">
              Configure sua conexão com o Google Calendar para começar a visualizar seus eventos.
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Configurar Google Calendar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-2 text-sm text-text-muted">Carregando eventos...</span>
          </div>
        ) : (
          <>
            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-text-muted">Total de Eventos</span>
                </div>
                <p className="text-2xl font-bold text-text-strong">{events.length}</p>
              </div>
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-text-muted">Próximos Eventos</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{upcomingEvents.length}</p>
              </div>
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-text-muted">Hoje</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{todayEvents.length}</p>
              </div>
            </div>

            {/* Filtro de Data */}
            <div className="mb-6 bg-surface rounded-xl border border-border p-4">
              <label className="block text-sm font-medium text-text-strong mb-2">
                Filtrar por Data
              </label>
              <div className="flex items-center gap-3">
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
                  className="px-4 py-2 border border-border rounded-lg bg-background text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-soft"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="px-4 py-2 text-sm text-text-muted hover:text-text-strong transition-colors"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              {selectedDate && (
                <p className="mt-2 text-sm text-text-muted">
                  Mostrando eventos de {formatDateOnly(selectedDate)} ({sortedEvents.length} evento{sortedEvents.length !== 1 ? 's' : ''})
                </p>
              )}
            </div>

            {/* Lista de Eventos */}
            <div className="bg-surface rounded-2xl border border-border p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  {selectedDate ? `Eventos de ${formatDateOnly(selectedDate)}` : 'Todos os Eventos'}
                </h3>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-text-muted hover:text-text-strong"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {sortedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-text-muted">
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
                        className={`p-4 rounded-xl border border-border hover:bg-background/50 transition-colors relative ${
                          isUpcoming ? 'ring-2 ring-status-warning animate-pulse' : ''
                        } ${isPast ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {event.origin && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getOriginColor(event.origin)}`}>
                                  {event.origin}
                                </span>
                              )}
                              <h4 className="text-base font-semibold text-text-strong">
                                {removeOriginFromTitle(event.summary || 'Sem título')}
                              </h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-base font-bold text-text-strong">
                                  {event.start.dateTime 
                                    ? formatTime(event.start.dateTime)
                                    : event.start.date
                                    ? formatDate(event.start.date)
                                    : '-'}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" />
                                  <span>{event.attendees.length} participante(s)</span>
                                </div>
                              )}
                            </div>
                            {/* Status de Atendimento */}
                            {user?.id && (
                              <div className="mt-3 flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-${event.id}`}
                                    checked={attendance?.attended === true}
                                    onChange={() => handleAttendanceChange(event.id, true)}
                                    className="w-4 h-4 border-border text-primary focus:ring-2 focus:ring-primary-soft"
                                  />
                                  <span className="text-sm text-text-muted flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    Atendido
                                  </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-${event.id}`}
                                    checked={attendance?.attended === false}
                                    onChange={() => handleAttendanceChange(event.id, false)}
                                    className="w-4 h-4 border-border text-primary focus:ring-2 focus:ring-primary-soft"
                                  />
                                  <span className="text-sm text-text-muted flex items-center gap-1">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                    Não Atendido
                                  </span>
                                </label>
                                {attendance === undefined && (
                                  <span className="text-xs text-text-muted">Não marcado</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end justify-between">
                            <div>
                              <p className="text-sm font-medium text-text-strong">
                                {event.start.dateTime 
                                  ? formatDate(event.start.dateTime)
                                  : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                              </p>
                              {isPast && (
                                <p className="text-xs text-text-muted mt-1">Passado</p>
                              )}
                            </div>
                            {/* Descrição no canto inferior direito */}
                            {event.description && (
                              <p className="text-sm font-bold text-text-strong mt-2 text-right max-w-xs">
                                {event.description.replace(/^\([^)]+\)\s*/, '').trim()}
                              </p>
                            )}
                          </div>
                        </div>
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
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="bg-surface border-b border-border p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text-strong flex items-center gap-2">
              <Calendar className="w-6 h-6 text-primary" />
              {selectedDate ? `Eventos de ${formatDateOnly(selectedDate)}` : 'Todos os Eventos'}
            </h2>
            <button
              onClick={() => setShowFullscreen(false)}
              className="p-2 rounded-lg hover:bg-background transition-colors"
              title="Fechar tela cheia"
            >
              <X className="w-6 h-6 text-text-muted" />
            </button>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto">
              {sortedEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-muted">
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
                        className={`p-5 rounded-xl border border-border hover:bg-background/50 transition-colors ${
                          isUpcoming ? 'ring-2 ring-status-warning animate-pulse' : ''
                        } ${isPast ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {event.origin && (
                                <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getOriginColor(event.origin)}`}>
                                  {event.origin}
                                </span>
                              )}
                              <h4 className="text-lg font-semibold text-text-strong">
                                {removeOriginFromTitle(event.summary || 'Sem título')}
                              </h4>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-lg font-bold text-text-strong">
                                  {event.start.dateTime 
                                    ? formatTime(event.start.dateTime)
                                    : event.start.date
                                    ? formatDate(event.start.date)
                                    : '-'}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.attendees && event.attendees.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4" />
                                  <span>{event.attendees.length} participante(s)</span>
                                </div>
                              )}
                            </div>
                            {/* Status de Atendimento */}
                            {user?.id && (
                              <div className="mt-4 flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-fullscreen-${event.id}`}
                                    checked={attendance?.attended === true}
                                    onChange={() => handleAttendanceChange(event.id, true)}
                                    className="w-4 h-4 border-border text-primary focus:ring-2 focus:ring-primary-soft"
                                  />
                                  <span className="text-sm text-text-muted flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    Atendido
                                  </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-fullscreen-${event.id}`}
                                    checked={attendance?.attended === false}
                                    onChange={() => handleAttendanceChange(event.id, false)}
                                    className="w-4 h-4 border-border text-primary focus:ring-2 focus:ring-primary-soft"
                                  />
                                  <span className="text-sm text-text-muted flex items-center gap-1">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                    Não Atendido
                                  </span>
                                </label>
                                {attendance === undefined && (
                                  <span className="text-xs text-text-muted">Não marcado</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end justify-between">
                            <div>
                              <p className="text-sm font-medium text-text-strong">
                                {event.start.dateTime 
                                  ? formatDate(event.start.dateTime)
                                  : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                              </p>
                              {isPast && (
                                <p className="text-xs text-text-muted mt-1">Passado</p>
                              )}
                            </div>
                            {/* Descrição no canto inferior direito */}
                            {event.description && (
                              <p className="text-sm font-bold text-text-strong mt-2 text-right max-w-xs">
                                {event.description.replace(/^\([^)]+\)\s*/, '').trim()}
                              </p>
                            )}
                          </div>
                        </div>
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
