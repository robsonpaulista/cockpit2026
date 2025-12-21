'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { AlertCard } from '@/components/alert-card'
import { ActionCard } from '@/components/action-card'
import { mockKPIs, mockAlerts, mockActions } from '@/lib/mock-data'
import { KPI } from '@/types'
import { TrendingUp, MapPin } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const trendData = [
  { date: '01/10', ife: 65, sentimento: 60 },
  { date: '08/10', ife: 68, sentimento: 62 },
  { date: '15/10', ife: 70, sentimento: 65 },
  { date: '22/10', ife: 71, sentimento: 66 },
  { date: '29/10', ife: 72, sentimento: 68 },
]

const topicsData = [
  { tema: 'Saúde', mencoes: 45, sentimento: 72 },
  { tema: 'Educação', mencoes: 38, sentimento: 68 },
  { tema: 'Segurança', mencoes: 32, sentimento: 65 },
  { tema: 'Economia', mencoes: 28, sentimento: 70 },
  { tema: 'Infraestrutura', mencoes: 22, sentimento: 75 },
]

export default function Home() {
  const [kpis, setKpis] = useState<KPI[]>(mockKPIs)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Buscar KPIs da API
    fetch('/api/dashboard/kpis')
      .then((res) => res.json())
      .then((data) => {
        if (data.ife) {
          setKpis([
            {
              id: 'ife',
              label: 'Índice de Força Eleitoral',
              value: data.ife.value,
              variation: data.ife.variation,
              status: data.ife.status,
            },
            {
              id: 'presenca',
              label: 'Presença Territorial',
              value: data.presenca.value,
              variation: data.presenca.variation,
              status: data.presenca.status,
            },
            {
              id: 'base',
              label: 'Capilaridade da Base',
              value: data.base.value,
              variation: data.base.variation,
              status: data.base.status,
            },
            {
              id: 'engajamento',
              label: 'Engajamento Útil',
              value: data.engajamento.value,
              variation: data.engajamento.variation,
              status: data.engajamento.status,
            },
            {
              id: 'sentimento',
              label: 'Sentimento Público',
              value: `${data.sentimento.value}%`,
              variation: data.sentimento.variation,
              status: data.sentimento.status,
            },
            {
              id: 'risco',
              label: 'Risco de Crise',
              value: data.risco.value,
              variation: data.risco.variation,
              status: data.risco.status,
            },
          ])
        }
        setLoading(false)
      })
      .catch((error) => {
        console.error('Erro ao carregar KPIs:', error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Header title="Visão Geral" subtitle="Dashboard Executivo - Visão estratégica em 30 segundos" />

      <div className="px-4 py-6 lg:px-6">
        {/* Linha 1 - KPIs Centrais */}
        <section className="mb-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 bg-surface rounded-2xl border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {kpis.map((kpi) => (
                <KPICard key={kpi.id} kpi={kpi} href={`/${kpi.id}`} />
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Linha 2 - Leitura Estratégica */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gráfico de Tendência */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-strong">Tendência IFE + Sentimento</h2>
                <span className="text-sm text-text-muted">Últimos 30 dias</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorIfe" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1E4ED8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1E4ED8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSentimento" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={12} />
                    <YAxis stroke="#64748B" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="ife"
                      stroke="#1E4ED8"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIfe)"
                      name="IFE"
                    />
                    <Area
                      type="monotone"
                      dataKey="sentimento"
                      stroke="#16A34A"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSentimento)"
                      name="Sentimento"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 5 Temas Emergentes */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Top 5 Temas Emergentes</h2>
              <div className="space-y-3">
                {topicsData.map((topic, index) => (
                  <div
                    key={topic.tema}
                    className="flex items-center justify-between p-3 rounded-xl bg-background hover:bg-primary-soft transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-strong">{topic.tema}</p>
                        <p className="text-xs text-text-muted">{topic.mencoes} menções</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-text-strong">{topic.sentimento}%</p>
                        <p className="text-xs text-text-muted">Sentimento</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Territórios Frios */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-status-warning" />
                  Territórios Frios (Alerta)
                </h2>
              </div>
              <div className="space-y-3">
                {[
                  { cidade: 'São Paulo', motivo: 'Baixa presença + alta demanda' },
                  { cidade: 'Rio de Janeiro', motivo: 'Sentimento em queda' },
                  { cidade: 'Belo Horizonte', motivo: 'Base inativa' },
                ].map((territorio) => (
                  <div
                    key={territorio.cidade}
                    className="p-3 rounded-xl border border-status-warning/30 bg-status-warning/5 hover:bg-status-warning/10 transition-colors"
                  >
                    <p className="text-sm font-medium text-text-strong">{territorio.cidade}</p>
                    <p className="text-xs text-text-muted mt-1">{territorio.motivo}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Coluna Direita - Ações e Alertas */}
          <div className="space-y-6">
            {/* Alertas Críticos */}
            <div>
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-error" />
                Alertas Críticos
              </h2>
              <div className="space-y-3">
                {mockAlerts.filter((a) => a.type === 'critical').map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>

            {/* Pendências Jurídicas */}
            <div>
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-status-warning" />
                Pendências Jurídicas
              </h2>
              <div className="space-y-3">
                {mockAlerts.filter((a) => a.type === 'warning').map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>

            {/* Ações Recomendadas */}
            <div className="bg-beige rounded-2xl border border-beige-dark p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">
                Ações Recomendadas Automáticas
              </h2>
              <div className="space-y-3">
                {mockActions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </div>

            {/* Próximas 24h */}
            <div className="bg-primary-soft rounded-2xl border border-primary/30 p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Próximas 24h</h2>
              <div className="space-y-3">
                {[
                  { hora: '09:00', evento: 'Agenda: Visita a São Paulo', tipo: 'Agenda' },
                  { hora: '14:00', evento: 'Entrevista - TV Local', tipo: 'Mídia' },
                  { hora: '16:00', evento: 'Reunião - Coordenação', tipo: 'Reunião' },
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="text-sm font-medium text-primary">{item.hora}</div>
                    <div className="flex-1">
                      <p className="text-sm text-text-strong">{item.evento}</p>
                      <p className="text-xs text-text-muted">{item.tipo}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

