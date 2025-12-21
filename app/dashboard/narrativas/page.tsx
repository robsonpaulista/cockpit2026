'use client'

import { Header } from '@/components/header'
import { FileText, TrendingUp, AlertTriangle, MessageSquare } from 'lucide-react'

const narrativas = [
  {
    id: '1',
    tema: 'Saúde',
    publico: 'Famílias',
    mensagem: 'Garantir acesso universal à saúde',
    argumentos: ['Ampliação de postos', 'Medicamentos gratuitos'],
    uso: 45,
    performance: 85,
    status: 'ativa',
  },
  {
    id: '2',
    tema: 'Educação',
    publico: 'Jovens e pais',
    mensagem: 'Educação de qualidade para todos',
    argumentos: ['Escolas renovadas', 'Bolsa estudantil'],
    uso: 32,
    performance: 78,
    status: 'ativa',
  },
]

export default function NarrativasPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Banco de Narrativas" subtitle="Garanta coerência e evite improviso" />

      <div className="px-4 py-6 lg:px-6">
        <div className="mb-6">
          <button className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
            Nova Narrativa
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {narrativas.map((narrativa) => (
            <div
              key={narrativa.id}
              className="bg-surface rounded-2xl border border-border p-6 hover:shadow-card-hover transition-all duration-200 ease-premium"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-text-strong">{narrativa.tema}</h3>
                  <p className="text-sm text-text-muted mt-1">Público: {narrativa.publico}</p>
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-primary-soft text-primary rounded-lg">
                  {narrativa.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-text-strong mb-2">Mensagem-chave</p>
                <p className="text-sm text-text-muted">{narrativa.mensagem}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-text-strong mb-2">Argumentos</p>
                <ul className="space-y-1">
                  {narrativa.argumentos.map((arg, idx) => (
                    <li key={idx} className="text-sm text-text-muted flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{arg}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-muted">{narrativa.uso} usos</span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-text-muted" />
                  <span className="text-sm text-text-muted">{narrativa.performance}% performance</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

