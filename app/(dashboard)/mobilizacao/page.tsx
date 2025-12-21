'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { Users, Activity, Share2 } from 'lucide-react'
import { KPI } from '@/types'

const mobilizacaoKPIs: KPI[] = [
  {
    id: 'voluntarios',
    label: 'Voluntários Ativos',
    value: 245,
    variation: 18,
    status: 'success',
  },
  {
    id: 'acoes',
    label: 'Ações Realizadas',
    value: 142,
    variation: 25,
    status: 'success',
  },
  {
    id: 'alcance',
    label: 'Alcance Indireto',
    value: '8.5K',
    variation: 12,
    status: 'success',
  },
]

export default function MobilizacaoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Mobilização & Voluntários" subtitle="Transforme apoio em multiplicação" />

      <div className="px-4 py-6 lg:px-6">
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {mobilizacaoKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="bg-surface rounded-2xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-strong">Cadastro de Voluntários</h2>
            <button className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
              Novo Voluntário
            </button>
          </div>
          <p className="text-sm text-text-muted">Gestão de voluntários em desenvolvimento...</p>
        </div>
      </div>
    </div>
  )
}

