'use client'

import { Header } from '@/components/header'
import { mockPhases } from '@/lib/mock-data'
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default function FasesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Painel de Fases da Campanha" subtitle="Adapte o sistema ao calendário eleitoral" />

      <div className="px-4 py-6 lg:px-6">
        <div className="mb-6">
          <p className="text-sm text-text-muted">
            O sistema se adapta automaticamente conforme a fase eleitoral ativa, ajustando métricas,
            restrições jurídicas e automações disponíveis.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {mockPhases.map((phase) => (
            <div
              key={phase.id}
              className={`bg-surface rounded-2xl border-2 p-6 transition-all duration-200 ease-premium hover:shadow-card-hover ${
                phase.active
                  ? 'border-primary bg-primary-soft/30'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {phase.active ? (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5 text-text-muted" />
                    )}
                    <h3 className="text-xl font-semibold text-text-strong">{phase.name}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-text-muted">
                    <span>{formatDate(phase.startDate)}</span>
                    <span>→</span>
                    <span>{formatDate(phase.endDate)}</span>
                  </div>
                </div>
                {phase.active && (
                  <span className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-full">
                    Ativa
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Indicadores Prioritários */}
                <div>
                  <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Indicadores Prioritários
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {phase.indicators.map((indicator, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-primary-soft text-primary rounded-lg"
                      >
                        {indicator}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Restrições */}
                <div>
                  <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-status-warning" />
                    Restrições
                  </h4>
                  <ul className="space-y-1">
                    {phase.restrictions.map((restriction, idx) => (
                      <li key={idx} className="text-sm text-text-muted flex items-start gap-2">
                        <span className="text-status-warning mt-1">•</span>
                        <span>{restriction}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Automações */}
                <div>
                  <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-status-success" />
                    Automações Ativas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {phase.automations.map((automation, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 text-xs bg-status-success/10 text-status-success rounded-lg"
                      >
                        {automation}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-beige rounded-2xl border border-beige-dark p-6">
          <h3 className="text-lg font-semibold text-text-strong mb-2">
            Como funciona o sistema de fases?
          </h3>
          <p className="text-sm text-text-muted">
            Cada fase eleitoral possui configurações específicas que ajustam automaticamente as
            funcionalidades do sistema. Na reta final, por exemplo, o modo de alerta jurídico é
            ativado automaticamente, e certos tipos de conteúdo são restringidos conforme a legislação
            eleitoral vigente.
          </p>
        </div>
      </div>
    </div>
  )
}

