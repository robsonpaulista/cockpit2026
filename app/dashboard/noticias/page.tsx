'use client'

import { useEffect, useState } from 'react'
import { Newspaper, RefreshCw, Plus, Edit2, Trash2, Radio, Crown, Search } from 'lucide-react'
import { FeedManagerModal } from '@/components/feed-manager-modal'
import { EditNewsModal } from '@/components/edit-news-modal'
import { NewsItem } from '@/types'
import { cn, formatDate } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

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

type FiltroDestaquePainel = 'all' | 'yes' | 'no'
type FiltroDestaqueMonitor = 'all' | 'yes'

export default function NoticiasPage() {
  const { theme } = useTheme()
  const isCockpit = theme === 'cockpit'
  const [news, setNews] = useState<NewsItem[]>([])
  const [allFeeds, setAllFeeds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showFeedManager, setShowFeedManager] = useState(false)
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [filterSentiment, setFilterSentiment] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [filterDestaquePainel, setFilterDestaquePainel] = useState<FiltroDestaquePainel>('all')
  const [filterDestaqueMonitor, setFilterDestaqueMonitor] = useState<FiltroDestaqueMonitor>('all')
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchDebounced, setSearchDebounced] = useState<string>('')
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]) // Array de IDs de feeds selecionados
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null)
  const [togglingHighlight, setTogglingHighlight] = useState<string | null>(null)
  const [featuredMonitorNewsIds, setFeaturedMonitorNewsIds] = useState<string[]>([])
  const [autoCollecting, setAutoCollecting] = useState(false)
  const [autoCollectStatus, setAutoCollectStatus] = useState<string | null>(null)

  useEffect(() => {
    void fetchData()
    void autoCollectOnPageOpen()

    const savedFeatured = localStorage.getItem('monitor_news_featured_id')
    if (savedFeatured) {
      try {
        if (savedFeatured.startsWith('[')) {
          const parsed = JSON.parse(savedFeatured)
          if (Array.isArray(parsed)) {
            setFeaturedMonitorNewsIds(parsed.filter((id): id is string => typeof id === 'string').slice(0, 3))
          }
        } else {
          // Compatibilidade com formato antigo (1 único id)
          setFeaturedMonitorNewsIds([savedFeatured])
        }
      } catch {
        setFeaturedMonitorNewsIds([])
      }
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim())
    }, 320)
    return () => clearTimeout(t)
  }, [searchInput])

  const monitorIdsKey =
    filterDestaqueMonitor === 'yes'
      ? [...featuredMonitorNewsIds].sort().join('|')
      : ''

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchNews(), fetchAllFeeds()])
    } finally {
      setLoading(false)
    }
  }

  const fetchNews = async () => {
    try {
      if (filterDestaqueMonitor === 'yes' && featuredMonitorNewsIds.length === 0) {
        setNews([])
        return
      }

      const params = new URLSearchParams()
      if (filterSentiment !== 'all') params.append('sentiment', filterSentiment)
      if (filterRisk !== 'all') params.append('risk_level', filterRisk)

      if (filterDestaquePainel === 'yes') params.append('dashboard_highlight', 'true')
      if (filterDestaquePainel === 'no') params.append('dashboard_highlight', 'false')

      if (searchDebounced.length > 0) params.append('q', searchDebounced)

      if (filterDestaqueMonitor === 'yes' && featuredMonitorNewsIds.length > 0) {
        params.append('ids', featuredMonitorNewsIds.join(','))
      }

      if (selectedFeeds.length > 0 && selectedFeeds.length < allFeeds.length) {
        params.append('feed_ids', selectedFeeds.join(','))
      }

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
    void fetchNews()
  }, [
    filterSentiment,
    filterRisk,
    selectedFeeds,
    filterDestaquePainel,
    filterDestaqueMonitor,
    searchDebounced,
    monitorIdsKey,
    allFeeds.length,
  ])

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

  const handleToggleFeaturedMonitor = async (item: NewsItem) => {
    const alreadyFeatured = featuredMonitorNewsIds.includes(item.id)
    let nextFeatured = alreadyFeatured
      ? featuredMonitorNewsIds.filter((id) => id !== item.id)
      : [...featuredMonitorNewsIds, item.id]

    if (!alreadyFeatured && featuredMonitorNewsIds.length >= 3) {
      alert('Você pode selecionar no máximo 3 notícias em destaque para o monitor.')
      return
    }

    // Garante que notícia destacada principal também esteja marcada para o monitor.
    if (!alreadyFeatured && !item.dashboard_highlight) {
      try {
        const response = await fetch(`/api/noticias/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dashboard_highlight: true }),
        })
        if (response.ok) {
          setNews(prev => prev.map(n => n.id === item.id ? { ...n, dashboard_highlight: true } : n))
        }
      } catch {
        // fallback silencioso
      }
    }

    nextFeatured = nextFeatured.slice(0, 3)

    if (nextFeatured.length > 0) {
      localStorage.setItem('monitor_news_featured_id', JSON.stringify(nextFeatured))
    } else {
      localStorage.removeItem('monitor_news_featured_id')
    }
    setFeaturedMonitorNewsIds(nextFeatured)
  }

  const temFiltrosNoticiasAtivos =
    filterSentiment !== 'all' ||
    filterRisk !== 'all' ||
    filterDestaquePainel !== 'all' ||
    filterDestaqueMonitor !== 'all' ||
    searchDebounced.length > 0 ||
    (allFeeds.length > 0 && selectedFeeds.length > 0 && selectedFeeds.length < allFeeds.length)

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        <div className="bg-surface rounded-2xl border border-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-accent-gold" />
                  Inbox de Notícias
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleManageFeeds}
                    className={sidebarPrimaryCTAButtonClass(isCockpit)}
                  >
                    <Plus className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} aria-hidden />
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

              {/* Filtros — uma linha (scroll horizontal em telas estreitas), padrão /dashboard/pesquisa */}
              <div className="rounded-xl border border-card bg-background/50 px-3 py-2 mb-4">
                <div className="flex flex-nowrap items-center gap-x-2 sm:gap-3 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                  <span className="text-xs font-semibold text-text-primary shrink-0">Filtros</span>
                  <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

                  <label className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                      Sentimento
                    </span>
                    <select
                      value={filterSentiment}
                      onChange={(e) => setFilterSentiment(e.target.value)}
                      className="min-w-[5.5rem] max-w-[9rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      <option value="all">Todos</option>
                      <option value="positive">Positivo</option>
                      <option value="negative">Negativo</option>
                      <option value="neutral">Neutro</option>
                    </select>
                  </label>

                  <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

                  <label className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                      Risco
                    </span>
                    <select
                      value={filterRisk}
                      onChange={(e) => setFilterRisk(e.target.value)}
                      className="min-w-[4.5rem] max-w-[7rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      <option value="all">Todos</option>
                      <option value="high">Alto</option>
                      <option value="medium">Médio</option>
                      <option value="low">Baixo</option>
                    </select>
                  </label>

                  <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

                  <label className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                      Destaque painel
                    </span>
                    <select
                      value={filterDestaquePainel}
                      onChange={(e) => setFilterDestaquePainel(e.target.value as FiltroDestaquePainel)}
                      title="Notícias marcadas para o Monitor (ícone de rádio) no dashboard"
                      className="min-w-[6rem] max-w-[10rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      <option value="all">Todos</option>
                      <option value="yes">Sim</option>
                      <option value="no">Não</option>
                    </select>
                  </label>

                  <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

                  <label className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                      Destaque monitor
                    </span>
                    <select
                      value={filterDestaqueMonitor}
                      onChange={(e) => setFilterDestaqueMonitor(e.target.value as FiltroDestaqueMonitor)}
                      title="Até 3 notícias com coroa — escolhidas nesta página e salvas no navegador"
                      className="min-w-[5.5rem] max-w-[9rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      <option value="all">Todos</option>
                      <option value="yes">Sim</option>
                    </select>
                  </label>

                  <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

                  <label className="flex min-w-[10rem] max-w-[min(100%,18rem)] flex-1 items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                      Palavra-chave
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <Search
                        className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Título, fonte ou tema…"
                        className="w-full min-w-[7rem] rounded-lg border border-card bg-surface py-1.5 pl-7 pr-2 text-xs placeholder:text-secondary/70 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                        autoComplete="off"
                      />
                    </span>
                  </label>

                  {allFeeds.length > 0 ? (
                    <>
                      <span className="hidden md:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                          Feeds
                        </span>
                        <div className="flex flex-nowrap items-center gap-x-3 gap-y-1">
                          {allFeeds.map((feed) => {
                            const feedId = `${feed.type}-${feed.id}`
                            return (
                              <label
                                key={feedId}
                                className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFeeds.includes(feedId)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFeeds([...selectedFeeds, feedId])
                                    } else {
                                      setSelectedFeeds(selectedFeeds.filter((id) => id !== feedId))
                                    }
                                  }}
                                  className="h-3.5 w-3.5 shrink-0 rounded border-card text-accent-gold focus:ring-accent-gold"
                                />
                                <span className="text-xs text-text-primary">{feed.name}</span>
                                {feed.type === 'adversary_feed' ? (
                                  <span className="rounded bg-status-error/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-status-error">
                                    Adv.
                                  </span>
                                ) : null}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-background rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : news.length === 0 ? (
                <div className="text-center py-8">
                  {filterDestaqueMonitor === 'yes' && featuredMonitorNewsIds.length === 0 ? (
                    <>
                      <p className="mb-2 font-medium text-text-primary">Nenhuma notícia em destaque no monitor</p>
                      <p className="mx-auto max-w-md text-sm text-secondary">
                        Use o ícone da coroa em até três notícias para defini-las como destaque do monitor neste navegador.
                      </p>
                    </>
                  ) : temFiltrosNoticiasAtivos ? (
                    <>
                      <p className="mb-2 font-medium text-text-primary">Nenhuma notícia corresponde aos filtros</p>
                      <p className="mx-auto max-w-md text-sm text-secondary">
                        Afrouxe sentimento, risco, destaques, palavra-chave ou feeds — ou aguarde novas coletas.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-4 text-secondary">Nenhuma notícia coletada ainda.</p>
                      <button
                        type="button"
                        onClick={handleManageFeeds}
                        className={sidebarPrimaryCTAButtonClass(isCockpit)}
                      >
                        Configurar Feeds RSS
                      </button>
                    </>
                  )}
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
                          {featuredMonitorNewsIds.includes(item.id) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-amber-300/70 text-amber-700 bg-amber-100/60 mb-1">
                              <Crown className="w-3 h-3" />
                              Destaque do Monitor
                            </span>
                          )}
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
                            onClick={() => handleToggleFeaturedMonitor(item)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              featuredMonitorNewsIds.includes(item.id)
                                ? 'bg-amber-100 text-amber-700'
                                : 'text-secondary hover:bg-amber-100/60 hover:text-amber-700'
                            }`}
                            title={
                              featuredMonitorNewsIds.includes(item.id)
                                ? 'Remover notícia dos destaques do monitor'
                                : 'Definir como destaque do monitor (máx. 3)'
                            }
                          >
                            <Crown className="w-4 h-4" />
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
            setEditingNews(null)
          }}
        />
      )}
    </div>
  )
}
