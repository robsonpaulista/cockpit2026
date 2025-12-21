'use client'

import { Header } from '@/components/header'
import { Settings, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

export default function OperacaoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Operação & Equipe" subtitle="Garanta ritmo e escala" />

      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface rounded-2xl border border-border p-6">
            <p className="text-sm text-text-muted mb-2">Backlog</p>
            <p className="text-3xl font-semibold text-text-strong">24</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-6">
            <p className="text-sm text-text-muted mb-2">SLA Cumprido</p>
            <p className="text-3xl font-semibold text-text-strong">92%</p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-6">
            <p className="text-sm text-text-muted mb-2">Gargalos</p>
            <p className="text-3xl font-semibold text-text-strong">3</p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-strong mb-6">Kanban por Área</h2>
          <p className="text-sm text-text-muted">Gestão de tarefas em desenvolvimento...</p>
        </div>
      </div>
    </div>
  )
}

