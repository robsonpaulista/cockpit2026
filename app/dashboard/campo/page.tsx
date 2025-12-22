'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { MapPin, Calendar, CheckCircle2, Clock, Plus, Filter } from 'lucide-react'
import { AgendaModal } from '@/components/agenda-modal'
import { DemandModal } from '@/components/demand-modal'
import { KPI } from '@/types'
import { formatDate } from '@/lib/utils'

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

interface Demanda {
  id: string
  title: string
  status: string
  theme?: string
  priority?: string
  visits?: {
    agendas?: {
      cities?: {
        name: string
        state: string
      }
    }
  }
}

export default function CampoPage() {
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [demands, setDemands] = useState<Demanda[]>([])
  const [campoKPIs, setCampoKPIs] = useState<KPI[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('todas')
  const [showAgendaModal, setShowAgendaModal] = useState(false)
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null)
  const [showDemandModal, setShowDemandModal] = useState(false)
  const [editingDemand, setEditingDemand] = useState<Demanda | null>(null)

  useEffect(() => {
    fetchKPIs()
    fetchAgendas()
    fetchDemands()
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

  const fetchDemands = async () => {
    try {
      const response = await fetch('/api/campo/demands')
      if (response.ok) {
        const data = await response.json()
        setDemands(data)
        // Atualizar KPIs após buscar demandas
        fetchKPIs()
      }
    } catch (error) {
      console.error('Erro ao buscar demandas:', error)
    }
  }

  const handleCheckin = async (agendaId: string) => {
    // Solicitar permissão de geolocalização
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const response = await fetch(`/api/campo/visits/${agendaId}/checkin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }),
            })

            if (response.ok) {
              fetchAgendas()
            }
          } catch (error) {
            console.error('Erro ao fazer check-in:', error)
          }
        },
        (error) => {
          console.error('Erro ao obter localização:', error)
          alert('Não foi possível obter sua localização')
        }
      )
    }
  }

  const filteredDemands = filterStatus === 'todas' 
    ? demands 
    : demands.filter(d => d.status === filterStatus)

  const demandsByStatus = {
    nova: filteredDemands.filter(d => d.status === 'nova'),
    'em-andamento': filteredDemands.filter(d => d.status === 'em-andamento'),
    encaminhado: filteredDemands.filter(d => d.status === 'encaminhado'),
    resolvido: filteredDemands.filter(d => d.status === 'resolvido'),
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Campo & Agenda" subtitle="Transforme agenda em entrega, narrativa e relacionamento" />

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {campoKPIs.length > 0 ? (
              campoKPIs.map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} />
              ))
            ) : (
              // Loading skeleton para KPIs
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-surface rounded-xl border border-border animate-pulse" />
              ))
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agenda */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-strong">Agenda</h2>
                <button
                  onClick={() => {
                    setEditingAgenda(null)
                    setShowAgendaModal(true)
                  }}
                  className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
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
                  <p className="text-text-muted">Nenhuma agenda cadastrada ainda.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendas.map((agenda) => (
                    <div
                      key={agenda.id}
                      className="p-4 rounded-xl border border-border hover:border-primary/20 hover:shadow-card transition-all duration-200 ease-premium"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-primary-soft">
                              <Calendar className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-text-strong">
                                {agenda.cities?.name || 'Cidade não informada'}
                              </h3>
                              <p className="text-xs text-text-muted">
                                {formatDate(agenda.date)} • {agenda.type}
                              </p>
                            </div>
                          </div>
                          {agenda.description && (
                            <p className="text-sm text-text-muted mt-2">{agenda.description}</p>
                          )}
                          {agenda.status === 'concluida' && agenda.visits && agenda.visits[0] && (
                            <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
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
                        <div className="flex items-center gap-2">
                          {agenda.status === 'planejada' && (
                            <button
                              onClick={() => handleCheckin(agenda.id)}
                              className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              Check-in
                            </button>
                          )}
                          {agenda.status === 'concluida' ? (
                            <span className="px-2 py-1 text-xs font-medium bg-status-success/10 text-status-success rounded-lg">
                              Concluída
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-medium bg-primary-soft text-primary rounded-lg">
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

          {/* Demandas Kanban */}
          <div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-strong">Demandas</h2>
                  <button
                    onClick={() => {
                      setEditingDemand(null)
                      setShowDemandModal(true)
                    }}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Demanda
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-muted" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface"
                  >
                    <option value="todas">Todas</option>
                    <option value="nova">Nova</option>
                    <option value="em-andamento">Em Andamento</option>
                    <option value="encaminhado">Encaminhado</option>
                    <option value="resolvido">Resolvido</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {/* Nova */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Nova</h3>
                  <div className="space-y-2">
                    {demandsByStatus.nova.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-2">Nenhuma</p>
                    ) : (
                      demandsByStatus.nova.map((demanda) => (
                        <DemandCard 
                          key={demanda.id} 
                          demanda={demanda} 
                          onUpdate={fetchDemands}
                          onKPIsUpdate={fetchKPIs}
                          onEdit={(d) => {
                            setEditingDemand(d)
                            setShowDemandModal(true)
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Em Andamento */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Em Andamento</h3>
                  <div className="space-y-2">
                    {demandsByStatus['em-andamento'].length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-2">Nenhuma</p>
                    ) : (
                      demandsByStatus['em-andamento'].map((demanda) => (
                        <DemandCard 
                          key={demanda.id} 
                          demanda={demanda} 
                          onUpdate={fetchDemands}
                          onKPIsUpdate={fetchKPIs}
                          onEdit={(d) => {
                            setEditingDemand(d)
                            setShowDemandModal(true)
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Encaminhado */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Encaminhado</h3>
                  <div className="space-y-2">
                    {demandsByStatus.encaminhado.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-2">Nenhuma</p>
                    ) : (
                      demandsByStatus.encaminhado.map((demanda) => (
                        <DemandCard 
                          key={demanda.id} 
                          demanda={demanda} 
                          onUpdate={fetchDemands}
                          onKPIsUpdate={fetchKPIs}
                          onEdit={(d) => {
                            setEditingDemand(d)
                            setShowDemandModal(true)
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Resolvido */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Resolvido</h3>
                  <div className="space-y-2">
                    {demandsByStatus.resolvido.length === 0 ? (
                      <p className="text-xs text-text-muted text-center py-2">Nenhuma</p>
                    ) : (
                      demandsByStatus.resolvido.map((demanda) => (
                        <DemandCard 
                          key={demanda.id} 
                          demanda={demanda} 
                          onUpdate={fetchDemands}
                          onKPIsUpdate={fetchKPIs}
                          onEdit={(d) => {
                            setEditingDemand(d)
                            setShowDemandModal(true)
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
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
        />
      )}

      {/* Modal de Demanda */}
      {showDemandModal && (
        <DemandModal
          demand={editingDemand}
          onClose={() => {
            setShowDemandModal(false)
            setEditingDemand(null)
          }}
          onSuccess={() => {
            setShowDemandModal(false)
            setEditingDemand(null)
            fetchDemands()
            fetchKPIs()
          }}
        />
      )}
    </div>
  )
}

// Componente para card de demanda
function DemandCard({ 
  demanda, 
  onUpdate, 
  onEdit,
  onKPIsUpdate
}: { 
  demanda: Demanda
  onUpdate: () => void
  onEdit?: (demanda: Demanda) => void
  onKPIsUpdate?: () => void
}) {
  const [updating, setUpdating] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/campo/demands/${demanda.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        onUpdate()
        onKPIsUpdate?.()
      }
    } catch (error) {
      console.error('Erro ao atualizar demanda:', error)
    } finally {
      setUpdating(false)
    }
  }

  const statusColors = {
    nova: 'bg-background border-border',
    'em-andamento': 'bg-status-warning/5 border-status-warning/30',
    encaminhado: 'bg-primary-soft border-primary/30',
    resolvido: 'bg-status-success/10 border-status-success/30',
  }

  return (
    <div className={`p-3 rounded-lg border ${statusColors[demanda.status as keyof typeof statusColors]} group`}>
      <div className="flex items-start justify-between mb-1">
        <p 
          className="text-sm font-medium text-text-strong flex-1 cursor-pointer hover:text-primary transition-colors"
          onClick={() => onEdit?.(demanda)}
          title="Clique para editar"
        >
          {demanda.title}
        </p>
        {onEdit && (
          <button
            onClick={() => onEdit(demanda)}
            className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-text-muted hover:text-primary"
            title="Editar demanda"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
      {demanda.visits?.agendas?.cities && (
        <p className="text-xs text-text-muted mb-2">
          {demanda.visits.agendas.cities.name} - {demanda.visits.agendas.cities.state}
        </p>
      )}
      {demanda.priority && (
        <span
          className={`inline-block px-2 py-0.5 text-xs rounded-full mb-2 ${
            demanda.priority === 'high'
              ? 'bg-status-error/20 text-status-error'
              : demanda.priority === 'medium'
              ? 'bg-status-warning/20 text-status-warning'
              : 'bg-primary/20 text-primary'
          }`}
        >
          {demanda.priority === 'high' ? 'Alta' : demanda.priority === 'medium' ? 'Média' : 'Baixa'}
        </span>
      )}
      {!updating && demanda.status !== 'resolvido' && (
        <select
          value={demanda.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full mt-2 text-xs border border-border rounded-lg px-2 py-1 bg-surface"
        >
          <option value="nova">Nova</option>
          <option value="em-andamento">Em Andamento</option>
          <option value="encaminhado">Encaminhado</option>
          <option value="resolvido">Resolvido</option>
        </select>
      )}
    </div>
  )
}
