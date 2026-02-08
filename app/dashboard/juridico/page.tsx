'use client'

import { Scale, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

export default function JuridicoPage() {
  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface rounded-2xl border border-card p-6">
            <p className="text-sm text-secondary mb-2">Peças Aprovadas</p>
            <p className="text-3xl font-semibold text-primary">145</p>
          </div>
          <div className="bg-surface rounded-2xl border border-card p-6">
            <p className="text-sm text-secondary mb-2">Pendências</p>
            <p className="text-3xl font-semibold text-status-warning">8</p>
          </div>
          <div className="bg-surface rounded-2xl border border-card p-6">
            <p className="text-sm text-secondary mb-2">Alertas Ativos</p>
            <p className="text-3xl font-semibold text-status-error">2</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-card p-6">
          <h2 className="text-lg font-semibold text-primary mb-6">Trilha de Aprovação</h2>
          <p className="text-sm text-secondary">Sistema de aprovação em desenvolvimento...</p>
        </div>
      </div>
    </div>
  )
}

