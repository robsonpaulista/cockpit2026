'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { MessageCircle, Users, MousePointerClick } from 'lucide-react'
import { KPI } from '@/types'

const whatsappKPIs: KPI[] = [
  {
    id: 'opt-in',
    label: 'Crescimento Opt-in',
    value: '1.2K',
    variation: 15,
    status: 'success',
  },
  {
    id: 'resposta',
    label: 'Taxa de Resposta',
    value: '42%',
    variation: 8,
    status: 'success',
  },
  {
    id: 'ctr',
    label: 'CTR',
    value: '18%',
    variation: 3,
    status: 'success',
  },
]

export default function WhatsAppPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="WhatsApp & Comunidades" subtitle="Comunicação direta, segmentada e mensurável" />

      <div className="px-4 py-6 lg:px-6">
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {whatsappKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="bg-surface rounded-2xl border border-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-6">Campanhas</h2>
          <p className="text-sm text-secondary">Gestão de campanhas WhatsApp em desenvolvimento...</p>
        </div>
      </div>
    </div>
  )
}

