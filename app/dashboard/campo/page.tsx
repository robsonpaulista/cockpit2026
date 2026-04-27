'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { MapPin, Calendar, CheckCircle2, Plus, Pencil } from 'lucide-react'
import { AgendaModal } from '@/components/agenda-modal'
import { KPI } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { useTheme } from '@/contexts/theme-context'

interface Agenda {
  id: string
  date: string
  city_id?: string
  type: string
  status: string
  description?: string
  cities?: {
    id: string
    name: string
    state: string
  }
  visits?: Array<{
    id: string
    checkin_time?: string
    photos: string[]
    videos: string[]
  }>
}

export default function CampoPage() {
  const { theme } = useTheme()
  const isCockpit = theme === 'cockpit'
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [campoKPIs, setCampoKPIs] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [showAgendaModal, setShowAgendaModal] = useState(false)
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null)

  useEffect(() => {
    fetchKPIs()
    fetchAgendas()
  }, [])

  const fetchKPIs = async () => {
    try {
      const response = await fetch('/api/campo/kpis')
      if (response.ok) {
        const data = await response.json()
        setCampoKPIs(data)
      }
    } catch (error) {
      console.error('Erro ao buscar KPIs:', error)
    }
  }

  const fetchAgendas = async () => {
    try {
      const response = await fetch('/api/campo/agendas')
      if (response.ok) {
        const data = await response.json()
        setAgendas(data)
        // Atualizar KPIs após buscar agendas
        fetchKPIs()
      }
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async (agendaId: string) => {
    try {
      const response = await fetch(`/api/campo/visits/${agendaId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Latitude e longitude são opcionais
          // Não solicitamos localização pois nem sempre a pessoa estará em campo
        }),
      })

      if (response.ok) {
        fetchAgendas()
      } else {
        const errorData = await response.json()
        console.error('Erro ao fazer check-in:', errorData)
      }
    } catch (error) {
      console.error('Erro ao fazer check-in:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {campoKPIs.length > 0 ? (
              campoKPIs.map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} />
              ))
            ) : (
              // Loading skeleton para KPIs
              [1, 2].map((i) => (
                <div key={i} className="h-24 bg-surface rounded-xl border border-card animate-pulse" />
              ))
            )}
          </div>
        </section>

        <div>
          {/* Agenda */}
          <div className="max-w-5xl">
            <div className="bg-surface rounded-2xl border border-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary">Agenda</h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAgenda(null)
                    setShowAgendaModal(true)
                  }}
                  className={sidebarPrimaryCTAButtonClass(isCockpit)}
                >
                  <Plus
                    className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')}
                    aria-hidden
                  />
                  Nova Agenda
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-background rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : agendas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary">Nenhuma agenda cadastrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendas.map((agenda) => (
                    <div
                      key={agenda.id}
                      className="p-4 rounded-xl border border-card hover:border-accent-gold/20 hover:shadow-card transition-all duration-200 ease-out group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-accent-gold-soft flex-shrink-0">
                              <Calendar className="w-4 h-4 text-accent-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-text-primary truncate">
                                {agenda.cities?.name || 'Cidade não informada'}
                              </h3>
                              <p className="text-xs text-secondary">
                                {formatDate(agenda.date)} • {agenda.type}
                              </p>
                            </div>
                          </div>
                          {agenda.description && (
                            <p className="text-sm text-secondary mt-2 line-clamp-2">{agenda.description}</p>
                          )}
                          {agenda.status === 'concluida' && agenda.visits && agenda.visits[0] && (
                            <div className="flex items-center gap-4 mt-3 text-xs text-secondary">
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-status-success" />
                                Check-in realizado
                              </span>
                              {agenda.visits[0].photos?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {agenda.visits[0].photos.length} fotos
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Botão Editar */}
                          <button
                            onClick={() => {
                              setEditingAgenda(agenda)
                              setShowAgendaModal(true)
                            }}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-secondary hover:text-accent-gold hover:bg-accent-gold-soft"
                            title="Editar agenda"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {agenda.status === 'planejada' && (
                            <button
                              onClick={() => handleCheckin(agenda.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
                            >
                              Check-in
                            </button>
                          )}
                          {agenda.status === 'concluida' ? (
                            <span className="px-2 py-1 text-xs font-medium bg-status-success/10 text-status-success rounded-lg">
                              Concluída
                            </span>
                          ) : agenda.status === 'cancelada' ? (
                            <span className="px-2 py-1 text-xs font-medium bg-status-error/10 text-status-error rounded-lg">
                              Cancelada
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-lg">
                              Planejada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Agenda */}
      {showAgendaModal && (
        <AgendaModal
          agenda={editingAgenda}
          onClose={() => {
            setShowAgendaModal(false)
            setEditingAgenda(null)
          }}
          onSuccess={() => {
            setShowAgendaModal(false)
            setEditingAgenda(null)
            fetchAgendas()
            fetchKPIs()
          }}
          onDelete={() => {
            setShowAgendaModal(false)
            setEditingAgenda(null)
            fetchAgendas()
            fetchKPIs()
          }}
        />
      )}
    </div>
  )
}
