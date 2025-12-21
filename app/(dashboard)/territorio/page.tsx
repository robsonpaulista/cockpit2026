'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { MapPin, Users, TrendingDown } from 'lucide-react'
import { KPI } from '@/types'

const territorioKPIs: KPI[] = [
  {
    id: 'liderancas',
    label: 'Lideranças Ativas',
    value: 1280,
    variation: 12,
    status: 'success',
  },
  {
    id: 'conversao',
    label: 'Conversão no Funil',
    value: '68%',
    variation: 5.2,
    status: 'success',
  },
  {
    id: 'cidades-frias',
    label: 'Cidades Frias',
    value: 8,
    variation: -2,
    status: 'success',
  },
]

const liderancas = [
  { nome: 'João Silva', cidade: 'São Paulo', score: 85, status: 'ativo' },
  { nome: 'Maria Santos', cidade: 'Campinas', score: 78, status: 'ativo' },
  { nome: 'Pedro Costa', cidade: 'Santos', score: 65, status: 'inativo' },
]

export default function TerritorioPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Território & Base" subtitle="CRM Político - Organize articulação e apoio real" />

      <div className="px-4 py-6 lg:px-6">
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {territorioKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-strong mb-6">Lideranças</h2>
          <div className="space-y-3">
            {liderancas.map((lider, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border hover:border-primary/20 hover:shadow-card transition-all duration-200 ease-premium"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-soft">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-strong">{lider.nome}</p>
                      <p className="text-xs text-text-muted">{lider.cidade}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-strong">Score: {lider.score}</p>
                      <p className="text-xs text-text-muted">{lider.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

