'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconPlus, IconRefresh } from '@tabler/icons-react'
import { ActiveAlertsStrip } from '@/components/noticias/active-alerts-strip'
import { NewsCard } from '@/components/noticias/news-card'
import { NoticiasFilterBar, NoticiasStatsRow } from '@/components/noticias/noticias-chrome'
import { SectionDivider } from '@/components/noticias/section-divider'
import { FeedManagerModal } from '@/components/feed-manager-modal'
import { EditNewsModal } from '@/components/edit-news-modal'
import { loadLixoIds, saveLixoIds } from '@/lib/noticias-lixo-store'
import {
  buildNewsListSections,
  dateGroupLabel,
  filterNewsClientSide,
  isTodayNews,
  sanitizeNewsItem,
  type FiltroDestaque,
} from '@/lib/noticias-page-utils'
import { ghostButtonClass } from '@/lib/premium-ui-classes'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { cn } from '@/lib/utils'
import type { NewsItem } from '@/types'

interface UnifiedFeed {
  id: string
  name: string
  type: string
  active?: boolean
}

export function GoogleAlertsPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [allFeeds, setAllFeeds] = useState<UnifiedFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showFeedManager, setShowFeedManager] = useState(false)
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [filterSentiment, setFilterSentiment] = useState('all')
  const [filterRisk, setFilterRisk] = useState('all')
  const [filterDestaque, setFilterDestaque] = useState<FiltroDestaque>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [ocultarLixo, setOcultarLixo] = useState(false)
  const [lixoIds, setLixoIds] = useState<Set<string>>(new Set())
  const [hidingIds, setHidingIds] = useState<Set<string>>(new Set())
  const [undoIds, setUndoIds] = useState<Set<string>>(new Set())
  const undoTimers = useRef<Map<string, number>>(new Map())
  const [togglingHighlight, setTogglingHighlight] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [autoCollectStatus, setAutoCollectStatus] = useState<string | null>(null)

  useEffect(() => {
    setLixoIds(loadLixoIds())
    void fetchData()
    void autoCollectOnPageOpen()
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchInput.trim()), 320)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    saveLixoIds(lixoIds)
  }, [lixoIds])

  useEffect(() => {
    return () => {
      undoTimers.current.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [])

  const fetchNews = async () => {
    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      const response = await fetch(`/api/noticias?${params}`)
      if (response.ok) {
        const data = (await response.json()) as NewsItem[]
        setNews(data.map(sanitizeNewsItem))
        setLastUpdated(new Date())
      }
    } catch {
      // silencioso
    }
  }

  const fetchAllFeeds = async () => {
    try {
      const response = await fetch('/api/noticias/all-feeds')
      if (response.ok) {
        const data = (await response.json()) as UnifiedFeed[]
        setAllFeeds(data)
      }
    } catch {
      // silencioso
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchNews(), fetchAllFeeds()])
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
    } finally {
      setRefreshing(false)
    }
  }

  const autoCollectOnPageOpen = async () => {
    setAutoCollectStatus('Atualizando alertas automaticamente…')
    try {
      await Promise.all([
        fetch('/api/noticias/collect/my-feeds', { method: 'POST' }),
        fetch('/api/noticias/adversarios/collect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      ])
      await fetchData()
      setAutoCollectStatus(null)
    } catch {
      setAutoCollectStatus('Não foi possível atualizar automaticamente.')
      window.setTimeout(() => setAutoCollectStatus(null), 5000)
    }
  }

  const applyDashboardHighlightResponse = (
    itemId: string,
    highlighted: boolean,
    demotedId: string | null | undefined
  ) => {
    setNews((prev) =>
      prev.map((n) => {
        if (n.id === itemId) return { ...n, dashboard_highlight: highlighted }
        if (demotedId && n.id === demotedId) return { ...n, dashboard_highlight: false }
        return n
      })
    )
  }

  const handleToggleHighlight = async (item: NewsItem) => {
    setTogglingHighlight(item.id)
    try {
      const nextHighlight = !item.dashboard_highlight
      const response = await fetch(`/api/noticias/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_highlight: nextHighlight }),
      })
      if (response.ok) {
        const data = (await response.json()) as NewsItem & { demoted_highlight_id?: string | null }
        applyDashboardHighlightResponse(item.id, nextHighlight, data.demoted_highlight_id)
      }
    } catch (error) {
      console.error('Erro ao destacar notícia:', error)
    } finally {
      setTogglingHighlight(null)
    }
  }

  const scheduleUndoClear = useCallback((id: string) => {
    const existing = undoTimers.current.get(id)
    if (existing) window.clearTimeout(existing)
    setUndoIds((prev) => new Set(prev).add(id))
    const timerId = window.setTimeout(() => {
      setUndoIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      undoTimers.current.delete(id)
    }, 5000)
    undoTimers.current.set(id, timerId)
  }, [])

  const handleMarkLixo = (id: string) => {
    setLixoIds((prev) => new Set(prev).add(id))
    scheduleUndoClear(id)
    if (ocultarLixo) {
      setHidingIds((prev) => new Set(prev).add(id))
      window.setTimeout(() => {
        setHidingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }, 200)
    }
  }

  const handleUndoLixo = (id: string) => {
    setLixoIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setUndoIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    const timerId = undoTimers.current.get(id)
    if (timerId) {
      window.clearTimeout(timerId)
      undoTimers.current.delete(id)
    }
  }

  const activeFeedKeys = allFeeds.filter((f) => f.active !== false).map((f) => `${f.type}-${f.id}`)

  const visibleNews = useMemo(
    () =>
      filterNewsClientSide(news, {
        filterSentiment,
        filterRisk,
        filterDestaque,
        searchDebounced,
        ocultarLixo,
        lixoIds,
        selectedFeedKeys: activeFeedKeys,
        allFeedKeysCount: allFeeds.length,
      }),
    [
      news,
      filterSentiment,
      filterRisk,
      filterDestaque,
      searchDebounced,
      ocultarLixo,
      lixoIds,
      activeFeedKeys,
      allFeeds.length,
    ]
  )

  const listSections = useMemo(() => buildNewsListSections(visibleNews), [visibleNews])

  const stats = useMemo(() => {
    const base = filterNewsClientSide(news, {
      filterSentiment,
      filterRisk,
      filterDestaque,
      searchDebounced,
      ocultarLixo: false,
      lixoIds,
      selectedFeedKeys: activeFeedKeys,
      allFeedKeysCount: allFeeds.length,
    })
    return {
      hoje: base.filter(isTodayNews).length,
      riscoAlto: base.filter((n) => n.risk_level === 'high').length,
      destacadas: base.filter((n) => n.dashboard_highlight).length,
    }
  }, [news, filterSentiment, filterRisk, filterDestaque, searchDebounced, lixoIds, activeFeedKeys, allFeeds.length])

  const lastUpdatedLabel = useMemo(() => {
    const diffMs = Date.now() - lastUpdated.getTime()
    if (diffMs < 60_000) return 'atualizado agora'
    const mins = Math.floor(diffMs / 60_000)
    return `atualizado há ${mins} min`
  }, [lastUpdated])

  const temFiltrosAtivos =
    filterSentiment !== 'all' ||
    filterRisk !== 'all' ||
    filterDestaque !== 'all' ||
    searchDebounced.length > 0 ||
    ocultarLixo

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
        <p className="text-xs text-text-muted">Inbox RSS · {lastUpdatedLabel}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            className={cn(ghostButtonClass, 'disabled:opacity-50')}
          >
            <IconRefresh
              className={cn('h-[14px] w-[14px] opacity-70', (refreshing || loading) && 'animate-spin')}
              stroke={1.5}
              aria-hidden
            />
            Atualizar
          </button>
          <button type="button" onClick={() => setShowFeedManager(true)} className={sidebarPrimaryCTAButtonClass(false)}>
            <IconPlus className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
            Novo alerta
          </button>
        </div>
      </div>

      <ActiveAlertsStrip feeds={allFeeds} onManageAlerts={() => setShowFeedManager(true)} />

      {autoCollectStatus ? (
        <p className="text-[11.5px] text-text-muted">{autoCollectStatus}</p>
      ) : null}

      <NoticiasFilterBar
        filterSentiment={filterSentiment}
        filterRisk={filterRisk}
        filterDestaque={filterDestaque}
        searchInput={searchInput}
        ocultarLixo={ocultarLixo}
        onSentimentChange={setFilterSentiment}
        onRiskChange={setFilterRisk}
        onDestaqueChange={setFilterDestaque}
        onSearchChange={setSearchInput}
        onOcultarLixoChange={setOcultarLixo}
      />

      <NoticiasStatsRow
        hojeCount={stats.hoje}
        riscoAltoCount={stats.riscoAlto}
        destacadasCount={stats.destacadas}
      />

      <div>
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app"
              />
            ))}
          </div>
        ) : visibleNews.length === 0 ? (
          <div className="py-10 text-center">
            {temFiltrosAtivos ? (
              <>
                <p className="mb-1 text-sm font-medium text-text-primary">
                  Nenhuma notícia corresponde aos filtros
                </p>
                <p className="mx-auto max-w-md text-[11.5px] text-text-muted">
                  Afrouxe sentimento, risco, destaque ou palavra-chave — ou aguarde novas coletas.
                </p>
              </>
            ) : (
              <>
                <p className="mb-3 text-[11.5px] text-text-muted">Nenhuma notícia coletada ainda.</p>
                <button type="button" onClick={() => setShowFeedManager(true)} className={sidebarPrimaryCTAButtonClass(false)}>
                  Configurar alertas RSS
                </button>
              </>
            )}
          </div>
        ) : (
          <div>
            {listSections.map((section, idx) => {
              if (section.type === 'risk-divider') {
                return <SectionDivider key={`risk-${idx}`} label="Risco alto" variant="risk" />
              }
              if (section.type === 'date-divider' && section.dateKey) {
                return (
                  <SectionDivider
                    key={`date-${section.dateKey}-${idx}`}
                    label={dateGroupLabel(section.dateKey)}
                    variant="date"
                  />
                )
              }
              if (section.type === 'card' && section.item) {
                const item = section.item
                return (
                  <NewsCard
                    key={item.id}
                    item={item}
                    isLixo={lixoIds.has(item.id)}
                    isHighlighted={Boolean(item.dashboard_highlight)}
                    isHiding={hidingIds.has(item.id)}
                    showUndo={undoIds.has(item.id)}
                    togglingHighlight={togglingHighlight === item.id}
                    onToggleHighlight={() => void handleToggleHighlight(item)}
                    onMarkLixo={() => handleMarkLixo(item.id)}
                    onUndoLixo={() => handleUndoLixo(item.id)}
                    onEditTags={() => setEditingNews(item)}
                  />
                )
              }
              return null
            })}
          </div>
        )}
      </div>

      {showFeedManager ? (
        <FeedManagerModal
          onClose={() => {
            setShowFeedManager(false)
            void fetchAllFeeds()
            void fetchNews()
          }}
          onCollect={() => void fetchData()}
        />
      ) : null}

      {editingNews ? (
        <EditNewsModal
          news={editingNews}
          onClose={() => setEditingNews(null)}
          onUpdate={() => {
            void fetchNews()
            setEditingNews(null)
          }}
        />
      ) : null}
    </div>
  )
}
