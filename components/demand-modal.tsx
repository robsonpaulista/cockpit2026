'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
}

interface Agenda {
  id: string
  date: string
  city_id?: string
  type: string
  status: string
  cities?: {
    id: string
    name: string
    state: string
  }
}

interface Demand {
  id?: string
  title: string
  description?: string
  status?: string
  theme?: string
  priority?: string
  visit_id?: string
  sla_deadline?: string
}

interface DemandModalProps {
  demand: Demand | null
  onClose: () => void
  onSuccess: () => void
}

export function DemandModal({ demand, onClose, onSuccess }: DemandModalProps) {
  const [formData, setFormData] = useState({
    title: demand?.title || '',
    description: demand?.description || '',
    theme: demand?.theme || '',
    priority: demand?.priority || 'medium',
    visit_id: demand?.visit_id || '',
    sla_deadline: demand?.sla_deadline || '',
  })
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [loadingAgendas, setLoadingAgendas] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Sempre buscar agendas (pode querer associar ou re-associar)
    fetchAgendas()
    
    // Se está editando, preencher formData com dados da demanda
    if (demand?.id) {
      setFormData({
        title: demand.title || '',
        description: demand.description || '',
        theme: demand.theme || '',
        priority: (demand.priority as 'high' | 'medium' | 'low') || 'medium',
        visit_id: demand.visit_id || '',
        sla_deadline: demand.sla_deadline || '',
      })
    }
  }, [demand])

  const fetchAgendas = async () => {
    try {
      setLoadingAgendas(true)
      const response = await fetch('/api/campo/agendas')
      if (response.ok) {
        const data = await response.json()
        setAgendas(data)
      }
    } catch (error) {
      console.error('Erro ao buscar agendas:', error)
    } finally {
      setLoadingAgendas(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = demand?.id ? `/api/campo/demands/${demand.id}` : '/api/campo/demands'
      const method = demand?.id ? 'PUT' : 'POST'

      const payload: any = {
        title: formData.title,
        description: formData.description || undefined,
        theme: formData.theme || undefined,
        priority: formData.priority as 'high' | 'medium' | 'low',
      }

      // Apenas definir status ao criar (nova)
      if (!demand?.id) {
        payload.status = 'nova'
      }

      if (formData.visit_id) {
        payload.visit_id = formData.visit_id
      }

      if (formData.sla_deadline) {
        payload.sla_deadline = formData.sla_deadline
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar demanda')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar demanda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary">
            {demand?.id ? 'Editar Demanda' : 'Nova Demanda'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Título da Demanda *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Asfaltar rua principal do bairro X"
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Detalhes da demanda, contexto, observações..."
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Tema
              </label>
              <select
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Selecione um tema</option>
                <option value="infraestrutura">Infraestrutura</option>
                <option value="saude">Saúde</option>
                <option value="educacao">Educação</option>
                <option value="seguranca">Segurança</option>
                <option value="meio-ambiente">Meio Ambiente</option>
                <option value="social">Social</option>
                <option value="economia">Economia</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Prioridade *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                required
                className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          {!demand?.id && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Associar a uma Agenda (Opcional)
              </label>
              {loadingAgendas ? (
                <div className="w-full px-4 py-2 border border-card rounded-lg bg-background animate-pulse">
                  <span className="text-sm text-secondary">Carregando agendas...</span>
                </div>
              ) : (
                <select
                  value={formData.visit_id}
                  onChange={(e) => setFormData({ ...formData, visit_id: e.target.value })}
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                >
                  <option value="">Não associar a nenhuma agenda</option>
                  {agendas.map((agenda) => (
                    <option key={agenda.id} value={agenda.id}>
                      {formatDate(agenda.date)} - {agenda.cities?.name || 'Sem cidade'} - {agenda.type}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-secondary mt-1">
                Você pode associar esta demanda a uma agenda existente ou criar independentemente
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Prazo SLA (Opcional)
            </label>
            <input
              type="date"
              value={formData.sla_deadline}
              onChange={(e) => setFormData({ ...formData, sla_deadline: e.target.value })}
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <p className="text-xs text-secondary mt-1">
              Data limite para resolução desta demanda
            </p>
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
              className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : demand?.id ? 'Atualizar' : 'Criar Demanda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

