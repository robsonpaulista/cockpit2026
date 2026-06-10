'use client'

import { KPICard } from '@/components/kpi-card'
import { WhatsAppContactsPanel } from '@/components/whatsapp-contacts-panel'
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
      <div className="px-4 py-6 lg:px-6">
        <section className="mb-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {whatsappKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <WhatsAppContactsPanel />

        <div className="mt-8 rounded-2xl border border-card bg-surface p-6">
          <h2 className="mb-2 text-lg font-semibold text-text-primary">Campanhas</h2>
          <p className="text-sm text-secondary">Gestão de campanhas WhatsApp em desenvolvimento...</p>
        </div>
      </div>
    </div>
  )
}
