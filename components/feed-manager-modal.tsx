'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, RefreshCw, Edit2 } from 'lucide-react'

interface Feed {
  id: string
  name: string
  rss_url: string
  active: boolean
  auto_classify?: boolean
  last_collected_at?: string
  type: 'user_feed' | 'adversary_feed'
}

interface FeedManagerModalProps {
  onClose: () => void
  onCollect?: () => void
}

export function FeedManagerModal({ onClose, onCollect }: FeedManagerModalProps) {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    rss_url: '',
    auto_classify: true,
    type: 'user_feed' as 'user_feed' | 'adversary_feed',
  })
  const [submitting, setSubmitting] = useState(false)
  const [collecting, setCollecting] = useState(false)

  useEffect(() => {
    fetchFeeds()
  }, [])

  const fetchFeeds = async () => {
    try {
      const response = await fetch('/api/noticias/all-feeds')
      if (response.ok) {
        const data = await response.json()
        setFeeds(data)
      }
    } catch (error) {
      console.error('Erro ao buscar feeds:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (editingFeed) {
        // Atualizar feed existente
        if (editingFeed.type === 'user_feed') {
          const response = await fetch(`/api/noticias/feeds/${editingFeed.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              rss_url: formData.rss_url,
              auto_classify: formData.auto_classify,
            }),
          })
          if (!response.ok) {
            const error = await response.json()
            alert(error.error || 'Erro ao atualizar feed')
            return
          }
        } else {
          // Atualizar adversário
          const response = await fetch(`/api/noticias/adversarios/${editingFeed.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              google_alerts_rss_url: formData.rss_url,
            }),
          })
          if (!response.ok) {
            const error = await response.json()
            alert(error.error || 'Erro ao atualizar feed')
            return
          }
        }
      } else {
        // Criar novo feed
        if (formData.type === 'user_feed') {
          const response = await fetch('/api/noticias/feeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              rss_url: formData.rss_url,
              auto_classify: formData.auto_classify,
            }),
          })
          if (!response.ok) {
            const error = await response.json()
            alert(error.error || 'Erro ao adicionar feed')
            return
          }
        } else {
          // Criar novo adversário
          const response = await fetch('/api/noticias/adversarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              google_alerts_rss_url: formData.rss_url,
              type: 'other',
            }),
          })
          if (!response.ok) {
            const error = await response.json()
            alert(error.error || 'Erro ao adicionar feed')
            return
          }
        }
      }

      setFormData({ name: '', rss_url: '', auto_classify: true, type: 'user_feed' })
      setShowAddForm(false)
      setEditingFeed(null)
      fetchFeeds()
    } catch (error) {
      alert('Erro ao salvar feed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (feed: Feed) => {
    setEditingFeed(feed)
    setFormData({
      name: feed.name,
      rss_url: feed.rss_url,
      auto_classify: feed.auto_classify ?? true,
      type: feed.type,
    })
    setShowAddForm(true)
  }

  const handleDeleteFeed = async (feed: Feed) => {
    if (!confirm('Tem certeza que deseja remover este feed?')) return

    try {
      let response
      if (feed.type === 'user_feed') {
        response = await fetch(`/api/noticias/feeds/${feed.id}`, {
          method: 'DELETE',
        })
      } else {
        response = await fetch(`/api/noticias/adversarios/${feed.id}`, {
          method: 'DELETE',
        })
      }

      if (response.ok) {
        fetchFeeds()
      } else {
        alert('Erro ao remover feed')
      }
    } catch (error) {
      alert('Erro ao remover feed')
    }
  }

  const handleToggleActive = async (feed: Feed) => {
    if (feed.type === 'adversary_feed') {
      // Adversários não podem ser desativados dessa forma
      return
    }

    try {
      const response = await fetch(`/api/noticias/feeds/${feed.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !feed.active }),
      })

      if (response.ok) {
        fetchFeeds()
      }
    } catch (error) {
      alert('Erro ao atualizar feed')
    }
  }

  const handleCollectFromFeed = async (feed: Feed) => {
    try {
      let response
      if (feed.type === 'user_feed') {
        // Coletar de um feed específico do usuário
        response = await fetch('/api/noticias/collect/google-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rss_url: feed.rss_url,
            auto_classify: feed.auto_classify ?? true,
            feed_id: feed.id, // Incluir ID do feed
          }),
        })
      } else {
        // Coletar de um adversário específico
        response = await fetch('/api/noticias/adversarios/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adversary_id: feed.id,
          }),
        })
      }

      if (response.ok) {
        const result = await response.json()
        alert(`✅ ${result.collected || 0} notícias coletadas!`)
        if (onCollect) onCollect()
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao coletar notícias')
      }
    } catch (error) {
      alert('Erro ao coletar notícias')
    }
  }

  const handleCollect = async () => {
    setCollecting(true)
    try {
      // Coletar de todos os feeds ativos (do usuário e adversários)
      const userFeeds = feeds.filter(f => f.type === 'user_feed' && f.active)
      const adversaryFeeds = feeds.filter(f => f.type === 'adversary_feed')
      
      let totalCollected = 0
      let totalHighRisk = 0
      
      // Coletar de feeds do usuário
      if (userFeeds.length > 0) {
        const response = await fetch('/api/noticias/collect/my-feeds', {
          method: 'POST',
        })
        if (response.ok) {
          const result = await response.json()
          totalCollected += result.collected || 0
          totalHighRisk += result.high_risk || 0
        }
      }
      
      // Coletar de feeds de adversários
      if (adversaryFeeds.length > 0) {
        const response = await fetch('/api/noticias/adversarios/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Coletar de todos
        })
        if (response.ok) {
          const result = await response.json()
          totalCollected += result.collected || 0
          totalHighRisk += result.high_risk || 0
        }
      }
      
      alert(`✅ ${totalCollected} notícias coletadas!${totalHighRisk > 0 ? `\n⚠️ ${totalHighRisk} de alto risco.` : ''}`)
      fetchFeeds() // Atualizar lista para mostrar last_collected_at
      if (onCollect) onCollect()
    } catch (error) {
      alert('Erro ao coletar notícias')
    } finally {
      setCollecting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-primary">
            Gerenciar Feeds RSS
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Botão de Coletar Todos */}
        {feeds.length > 0 && (
          <div className="mb-6">
            <button
              onClick={handleCollect}
              disabled={collecting}
              className="w-full px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {collecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Coletando de todos os feeds...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Coletar de Todos os Feeds ({feeds.filter(f => f.active).length} ativos)
                </>
              )}
            </button>
          </div>
        )}

        {/* Lista de Feeds */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-background rounded-xl animate-pulse" />
            ))}
          </div>
        ) : feeds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-secondary mb-4">Nenhum feed configurado ainda.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
            >
              Adicionar Primeiro Feed
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {feeds.map((feed) => (
              <div
                key={`${feed.type}-${feed.id}`}
                className="p-4 rounded-xl border border-card bg-background"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-primary">{feed.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-lg ${
                          feed.type === 'adversary_feed'
                            ? 'bg-status-error/10 text-status-error'
                            : 'bg-accent-gold-soft text-accent-gold'
                        }`}
                      >
                        {feed.type === 'adversary_feed' ? 'Adversário' : 'Candidato'}
                      </span>
                      {feed.active && (
                        <span className="px-2 py-0.5 text-xs rounded-lg bg-status-success/10 text-status-success">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-secondary mb-2 break-all">{feed.rss_url}</p>
                    {feed.last_collected_at && (
                      <p className="text-xs text-secondary">
                        Última coleta: {new Date(feed.last_collected_at).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCollectFromFeed(feed)}
                      className="p-2 text-accent-gold hover:bg-accent-gold-soft rounded-lg transition-colors"
                      title="Coletar notícias deste feed"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {feed.type === 'user_feed' && (
                      <button
                        onClick={() => handleToggleActive(feed)}
                        className={`px-2 py-1 text-xs rounded-lg ${
                          feed.active
                            ? 'bg-status-warning/10 text-status-warning'
                            : 'bg-status-success/10 text-status-success'
                        }`}
                      >
                        {feed.active ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(feed)}
                      className="p-2 text-accent-gold hover:bg-accent-gold-soft rounded-lg transition-colors"
                      title="Editar feed"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFeed(feed)}
                      className="p-2 text-status-error hover:bg-status-error/10 rounded-lg transition-colors"
                      title="Remover feed"
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
          <div className="border-t border-card pt-6 mt-6">
            <h3 className="text-sm font-semibold text-primary mb-4">
              {editingFeed ? 'Editar Feed' : 'Adicionar Novo Feed'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Tipo de Feed
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'user_feed' | 'adversary_feed' })}
                  disabled={!!editingFeed} // Não permite mudar tipo ao editar
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                >
                  <option value="user_feed">Feed do Candidato</option>
                  <option value="adversary_feed">Radar de Adversários</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Nome do Feed
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Meu Nome + Piauí"
                  required
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  URL do Feed RSS
                </label>
                <input
                  type="url"
                  value={formData.rss_url}
                  onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                  placeholder="https://www.google.com/alerts/feeds/..."
                  required
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
              {formData.type === 'user_feed' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto_classify"
                    checked={formData.auto_classify}
                    onChange={(e) => setFormData({ ...formData, auto_classify: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="auto_classify" className="text-sm text-primary">
                    Classificar automaticamente (sentimento, risco, tema)
                  </label>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? editingFeed
                      ? 'Atualizando...'
                      : 'Adicionando...'
                    : editingFeed
                    ? 'Atualizar Feed'
                    : 'Adicionar Feed'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingFeed(null)
                    setFormData({ name: '', rss_url: '', auto_classify: true, type: 'user_feed' })
                  }}
                  className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Botão de Adicionar (quando não está mostrando formulário) */}
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Novo Feed
          </button>
        )}
      </div>
    </div>
  )
}


