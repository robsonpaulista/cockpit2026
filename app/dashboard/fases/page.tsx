'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, Edit2, Trash2, Power } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface CampaignPhase {
  id: string
  name: string
  start_date: string
  end_date: string
  active: boolean
  indicators: string[]
  restrictions: string[]
  automations: string[]
  created_at?: string
  updated_at?: string
}

export default function FasesPage() {
  const [phases, setPhases] = useState<CampaignPhase[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPhase, setEditingPhase] = useState<CampaignPhase | null>(null)

  useEffect(() => {
    fetchPhases()
  }, [])

  const fetchPhases = async () => {
    try {
      const response = await fetch('/api/fases')
      if (response.ok) {
        const data = await response.json()
        setPhases(data)
      }
    } catch (error) {
      console.error('Erro ao buscar fases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      const response = await fetch(`/api/fases/${id}/activate`, {
        method: 'POST',
      })

      if (response.ok) {
        fetchPhases()
      }
    } catch (error) {
      console.error('Erro ao ativar fase:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta fase?')) {
      return
    }

    try {
      const response = await fetch(`/api/fases/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchPhases()
      }
    } catch (error) {
      console.error('Erro ao excluir fase:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="Painel de Fases da Campanha" />
        <div className="px-4 py-6 lg:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-surface rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Painel de Fases da Campanha" subtitle="Adapte o sistema ao calendário eleitoral" />

      <div className="px-4 py-6 lg:px-6">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-text-muted">
            O sistema se adapta automaticamente conforme a fase eleitoral ativa, ajustando métricas,
            restrições jurídicas e automações disponíveis.
          </p>
          <button
            onClick={() => {
              setEditingPhase(null)
              setShowModal(true)
            }}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Fase
          </button>
        </div>

        {phases.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-text-muted mb-4">Nenhuma fase cadastrada ainda.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Criar Primeira Fase
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {phases.map((phase) => (
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
                      <span>{formatDate(new Date(phase.start_date))}</span>
                      <span>→</span>
                      <span>{formatDate(new Date(phase.end_date))}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {phase.active && (
                      <span className="px-3 py-1 text-xs font-medium bg-primary text-white rounded-full">
                        Ativa
                      </span>
                    )}
                    <button
                      onClick={() => handleActivate(phase.id)}
                      className="p-2 rounded-lg hover:bg-background transition-colors"
                      title={phase.active ? 'Desativar' : 'Ativar'}
                    >
                      <Power className={`w-4 h-4 ${phase.active ? 'text-primary' : 'text-text-muted'}`} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingPhase(phase)
                        setShowModal(true)
                      }}
                      className="p-2 rounded-lg hover:bg-background transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4 text-text-muted" />
                    </button>
                    <button
                      onClick={() => handleDelete(phase.id)}
                      className="p-2 rounded-lg hover:bg-status-error/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-status-error" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Indicadores Prioritários */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Indicadores Prioritários
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {phase.indicators?.length > 0 ? (
                        phase.indicators.map((indicator, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs bg-primary-soft text-primary rounded-lg"
                          >
                            {indicator}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted">Nenhum indicador definido</span>
                      )}
                    </div>
                  </div>

                  {/* Restrições */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-status-warning" />
                      Restrições
                    </h4>
                    <ul className="space-y-1">
                      {phase.restrictions?.length > 0 ? (
                        phase.restrictions.map((restriction, idx) => (
                          <li key={idx} className="text-sm text-text-muted flex items-start gap-2">
                            <span className="text-status-warning mt-1">•</span>
                            <span>{restriction}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-text-muted">Nenhuma restrição definida</li>
                      )}
                    </ul>
                  </div>

                  {/* Automações */}
                  <div>
                    <h4 className="text-sm font-semibold text-text-strong mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-status-success" />
                      Automações Ativas
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {phase.automations?.length > 0 ? (
                        phase.automations.map((automation, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs bg-status-success/10 text-status-success rounded-lg"
                          >
                            {automation}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted">Nenhuma automação definida</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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

      {/* Modal de Criação/Edição */}
      {showModal && (
        <PhaseModal
          phase={editingPhase}
          onClose={() => {
            setShowModal(false)
            setEditingPhase(null)
          }}
          onSuccess={() => {
            setShowModal(false)
            setEditingPhase(null)
            fetchPhases()
          }}
        />
      )}
    </div>
  )
}

// Componente Modal para criar/editar fase
interface PhaseModalProps {
  phase: CampaignPhase | null
  onClose: () => void
  onSuccess: () => void
}

function PhaseModal({ phase, onClose, onSuccess }: PhaseModalProps) {
  const [formData, setFormData] = useState({
    name: phase?.name || '',
    start_date: phase?.start_date || '',
    end_date: phase?.end_date || '',
    active: phase?.active || false,
    indicators: phase?.indicators?.join(', ') || '',
    restrictions: phase?.restrictions?.join(', ') || '',
    automations: phase?.automations?.join(', ') || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        name: formData.name,
        start_date: formData.start_date,
        end_date: formData.end_date,
        active: formData.active,
        indicators: formData.indicators.split(',').map((s) => s.trim()).filter(Boolean),
        restrictions: formData.restrictions.split(',').map((s) => s.trim()).filter(Boolean),
        automations: formData.automations.split(',').map((s) => s.trim()).filter(Boolean),
      }

      const url = phase ? `/api/fases/${phase.id}` : '/api/fases'
      const method = phase ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar fase')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar fase')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-strong">
            {phase ? 'Editar Fase' : 'Nova Fase'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Nome da Fase *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              placeholder="Ex: Campanha Oficial"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Data de Início *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Data de Fim *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-text-strong">Marcar como ativa</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Indicadores (separados por vírgula)
            </label>
            <input
              type="text"
              value={formData.indicators}
              onChange={(e) => setFormData({ ...formData, indicators: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              placeholder="IFE, Presença Territorial, Sentimento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Restrições (separadas por vírgula)
            </label>
            <input
              type="text"
              value={formData.restrictions}
              onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              placeholder="Sem conteúdo eleitoral explícito"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Automações (separadas por vírgula)
            </label>
            <input
              type="text"
              value={formData.automations}
              onChange={(e) => setFormData({ ...formData, automations: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
              placeholder="WhatsApp, Mobilização, Alertas Jurídicos"
            />
          </div>

          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : phase ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
