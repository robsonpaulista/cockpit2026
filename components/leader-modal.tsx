'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { TerritoryLeader, Territory } from '@/types'

interface LeaderModalProps {
  leader?: TerritoryLeader | null
  territories: Territory[]
  onClose: () => void
  onSave: (leader: Omit<TerritoryLeader, 'id' | 'created_at' | 'updated_at' | 'territory'>) => Promise<void>
  initialTerritoryId?: string
}

export function LeaderModal({ leader, territories, onClose, onSave, initialTerritoryId }: LeaderModalProps) {
  const [formData, setFormData] = useState({
    territory_id: leader?.territory_id || initialTerritoryId || '',
    name: leader?.name || '',
    phone: leader?.phone || '',
    email: leader?.email || '',
    role: leader?.role || '',
    status: leader?.status || 'ativo' as 'ativo' | 'inativo',
    notes: leader?.notes || '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (leader) {
      setFormData({
        territory_id: leader.territory_id,
        name: leader.name,
        phone: leader.phone || '',
        email: leader.email || '',
        role: leader.role || '',
        status: leader.status,
        notes: leader.notes || '',
      })
    } else if (initialTerritoryId) {
      setFormData(prev => ({ ...prev, territory_id: initialTerritoryId }))
    }
  }, [leader, initialTerritoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('Erro ao salvar líder:', error)
      alert('Erro ao salvar líder')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface rounded-2xl border border-card w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-surface border-b border-card p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {leader ? 'Editar Líder' : 'Novo Líder'}
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
            <label className="block text-sm font-medium text-primary mb-2">
              Território *
            </label>
            <select
              value={formData.territory_id}
              onChange={(e) => setFormData({ ...formData, territory_id: e.target.value })}
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

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Nome *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              required
            />
          </div>

          {/* Telefone e Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              />
            </div>
          </div>

          {/* Cargo e Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Cargo/Função
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Ex: Coordenador Regional"
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-card">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary bg-background rounded-lg hover:bg-background/80 transition-colors"
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

