'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { MapPin, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { KPI } from '@/types'

const campoKPIs: KPI[] = [
  {
    id: 'agendas',
    label: 'Agendas Realizadas',
    value: '42/50',
    variation: 8,
    status: 'success',
  },
  {
    id: 'municipios',
    label: 'Municípios Visitados',
    value: '15',
    variation: 3,
    status: 'success',
  },
  {
    id: 'demandas',
    label: 'Demandas Resolvidas',
    value: '28/35',
    variation: 5,
    status: 'warning',
  },
  {
    id: 'promessas',
    label: 'Promessas x Entregas',
    value: '12/18',
    variation: -2,
    status: 'warning',
  },
]

const agendas = [
  {
    id: '1',
    data: '2024-10-15',
    cidade: 'São Paulo',
    tipo: 'Visita',
    status: 'concluida',
    demandas: 3,
    fotos: 12,
  },
  {
    id: '2',
    data: '2024-10-16',
    cidade: 'Campinas',
    tipo: 'Evento',
    status: 'planejada',
    demandas: 0,
    fotos: 0,
  },
  {
    id: '3',
    data: '2024-10-17',
    cidade: 'Santos',
    tipo: 'Reunião',
    status: 'planejada',
    demandas: 0,
    fotos: 0,
  },
]

const demandas = [
  { id: '1', titulo: 'Asfaltamento Rua Principal', status: 'nova', cidade: 'São Paulo' },
  { id: '2', titulo: 'Ampliação Posto de Saúde', status: 'em-andamento', cidade: 'Campinas' },
  { id: '3', titulo: 'Criação Creche Municipal', status: 'encaminhado', cidade: 'Santos' },
  { id: '4', titulo: 'Melhoria Iluminação Pública', status: 'resolvido', cidade: 'São Paulo' },
]

export default function CampoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Campo & Agenda" subtitle="Transforme agenda em entrega, narrativa e relacionamento" />

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {campoKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agenda */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-strong">Agenda</h2>
                <button className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                  Nova Agenda
                </button>
              </div>

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
                            <h3 className="text-sm font-semibold text-text-strong">{agenda.cidade}</h3>
                            <p className="text-xs text-text-muted">{agenda.data} • {agenda.tipo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
                          {agenda.status === 'concluida' && (
                            <>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-status-success" />
                                {agenda.demandas} demandas
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {agenda.fotos} fotos
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
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
            </div>
          </div>

          {/* Demandas Kanban */}
          <div>
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-6">Demandas</h2>

              <div className="space-y-4">
                {/* Nova */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Nova</h3>
                  <div className="space-y-2">
                    {demandas
                      .filter((d) => d.status === 'nova')
                      .map((demanda) => (
                        <div
                          key={demanda.id}
                          className="p-3 rounded-lg bg-background border border-border"
                        >
                          <p className="text-sm font-medium text-text-strong">{demanda.titulo}</p>
                          <p className="text-xs text-text-muted mt-1">{demanda.cidade}</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Em Andamento */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Em Andamento</h3>
                  <div className="space-y-2">
                    {demandas
                      .filter((d) => d.status === 'em-andamento')
                      .map((demanda) => (
                        <div
                          key={demanda.id}
                          className="p-3 rounded-lg bg-status-warning/5 border border-status-warning/30"
                        >
                          <p className="text-sm font-medium text-text-strong">{demanda.titulo}</p>
                          <p className="text-xs text-text-muted mt-1">{demanda.cidade}</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Encaminhado */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Encaminhado</h3>
                  <div className="space-y-2">
                    {demandas
                      .filter((d) => d.status === 'encaminhado')
                      .map((demanda) => (
                        <div
                          key={demanda.id}
                          className="p-3 rounded-lg bg-primary-soft border border-primary/30"
                        >
                          <p className="text-sm font-medium text-text-strong">{demanda.titulo}</p>
                          <p className="text-xs text-text-muted mt-1">{demanda.cidade}</p>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Resolvido */}
                <div>
                  <h3 className="text-xs font-semibold text-text-muted uppercase mb-2">Resolvido</h3>
                  <div className="space-y-2">
                    {demandas
                      .filter((d) => d.status === 'resolvido')
                      .map((demanda) => (
                        <div
                          key={demanda.id}
                          className="p-3 rounded-lg bg-status-success/10 border border-status-success/30"
                        >
                          <p className="text-sm font-medium text-text-strong line-through text-text-muted">
                            {demanda.titulo}
                          </p>
                          <p className="text-xs text-text-muted mt-1">{demanda.cidade}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

