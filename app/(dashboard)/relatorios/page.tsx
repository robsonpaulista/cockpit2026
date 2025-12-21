'use client'

import { Header } from '@/components/header'
import { FileBarChart, Download, Calendar } from 'lucide-react'

const relatorios = [
  { tipo: 'Diário', descricao: 'Relatório operacional diário', periodo: 'Últimos 7 dias' },
  { tipo: 'Semanal', descricao: 'Relatório estratégico semanal', periodo: 'Últimas 4 semanas' },
  { tipo: 'Mensal', descricao: 'Relatório tático mensal', periodo: 'Últimos 3 meses' },
]

export default function RelatoriosPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Relatórios" subtitle="Decisão baseada em fatos" />

      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {relatorios.map((relatorio, idx) => (
            <div
              key={idx}
              className="bg-surface rounded-2xl border border-border p-6 hover:shadow-card-hover transition-all duration-200 ease-premium"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary-soft">
                  <FileBarChart className="w-5 h-5 text-primary" />
                </div>
                <button className="p-2 rounded-lg hover:bg-background transition-colors">
                  <Download className="w-4 h-4 text-text-muted" />
                </button>
              </div>
              <h3 className="text-lg font-semibold text-text-strong mb-2">{relatorio.tipo}</h3>
              <p className="text-sm text-text-muted mb-4">{relatorio.descricao}</p>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Calendar className="w-3 h-3" />
                <span>{relatorio.periodo}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

