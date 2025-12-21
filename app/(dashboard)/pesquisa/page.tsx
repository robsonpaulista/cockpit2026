'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { BarChart3, TrendingUp, MessageSquare } from 'lucide-react'
import { KPI } from '@/types'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const pesquisaKPIs: KPI[] = [
  {
    id: 'intencao',
    label: 'Intenção de Voto',
    value: '42%',
    variation: 3.2,
    status: 'success',
  },
  {
    id: 'rejeicao',
    label: 'Rejeição',
    value: '18%',
    variation: -2.1,
    status: 'success',
  },
  {
    id: 'recall',
    label: 'Recall',
    value: '78%',
    variation: 5.4,
    status: 'success',
  },
]

const pesquisaData = [
  { data: '01/10', intencao: 38, rejeicao: 22 },
  { data: '08/10', intencao: 40, rejeicao: 20 },
  { data: '15/10', intencao: 41, rejeicao: 19 },
  { data: '22/10', intencao: 42, rejeicao: 18 },
]

export default function PesquisaPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Pesquisa & Relato de Rua" subtitle="Dado quantitativo + percepção qualitativa" />

      <div className="px-4 py-6 lg:px-6">
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {pesquisaKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold text-text-strong mb-6">Tendência</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pesquisaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="data" stroke="#64748B" fontSize={12} />
                  <YAxis stroke="#64748B" fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="intencao" stroke="#1E4ED8" strokeWidth={2} name="Intenção" />
                  <Line type="monotone" dataKey="rejeicao" stroke="#DC2626" strokeWidth={2} name="Rejeição" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6">
            <h2 className="text-lg font-semibold text-text-strong mb-6">Relato de Rua</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-background">
                <p className="text-sm font-medium text-text-strong mb-2">Humor do eleitor</p>
                <p className="text-sm text-text-muted">Positivo em 68% das interações</p>
              </div>
              <div className="p-4 rounded-xl bg-background">
                <p className="text-sm font-medium text-text-strong mb-2">Frases recorrentes</p>
                <p className="text-sm text-text-muted">"Precisa melhorar saúde"</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

