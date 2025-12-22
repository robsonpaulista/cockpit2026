'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Edit2, RefreshCw } from 'lucide-react'

interface Adversary {
  id: string
  name: string
  type?: 'candidate' | 'party' | 'media' | 'influencer' | 'other'
  themes?: string[]
  presence_score?: number
  google_alerts_rss_url?: string
}

interface AdversaryManagerModalProps {
  onClose: () => void
  onUpdate?: () => void
}

const adversaryTypes = [
  { value: 'candidate', label: 'Candidato' },
  { value: 'party', label: 'Partido' },
  { value: 'media', label: 'Mídia' },
  { value: 'influencer', label: 'Influenciador' },
  { value: 'other', label: 'Outro' },
]

const commonThemes = [
  'Saúde',
  'Educação',
  'Infraestrutura',
  'Segurança',
  'Economia',
  'Meio Ambiente',
  'Social',
  'Política',
]

export function AdversaryManagerModal({ onClose, onUpdate }: AdversaryManagerModalProps) {
  const [adversaries, setAdversaries] = useState<Adversary[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAdversary, setEditingAdversary] = useState<Adversary | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'other' as Adversary['type'],
    themes: [] as string[],
    presence_score: 0,
    google_alerts_rss_url: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [collectingNews, setCollectingNews] = useState<string | null>(null) // ID do adversário sendo coletado
  const [collectingAll, setCollectingAll] = useState(false)

  useEffect(() => {
    fetchAdversaries()
  }, [])

  const fetchAdversaries = async () => {
    try {
      const response = await fetch('/api/noticias/adversarios')
      if (response.ok) {
        const data = await response.json()
        setAdversaries(data)
      }
    } catch (error) {
      console.error('Erro ao buscar adversários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingAdversary
        ? `/api/noticias/adversarios/${editingAdversary.id}`
        : '/api/noticias/adversarios'
      const method = editingAdversary ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setFormData({ name: '', type: 'other', themes: [], presence_score: 0, google_alerts_rss_url: '' })
        setShowAddForm(false)
        setEditingAdversary(null)
        fetchAdversaries()
        if (onUpdate) onUpdate()
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao salvar adversário')
      }
    } catch (error) {
      alert('Erro ao salvar adversário')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (adversary: Adversary) => {
    setEditingAdversary(adversary)
    setFormData({
      name: adversary.name,
      type: adversary.type || 'other',
      themes: adversary.themes || [],
      presence_score: adversary.presence_score || 0,
      google_alerts_rss_url: adversary.google_alerts_rss_url || '',
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este adversário?')) return

    try {
      const response = await fetch(`/api/noticias/adversarios/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchAdversaries()
        if (onUpdate) onUpdate()
      } else {
        alert('Erro ao remover adversário')
      }
    } catch (error) {
      alert('Erro ao remover adversário')
    }
  }

  const toggleTheme = (theme: string) => {
    setFormData((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }))
  }

  const handleCollectNews = async (adversaryId?: string) => {
    if (adversaryId) {
      setCollectingNews(adversaryId)
    } else {
      setCollectingAll(true)
    }

    try {
      const response = await fetch('/api/noticias/adversarios/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adversaryId ? { adversary_id: adversaryId } : {}),
      })

      const result = await response.json()

      if (response.ok) {
        alert(
          `Coleta concluída!\n${result.message}\n` +
          `Notícias coletadas: ${result.collected}\n` +
          `Alto risco: ${result.high_risk}\n` +
          `Ataques detectados: ${result.attacks_detected || 0}`
        )
        fetchAdversaries()
        if (onUpdate) onUpdate()
      } else {
        alert(result.error || 'Erro ao coletar notícias')
      }
    } catch (error) {
      alert('Erro ao coletar notícias')
      console.error('Erro ao coletar notícias:', error)
    } finally {
      setCollectingNews(null)
      setCollectingAll(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-strong">
            Gerenciar Adversários
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Lista de Adversários */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
            ))}
          </div>
        ) : adversaries.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-text-muted mb-4">Nenhum adversário cadastrado ainda.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Adicionar Primeiro Adversário
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {adversaries.map((adversary) => (
              <div
                key={adversary.id}
                className="p-4 rounded-xl border border-border bg-background"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-text-strong">
                        {adversary.name}
                      </h3>
                      {adversary.type && (
                        <span className="px-2 py-0.5 text-xs rounded-lg bg-primary-soft text-primary">
                          {adversaryTypes.find((t) => t.value === adversary.type)?.label ||
                            'Outro'}
                        </span>
                      )}
                      {adversary.presence_score !== undefined && (
                        <span className="px-2 py-0.5 text-xs rounded-lg bg-status-warning/10 text-status-warning">
                          {adversary.presence_score}% presença
                        </span>
                      )}
                    {adversary.google_alerts_rss_url && (
                      <span className="px-2 py-0.5 text-xs rounded-lg bg-primary/10 text-primary">
                        Feed RSS configurado
                      </span>
                    )}
                  </div>
                  {adversary.themes && adversary.themes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {adversary.themes.map((theme, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-status-error/10 text-status-error rounded-lg"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  )}
                  {adversary.google_alerts_rss_url && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <button
                        onClick={() => handleCollectNews(adversary.id)}
                        disabled={collectingNews === adversary.id || collectingAll}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-3 h-3 ${collectingNews === adversary.id ? 'animate-spin' : ''}`} />
                        {collectingNews === adversary.id ? 'Coletando...' : 'Coletar Notícias'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(adversary)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(adversary.id)}
                    className="p-2 text-status-error hover:bg-status-error/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Formulário de Adicionar/Editar */}
        {showAddForm && (
          <div className="border-t border-border pt-6 mt-6">
            <h3 className="text-sm font-semibold text-text-strong mb-4">
              {editingAdversary ? 'Editar Adversário' : 'Adicionar Novo Adversário'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  Nome do Adversário *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Candidato X, Partido Y, Jornal Z"
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as Adversary['type'] })
                  }
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
                >
                  {adversaryTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  Temas que Aborda
                </label>
                <div className="flex flex-wrap gap-2">
                  {commonThemes.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => toggleTheme(theme)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        formData.themes.includes(theme)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface border-border text-text-strong hover:border-primary/50'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                {formData.themes.length > 0 && (
                  <p className="text-xs text-text-muted mt-2">
                    {formData.themes.length} tema(s) selecionado(s)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  Share of Voice (Presença) - 0 a 100
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.presence_score}
                  onChange={(e) =>
                    setFormData({ ...formData, presence_score: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
                />
                <p className="text-xs text-text-muted mt-1">
                  Percentual de presença nas notícias (calculado automaticamente)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-strong mb-2">
                  URL do Feed RSS do Google Alerts
                </label>
                <input
                  type="url"
                  value={formData.google_alerts_rss_url}
                  onChange={(e) =>
                    setFormData({ ...formData, google_alerts_rss_url: e.target.value })
                  }
                  placeholder="https://www.google.com/alerts/feeds/..."
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft"
                />
                <p className="text-xs text-text-muted mt-1">
                  URL do feed RSS do Google Alerts para monitorar este adversário automaticamente
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? 'Salvando...'
                    : editingAdversary
                    ? 'Atualizar'
                    : 'Adicionar Adversário'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingAdversary(null)
                    setFormData({ name: '', type: 'other', themes: [], presence_score: 0, google_alerts_rss_url: '' })
                  }}
                  className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Botões de Ação */}
        {!showAddForm && (
          <div className="space-y-2">
            {adversaries.some(a => a.google_alerts_rss_url) && (
              <button
                onClick={() => handleCollectNews()}
                disabled={collectingAll}
                className="w-full px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${collectingAll ? 'animate-spin' : ''}`} />
                {collectingAll ? 'Coletando Notícias de Todos os Adversários...' : 'Coletar Notícias de Todos os Adversários'}
              </button>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Novo Adversário
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

