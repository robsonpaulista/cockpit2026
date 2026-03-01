'use client'

import { useEffect, useState } from 'react'
import { KPICard } from '@/components/kpi-card'
import { AlertCard } from '@/components/alert-card'
import { Newspaper, AlertTriangle, TrendingUp, RefreshCw, Plus, Filter, Edit2, Trash2, Radio } from 'lucide-react'
import { FeedManagerModal } from '@/components/feed-manager-modal'
import { EditNewsModal } from '@/components/edit-news-modal'
import { KPI, NewsItem } from '@/types'
import { formatDate } from '@/lib/utils'

const sentimentColors = {
  positive: 'bg-status-success/10 text-status-success border-status-success/30',
  negative: 'bg-status-error/10 text-status-error border-status-error/30',
  neutral: 'bg-accent-gold-soft text-accent-gold border-accent-gold/30',
}

const riskColors = {
  high: 'bg-status-error/10 text-status-error',
  medium: 'bg-status-warning/10 text-status-warning',
  low: 'bg-status-success/10 text-status-success',
}

export default function NoticiasPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [allFeeds, setAllFeeds] = useState<any[]>([])
  const [temasAlta, setTemasAlta] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showFeedManager, setShowFeedManager] = useState(false)
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [filterSentiment, setFilterSentiment] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]) // Array de IDs de feeds selecionados
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null)
  const [togglingHighlight, setTogglingHighlight] = useState<string | null>(null)
  const [autoCollecting, setAutoCollecting] = useState(false)
  const [autoCollectStatus, setAutoCollectStatus] = useState<string | null>(null)

  useEffect(() => {
    void fetchData()
    void autoCollectOnPageOpen()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchNews(),
        fetchAllFeeds(),
        fetchTemasAlta(),
        fetchMetrics(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchNews = async () => {
    try {
      const params = new URLSearchParams()
      if (filterSentiment !== 'all') params.append('sentiment', filterSentiment)
      if (filterRisk !== 'all') params.append('risk_level', filterRisk)
      
      // Aplicar filtro apenas quando há feeds selecionados E não são todos
      // Se todos estão selecionados ou nenhum está selecionado, mostrar todas
      if (selectedFeeds.length > 0 && selectedFeeds.length < allFeeds.length) {
        params.append('feed_ids', selectedFeeds.join(','))
      }
      // Casos:
      // - selectedFeeds.length === 0: não filtra (mostra todas)
      // - selectedFeeds.length === allFeeds.length: não filtra (mostra todas)
      // - 0 < selectedFeeds.length < allFeeds.length: filtra pelos selecionados
      
      params.append('limit', '50')

      const response = await fetch(`/api/noticias?${params}`)
      if (response.ok) {
        const data = await response.json()
        setNews(data)
      }
    } catch (error) {
      // Erro silencioso
    }
  }

  const fetchAllFeeds = async () => {
    try {
      const response = await fetch('/api/noticias/all-feeds')
      if (response.ok) {
        const data = await response.json()
        setAllFeeds(data)
        // Por padrão, selecionar todos os feeds apenas na primeira vez
        if (selectedFeeds.length === 0 && data.length > 0) {
          setSelectedFeeds(data.map((f: any) => `${f.type}-${f.id}`))
        }
      }
    } catch (error) {
      // Erro silencioso
    }
  }

  const fetchTemasAlta = async () => {
    try {
      const response = await fetch('/api/noticias/temas-alta?days=7&limit=5')
      if (response.ok) {
        const data = await response.json()
        setTemasAlta(data)
      }
    } catch (error) {
      // Erro silencioso
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/noticias/metrics?days=24')
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      // Erro silencioso
    }
  }

  const handleManageFeeds = () => {
    setShowFeedManager(true)
  }

  const autoCollectOnPageOpen = async () => {
    setAutoCollecting(true)
    setAutoCollectStatus('Atualizando notícias automaticamente...')

    try {
      let totalCollected = 0
      let totalHighRisk = 0

      const userFeedsResponse = await fetch('/api/noticias/collect/my-feeds', {
        method: 'POST',
      })
      if (userFeedsResponse.ok) {
        const result = await userFeedsResponse.json()
        totalCollected += result.collected || 0
        totalHighRisk += result.high_risk || 0
      }

      const adversaryFeedsResponse = await fetch('/api/noticias/adversarios/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (adversaryFeedsResponse.ok) {
        const result = await adversaryFeedsResponse.json()
        totalCollected += result.collected || 0
        totalHighRisk += result.high_risk || 0
      }

      setAutoCollectStatus(
        totalCollected > 0
          ? `Atualização concluída: ${totalCollected} notícia(s) coletada(s)${totalHighRisk > 0 ? `, ${totalHighRisk} de alto risco.` : '.'}`
          : 'Atualização concluída: nenhuma notícia nova encontrada.'
      )

      await fetchData()
    } catch {
      setAutoCollectStatus('Não foi possível concluir a atualização automática de notícias.')
    } finally {
      setAutoCollecting(false)
      setTimeout(() => {
        setAutoCollectStatus(null)
      }, 6000)
    }
  }

  useEffect(() => {
    fetchNews()
  }, [filterSentiment, filterRisk, selectedFeeds])

  const handleToggleDashboard = async (item: NewsItem) => {
    setTogglingHighlight(item.id)
    try {
      const response = await fetch(`/api/noticias/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_highlight: !item.dashboard_highlight }),
      })
      if (response.ok) {
        setNews(prev => prev.map(n => n.id === item.id ? { ...n, dashboard_highlight: !n.dashboard_highlight } : n))
      }
    } catch (error) {
      console.error('Erro ao destacar notícia:', error)
    } finally {
      setTogglingHighlight(null)
    }
  }

  const handleDeleteNews = async (newsId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta notícia?')) {
      return
    }

    setDeletingNewsId(newsId)
    try {
      const response = await fetch(`/api/noticias/${newsId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remover da lista local
        setNews(news.filter(item => item.id !== newsId))
        // Atualizar métricas e temas
        fetchTemasAlta()
        fetchMetrics()
      } else {
        const error = await response.json()
        alert(`Erro ao excluir notícia: ${error.error || 'Erro desconhecido'}`)
      }
    } catch (error) {
      console.error('Erro ao excluir notícia:', error)
      alert('Erro ao excluir notícia. Tente novamente.')
    } finally {
      setDeletingNewsId(null)
    }
  }

  const noticiasKPIs: KPI[] = metrics
    ? [
        {
          id: 'mencoes',
          label: 'Menções 24h',
          value: metrics.mentions_24h?.toString() || '0',
          variation: 0,
          status: 'success',
        },
        {
          id: 'risco',
          label: 'Risco Alto Aberto',
          value: metrics.high_risk_crises_open || 0,
          variation: 0,
          status: metrics.high_risk_crises_open > 0 ? 'warning' : 'success',
        },
        {
          id: 'resposta',
          label: 'Tempo de Resposta',
          value: `${metrics.avg_response_time_hours || 0}h`,
          variation: 0,
          status: 'success',
        },
        {
          id: 'share',
          label: 'Share of Voice',
          value: `${metrics.share_of_voice || 0}%`,
          variation: 0,
          status: 'success',
        },
      ]
    : [
        {
          id: 'mencoes',
          label: 'Menções 24h',
          value: '0',
          variation: 0,
          status: 'neutral',
        },
        {
          id: 'risco',
          label: 'Risco Alto Aberto',
          value: 0,
          variation: 0,
          status: 'neutral',
        },
        {
          id: 'resposta',
          label: 'Tempo de Resposta',
          value: '0h',
          variation: 0,
          status: 'neutral',
        },
        {
          id: 'share',
          label: 'Share of Voice',
          value: '0%',
          variation: 0,
          status: 'neutral',
        },
      ]

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {noticiasKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inbox de Notícias */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-accent-gold" />
                  Inbox de Notícias
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManageFeeds}
                    className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Gerenciar Feeds RSS
                  </button>
                </div>
              </div>

              {(autoCollecting || autoCollectStatus) && (
                <div
                  className={`mb-4 rounded-xl border px-3 py-2 text-sm flex items-center gap-2 ${
                    autoCollecting
                      ? 'border-accent-gold/30 bg-accent-gold-soft/20 text-text-primary'
                      : autoCollectStatus?.startsWith('Não foi possível')
                        ? 'border-status-error/30 bg-status-error/10 text-status-error'
                        : 'border-status-success/30 bg-status-success/10 text-status-success'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${autoCollecting ? 'animate-spin' : ''}`} />
                  <span>{autoCollectStatus}</span>
                </div>
              )}

              {/* Filtros */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-secondary" />
                  <select
                    value={filterSentiment}
                    onChange={(e) => setFilterSentiment(e.target.value)}
                    className="text-sm border border-card rounded-lg px-3 py-1.5 bg-surface"
                  >
                    <option value="all">Todos os sentimentos</option>
                    <option value="positive">Positivo</option>
                    <option value="negative">Negativo</option>
                    <option value="neutral">Neutro</option>
                  </select>
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="text-sm border border-card rounded-lg px-3 py-1.5 bg-surface"
                  >
                    <option value="all">Todos os riscos</option>
                    <option value="high">Alto</option>
                    <option value="medium">Médio</option>
                    <option value="low">Baixo</option>
                  </select>
                </div>
                
                {/* Filtros de Origem por Feed */}
                {allFeeds.length > 0 && (
                  <div className="flex items-start gap-4 flex-wrap">
                    <span className="text-xs font-medium text-secondary pt-1">Feeds:</span>
                    <div className="flex flex-wrap gap-3">
                      {allFeeds.map((feed) => {
                        const feedId = `${feed.type}-${feed.id}`
                        return (
                          <label key={feedId} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFeeds.includes(feedId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFeeds([...selectedFeeds, feedId])
                                } else {
                                  setSelectedFeeds(selectedFeeds.filter(id => id !== feedId))
                                }
                              }}
                              className="w-4 h-4 rounded border-card text-accent-gold focus:ring-accent-gold"
                            />
                            <span className="text-sm text-text-primary">{feed.name}</span>
                            {feed.type === 'adversary_feed' && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-status-error/10 text-status-error">
                                Adversário
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-background rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-secondary mb-4">Nenhuma notícia coletada ainda.</p>
                  <button
                    onClick={handleManageFeeds}
                    className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
                  >
                    Configurar Feeds RSS
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {news.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-card hover:border-accent-gold/20 hover:shadow-card transition-all duration-200 ease-out"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-text-primary mb-1">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-accent-gold transition-colors"
                              >
                                {item.title}
                              </a>
                            ) : (
                              item.title
                            )}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-secondary mb-3">
                            <span>{item.source}</span>
                            <span>•</span>
                            <span>
                              {formatDate(
                                item.published_at || item.collected_at || new Date().toISOString()
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleToggleDashboard(item)}
                            disabled={togglingHighlight === item.id}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                              item.dashboard_highlight
                                ? 'bg-accent-gold/15 text-accent-gold'
                                : 'text-secondary hover:bg-accent-gold/10 hover:text-accent-gold'
                            }`}
                            title={item.dashboard_highlight ? 'Remover do Monitor (Dashboard)' : 'Destacar no Monitor (Dashboard)'}
                          >
                            <Radio className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNews(item.id)}
                            disabled={deletingNewsId === item.id}
                            className="p-1.5 rounded-lg hover:bg-status-error/10 text-secondary hover:text-status-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Excluir notícia"
                          >
                            {deletingNewsId === item.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setEditingNews(item)}
                          className="flex items-center gap-2 flex-wrap group hover:opacity-80 transition-opacity"
                          title="Clique para editar classificações"
                        >
                          <Edit2 className="w-3 h-3 text-secondary group-hover:text-accent-gold transition-colors" />
                          {item.sentiment ? (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-lg border cursor-pointer hover:shadow-sm transition-all ${sentimentColors[item.sentiment]}`}
                            >
                              {item.sentiment === 'positive'
                                ? 'Positivo'
                                : item.sentiment === 'negative'
                                ? 'Negativo'
                                : 'Neutro'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs text-secondary border border-dashed border-card rounded-lg">
                              Sem sentimento
                            </span>
                          )}
                          {item.risk_level ? (
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-lg cursor-pointer hover:shadow-sm transition-all ${riskColors[item.risk_level]}`}
                            >
                              Risco{' '}
                              {item.risk_level === 'high'
                                ? 'Alto'
                                : item.risk_level === 'medium'
                                ? 'Médio'
                                : 'Baixo'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs text-secondary border border-dashed border-card rounded-lg">
                              Sem risco
                            </span>
                          )}
                          {item.theme ? (
                            <span className="px-2 py-1 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-lg cursor-pointer hover:shadow-sm transition-all">
                              {item.theme}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs text-secondary border border-dashed border-card rounded-lg">
                              Sem tema
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar */}
          <div>
            {/* Temas em Alta */}
            <div className="bg-surface rounded-2xl border border-card p-6 mb-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-gold" />
                Temas em Alta
              </h2>
              {temasAlta.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-secondary">Nenhum tema ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {temasAlta.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-background"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.tema}</p>
                        <p className="text-xs text-secondary">{item.mencoes} menções</p>
                      </div>
                      <span className="text-sm font-semibold text-status-success">
                        {item.tendencia}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Gerenciamento de Feeds (Unificado) */}
      {showFeedManager && (
        <FeedManagerModal
          onClose={() => {
            setShowFeedManager(false)
            fetchAllFeeds()
            fetchNews()
          }}
          onCollect={() => {
            fetchData()
          }}
        />
      )}

      {/* Modal de Edição de Notícia */}
      {editingNews && (
        <EditNewsModal
          news={editingNews}
          onClose={() => setEditingNews(null)}
          onUpdate={() => {
            fetchNews()
            fetchTemasAlta() // Atualizar temas em alta após edição
            fetchMetrics() // Atualizar métricas também
            setEditingNews(null)
          }}
        />
      )}
    </div>
  )
}
