'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { Task, Territory, TerritoryLeader } from '@/types'

interface TaskModalProps {
  task?: Task | null
  territories: Territory[]
  leaders: TerritoryLeader[]
  onClose: () => void
  onSave: (task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'territory' | 'leader' | 'assigned_leader'>) => Promise<void>
  initialTerritoryId?: string
  initialStatus?: Task['status']
}

export function TaskModal({ task, territories, leaders, onClose, onSave, initialTerritoryId, initialStatus }: TaskModalProps) {
  const [formData, setFormData] = useState({
    territory_id: task?.territory_id || initialTerritoryId || '',
    leader_id: task?.leader_id || '',
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || initialStatus || 'backlog' as Task['status'],
    priority: task?.priority || 'media' as Task['priority'],
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    assigned_to: task?.assigned_to || '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (task) {
      setFormData({
        territory_id: task.territory_id,
        leader_id: task.leader_id || '',
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        assigned_to: task.assigned_to || '',
      })
    } else if (initialTerritoryId) {
      setFormData(prev => ({ ...prev, territory_id: initialTerritoryId }))
    }
    if (initialStatus) {
      setFormData(prev => ({ ...prev, status: initialStatus }))
    }
  }, [task, initialTerritoryId, initialStatus])

  // Filtrar líderes do território selecionado
  const filteredLeaders = formData.territory_id
    ? leaders.filter(l => l.territory_id === formData.territory_id && l.status === 'ativo')
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSave({
        ...formData,
        leader_id: formData.leader_id || undefined,
        assigned_to: formData.assigned_to || undefined,
        due_date: formData.due_date || undefined,
      })
      onClose()
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error)
      alert('Erro ao salvar tarefa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl border border-card w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-surface border-b border-card p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">
            {task ? 'Editar Tarefa' : 'Nova Tarefa'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Território */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Território *
            </label>
            <select
              value={formData.territory_id}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  territory_id: e.target.value,
                  leader_id: '', // Reset leader quando muda território
                  assigned_to: '', // Reset assigned quando muda território
                })
              }}
              className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              required
            >
              <option value="">Selecione um território</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              required
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
          </div>

          {/* Status, Prioridade e Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Task['status'] })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              >
                <option value="backlog">Backlog</option>
                <option value="em-andamento">Em Andamento</option>
                <option value="em-revisao">Em Revisão</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Prioridade
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              />
            </div>
          </div>

          {/* Líder Responsável e Líder Atribuído */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Líder Responsável
              </label>
              <select
                value={formData.leader_id}
                onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                disabled={!formData.territory_id}
              >
                <option value="">Nenhum</option>
                {filteredLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Atribuído a
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                disabled={!formData.territory_id}
              >
                <option value="">Nenhum</option>
                {filteredLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-card">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-primary bg-background rounded-lg hover:bg-background/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-accent-gold rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

