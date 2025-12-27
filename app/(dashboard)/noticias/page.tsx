'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { AlertCard } from '@/components/alert-card'
import { mockNews, mockAlerts } from '@/lib/mock-data'
import { Newspaper, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { KPI } from '@/types'
import { formatDate } from '@/lib/utils'

const noticiasKPIs: KPI[] = [
  {
    id: 'mencoes',
    label: 'Menções 24h',
    value: '142',
    variation: 12,
    status: 'success',
  },
  {
    id: 'risco',
    label: 'Risco Alto Aberto',
    value: 2,
    variation: -1,
    status: 'warning',
  },
  {
    id: 'resposta',
    label: 'Tempo de Resposta',
    value: '2.5h',
    variation: -0.5,
    status: 'success',
  },
  {
    id: 'share',
    label: 'Share of Voice',
    value: '42%',
    variation: 3.2,
    status: 'success',
  },
]

const sentimentColors = {
  positive: 'bg-status-success/10 text-status-success border-status-success/30',
  negative: 'bg-status-error/10 text-status-error border-status-error/30',
  neutral: 'bg-primary-soft text-primary border-primary/30',
}

const riskColors = {
  high: 'bg-status-error/10 text-status-error',
  medium: 'bg-status-warning/10 text-status-warning',
  low: 'bg-status-success/10 text-status-success',
}

export default function NoticiasPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Notícias, Crises & Radar de Adversários" subtitle="Sala de Situação" />

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {noticiasKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inbox de Notícias */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-strong flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-primary" />
                  Inbox de Notícias
                </h2>
                <button className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                  Gerar Resposta
                </button>
              </div>

              <div className="space-y-4">
                {mockNews.map((news) => (
                  <div
                    key={news.id}
                    className="p-4 rounded-xl border border-border hover:border-primary/20 hover:shadow-card transition-all duration-200 ease-premium"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-text-strong mb-1">{news.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-text-muted mb-3">
                          <span>{news.source}</span>
                          <span>•</span>
                          <span>{news.timestamp ? formatDate(news.timestamp) : '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-lg border ${sentimentColors[news.sentiment]}`}
                      >
                        {news.sentiment === 'positive'
                          ? 'Positivo'
                          : news.sentiment === 'negative'
                          ? 'Negativo'
                          : 'Neutro'}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-lg ${riskColors[news.risk || 'low']}`}
                      >
                        Risco {news.risk === 'high' ? 'Alto' : news.risk === 'medium' ? 'Médio' : 'Baixo'}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium bg-primary-soft text-primary rounded-lg">
                        {news.theme}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar de Adversários */}
            <div className="mt-6 bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Radar de Adversários</h2>

              <div className="space-y-4">
                {[
                  {
                    adversario: 'Adversário A',
                    temas: ['Saúde', 'Educação'],
                    ataques: '3 ataques diretos',
                    presenca: '38%',
                  },
                  {
                    adversario: 'Adversário B',
                    temas: ['Economia', 'Segurança'],
                    ataques: '1 ataque indireto',
                    presenca: '28%',
                  },
                ].map((adversario, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border bg-background"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-text-strong">{adversario.adversario}</h3>
                      <span className="text-xs text-text-muted">Presença: {adversario.presenca}</span>
                    </div>
                    <p className="text-xs text-text-muted mb-2">{adversario.ataques}</p>
                    <div className="flex flex-wrap gap-2">
                      {adversario.temas.map((tema) => (
                        <span
                          key={tema}
                          className="px-2 py-1 text-xs bg-status-error/10 text-status-error rounded-lg"
                        >
                          {tema}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alertas Críticos */}
          <div>
            <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-error" />
                Alertas Críticos
              </h2>
              <div className="space-y-3">
                {mockAlerts.filter((a) => a.type === 'critical').map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>

            {/* Temas em Alta */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Temas em Alta
              </h2>
              <div className="space-y-3">
                {[
                  { tema: 'Saúde', mencoes: 45, tendencia: '+12%' },
                  { tema: 'Educação', mencoes: 38, tendencia: '+8%' },
                  { tema: 'Segurança', mencoes: 32, tendencia: '+5%' },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-background"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-strong">{item.tema}</p>
                      <p className="text-xs text-text-muted">{item.mencoes} menções</p>
                    </div>
                    <span className="text-sm font-semibold text-status-success">{item.tendencia}</span>
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

