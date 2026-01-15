'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { GoogleCalendarConfigModal } from '@/components/google-calendar-config-modal'
import { Calendar, CalendarDays, Clock, MapPin, Users, Settings, Loader2, Maximize2, X } from 'lucide-react'

interface CalendarConfig {
  calendarId: string
  serviceAccountEmail: string
  credentials: string
  subjectUser?: string // Email do usuário real do Workspace para Domain-Wide Delegation
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
}

export default function AgendaPage() {
  const [config, setConfig] = useState<CalendarConfig | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)

  useEffect(() => {
    // Carregar configuração do localStorage
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
    }
  }, [config])

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
          subjectUser: config.subjectUser, // Email do usuário real para Domain-Wide Delegation
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setEvents(data.events || [])
      } else {
        setError(data.error || 'Erro ao buscar eventos')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com Google Calendar')
    } finally {
      setLoading(false)
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

  const getUpcomingEvents = () => {
    const now = new Date()
    return events
      .filter((event) => {
        const eventDate = event.start.dateTime 
          ? new Date(event.start.dateTime) 
          : event.start.date 
          ? new Date(event.start.date) 
          : null
        return eventDate && eventDate >= now
      })
      .sort((a, b) => {
        const dateA = a.start.dateTime ? new Date(a.start.dateTime).getTime() : a.start.date ? new Date(a.start.date).getTime() : 0
        const dateB = b.start.dateTime ? new Date(b.start.dateTime).getTime() : b.start.date ? new Date(b.start.date).getTime() : 0
        return dateA - dateB
      })
      .slice(0, 10)
  }

  const upcomingEvents = getUpcomingEvents()

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
                <p className="text-2xl font-bold text-emerald-600">
                  {events.filter((event) => {
                    const eventDate = event.start.dateTime 
                      ? new Date(event.start.dateTime) 
                      : event.start.date 
                      ? new Date(event.start.date) 
                      : null
                    if (!eventDate) return false
                    const today = new Date()
                    return eventDate.toDateString() === today.toDateString()
                  }).length}
                </p>
              </div>
            </div>

            {/* Lista de Eventos */}
            <div className="bg-surface rounded-2xl border border-border p-6 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-20" />
              
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Próximos Eventos
                </h3>
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="p-2 rounded-lg hover:bg-background transition-colors text-text-muted hover:text-text-strong"
                  title="Visualizar em tela cheia"
                >
                  <Maximize2 className="w-5 h-5" />
                </button>
              </div>

              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-text-muted">Nenhum evento futuro encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 rounded-xl border border-border hover:bg-background/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-text-strong mb-1">
                            {event.summary || 'Sem título'}
                          </h4>
                          {event.description && (
                            <p className="text-sm text-text-muted mb-2 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
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
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-text-strong">
                            {event.start.dateTime 
                              ? formatDate(event.start.dateTime)
                              : event.start.date
                              ? formatDate(event.start.date)
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
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
              Próximos Eventos
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
              {upcomingEvents.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-muted">Nenhum evento futuro encontrado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-5 rounded-xl border border-border hover:bg-background/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-text-strong mb-2">
                            {event.summary || 'Sem título'}
                          </h4>
                          {event.description && (
                            <p className="text-sm text-text-muted mb-3">
                              {event.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span>
                                {event.start.dateTime 
                                  ? formatDate(event.start.dateTime)
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
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
