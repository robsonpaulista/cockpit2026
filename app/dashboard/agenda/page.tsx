'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type React from 'react'
import { Header } from '@/components/header'
import { GoogleCalendarConfigModal } from '@/components/google-calendar-config-modal'
import { Calendar, CalendarDays, Clock, MapPin, Users, Settings, Loader2, Maximize2, X, CheckCircle2, XCircle, AlertCircle, RefreshCw, UserCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ArrivalTimer } from '@/components/arrival-timer'
import { ArrivalNotificationsPanel } from '@/components/arrival-notifications-panel'

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

export default function AgendaPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<CalendarConfig | null>(null)
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
          <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getOriginColor(originText)}`}>
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

  const handleSaveConfig = (newConfig: {
    calendarId: string
    serviceAccountEmail: string
    credentials: string
    subjectUser?: string
  }) => {
    setConfig(newConfig)
    localStorage.setItem('google_calendar_config', JSON.stringify(newConfig))
    fetchEvents(true) // Atualização manual após salvar configuração
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

    // Mensagem de confirmação
    const eventName = eventSummary || 'este evento'
    const confirmMessage = `Deseja realmente confirmar a chegada para "${eventName}"?\n\nEsta ação registrará o horário atual como momento da chegada.`
    
    if (!window.confirm(confirmMessage)) {
      return
    }

    setConfirmingArrival((prev) => ({ ...prev, [eventId]: true }))

    try {
      const response = await fetch('/api/agenda/attendance/confirm-arrival', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAttendanceStatuses((prev) => ({
          ...prev,
          [eventId]: {
            ...prev[eventId],
            arrival_time: data.attendance.arrival_time,
          },
        }))
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

  // Verificar se há avisos ativos para aplicar margem condicionalmente
  const hasActiveArrivals = useMemo(() => {
    return events.some((event) => {
      const attendance = attendanceStatuses[event.id]
      return attendance?.arrival_time && attendance?.attended === undefined
    })
  }, [events, attendanceStatuses])

  return (
    <div className="min-h-screen bg-background">
      <Header title="Agenda" subtitle="Integração com Google Calendar" showFilters={false} />

      {/* Quadro de Avisos na Lateral Direita */}
      <ArrivalNotificationsPanel
        events={events}
        attendanceStatuses={attendanceStatuses}
        formatTime={formatTime}
      />

      <div className={`px-4 py-6 lg:px-6 ${hasActiveArrivals ? 'mr-80' : ''}`}>
        {/* Botão de Configuração */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-primary mb-2">Eventos do Google Calendar</h2>
            <p className="text-sm text-secondary">
              {config 
                ? `Conectado ao calendário: ${config.calendarId}` 
                : 'Configure sua conexão com o Google Calendar para visualizar seus eventos'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {config && (
              <button
                onClick={() => fetchEvents(true)}
                disabled={isRefreshing || loading}
                className="flex items-center gap-2 px-4 py-2 bg-surface border border-card text-primary rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Atualizar eventos manualmente"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Atualizando...' : 'Atualizar'}
              </button>
            )}
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {config ? 'Reconfigurar' : 'Configurar'}
            </button>
          </div>
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
          <div className="bg-surface rounded-2xl border border-card p-8 text-center">
            <Calendar className="w-16 h-16 text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary mb-2">
              Nenhuma configuração encontrada
            </h3>
            <p className="text-sm text-secondary mb-4">
              Configure sua conexão com o Google Calendar para começar a visualizar seus eventos.
            </p>
            <button
              onClick={() => setShowConfig(true)}
              className="px-6 py-3 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
            >
              Configurar Google Calendar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
            <span className="ml-2 text-sm text-secondary">Carregando eventos...</span>
          </div>
        ) : (
          <>
            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface rounded-xl border border-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="w-5 h-5 text-accent-gold" />
                  <span className="text-sm font-medium text-secondary">Total de Eventos</span>
                </div>
                <p className="text-2xl font-bold text-primary">{events.length}</p>
              </div>
              <div className="bg-surface rounded-xl border border-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-secondary">Próximos Eventos</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{upcomingEvents.length}</p>
              </div>
              <div className="bg-surface rounded-xl border border-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-secondary">Hoje</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{todayEvents.length}</p>
              </div>
            </div>

            {/* Filtro de Data */}
            <div className="mb-6 bg-surface rounded-xl border border-card p-4">
              <label className="block text-sm font-medium text-primary mb-2">
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
                  className="px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="px-4 py-2 text-sm text-secondary hover:text-primary transition-colors"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              {selectedDate && (
                <p className="mt-2 text-sm text-secondary">
                  Mostrando eventos de {formatDateOnly(selectedDate)} ({sortedEvents.length} evento{sortedEvents.length !== 1 ? 's' : ''})
                </p>
              )}
            </div>

            {/* Lista de Eventos */}
            <div className="bg-surface rounded-2xl border border-card p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent-gold" />
                  {selectedDate ? `Eventos de ${formatDateOnly(selectedDate)}` : 'Todos os Eventos'}
                </h3>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-primary"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {sortedEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-secondary">
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
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="text-base font-semibold text-primary mb-1 flex items-center gap-2 flex-wrap">
                              {highlightOriginInText(event.summary || 'Sem título')}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-base font-bold text-primary">
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
                              <div className="mt-3 flex items-center gap-4 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-${event.id}`}
                                    checked={attendance?.attended === true}
                                    onChange={() => handleAttendanceChange(event.id, true)}
                                    className="w-4 h-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                                  />
                                  <span className="text-sm text-secondary flex items-center gap-1">
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
                                    className="w-4 h-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                                  />
                                  <span className="text-sm text-secondary flex items-center gap-1">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                    Não Atendido
                                  </span>
                                </label>
                                {attendance === undefined && (
                                    <span className="text-xs text-secondary">Não marcado</span>
                                  )}
                                {/* Botão de Confirmar Chegada e Timer */}
                                {attendance?.arrival_time ? (
                                  <ArrivalTimer arrivalTime={attendance.arrival_time} />
                                ) : (
                                  <button
                                    onClick={() => handleConfirmArrival(event.id, event.summary)}
                                    disabled={confirmingArrival[event.id]}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {confirmingArrival[event.id] ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Confirmando...
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-4 h-4" />
                                        Confirmar Chegada
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end justify-between">
                            <div>
                              <p className="text-sm font-medium text-primary">
                                {event.start.dateTime 
                                  ? formatDate(event.start.dateTime)
                                  : event.start.date
                                  ? formatDate(event.start.date)
                                  : '-'}
                              </p>
                              {isPast && (
                                <p className="text-xs text-secondary mt-1">Passado</p>
                              )}
                            </div>
                            {/* Descrição no canto inferior direito */}
                            {event.description && (
                              <p className="text-sm font-bold text-primary mt-2 text-right max-w-xs">
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
          {/* Quadro de Avisos na Lateral Direita - dentro do modal */}
          <ArrivalNotificationsPanel
            events={events}
            attendanceStatuses={attendanceStatuses}
            formatTime={formatTime}
            zIndex={60}
          />
          
          <div className="bg-surface border-b border-card p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
              <Calendar className="w-6 h-6 text-accent-gold" />
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
          <div className={`flex-1 p-6 overflow-auto ${hasActiveArrivals ? 'mr-80' : ''}`}>
            <div className="max-w-5xl mx-auto">
              {sortedEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-secondary">
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
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-primary mb-2 flex items-center gap-2 flex-wrap">
                              {highlightOriginInText(event.summary || 'Sem título')}
                            </h4>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-lg font-bold text-primary">
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
                              <div className="mt-4 flex items-center gap-4 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`attendance-fullscreen-${event.id}`}
                                    checked={attendance?.attended === true}
                                    onChange={() => handleAttendanceChange(event.id, true)}
                                    className="w-4 h-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                                  />
                                  <span className="text-sm text-secondary flex items-center gap-1">
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
                                    className="w-4 h-4 border-card text-accent-gold focus:ring-2 focus:ring-accent-gold-soft"
                                  />
                                  <span className="text-sm text-secondary flex items-center gap-1">
                                    <XCircle className="w-4 h-4 text-red-600" />
                                    Não Atendido
                                  </span>
                                </label>
                                {attendance === undefined && (
                                  <span className="text-xs text-secondary">Não marcado</span>
                                )}
                                {/* Botão de Confirmar Chegada e Timer */}
                                {attendance?.arrival_time ? (
                                  <ArrivalTimer arrivalTime={attendance.arrival_time} />
                                ) : (
                                  <button
                                    onClick={() => handleConfirmArrival(event.id, event.summary)}
                                    disabled={confirmingArrival[event.id]}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {confirmingArrival[event.id] ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Confirmando...
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-4 h-4" />
                                        Confirmar Chegada
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            {/* Descrição no canto inferior direito */}
                            {event.description && (
                              <p className="text-sm font-bold text-primary text-right max-w-xs">
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
