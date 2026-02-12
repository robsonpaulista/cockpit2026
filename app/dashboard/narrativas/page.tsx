'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  FileText, TrendingUp, MessageSquare, Search, Edit, Trash2, Plus,
  Crown, Eye, Heart, Target, Zap, Activity, Flame,
  ArrowUpRight, ArrowDownRight, ArrowRight, AlertTriangle
} from 'lucide-react'
import { NarrativeModal } from '@/components/narrative-modal'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Narrative {
  id: string
  theme: string
  target_audience: string
  key_message: string
  arguments: string[]
  proofs: unknown[]
  tested_phrases: string[]
  usage_count: number
  performance_score: number
  status: 'ativa' | 'rascunho' | 'arquivada'
  created_at?: string
  updated_at?: string
  // Stats detalhadas
  instagram_count?: number
  news_count?: number
  boosted_count?: number
  // Performance metrics (enrichment do /api/narrativas/performance)
  totalLikes?: number
  totalComments?: number
  totalEngagement?: number
  totalViews?: number
  avgEngagement?: number
  posts?: number
}

interface ThemePerformance {
  theme: string
  usage_count: number
  performance_score: number
  posts: number
  totalLikes: number
  totalComments: number
  totalEngagement: number
  totalViews: number
  avgLikes: number
  avgComments: number
  avgEngagement: number
  avgViews: number
  boostedCount: number
}

interface NarrativeInsight {
  rank: number
  dominancePercent: number
  dominanceLevel: 'dominant' | 'relevant' | 'low'
  engagementLevel: 'high' | 'medium' | 'low'
  engagementSharePercent: number
  frequencyLabel: string
  headline: string
  trend: 'up' | 'down' | 'stable'
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return num.toString()
}

function getDominanceLevel(percent: number): 'dominant' | 'relevant' | 'low' {
  if (percent >= 35) return 'dominant'
  if (percent >= 15) return 'relevant'
  return 'low'
}

function getDominanceConfig(level: 'dominant' | 'relevant' | 'low') {
  const configs = {
    dominant: {
      label: 'Dominante',
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      dot: 'bg-emerald-500',
      barColor: 'bg-emerald-500',
    },
    relevant: {
      label: 'Relevante',
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      dot: 'bg-amber-500',
      barColor: 'bg-amber-500',
    },
    low: {
      label: 'Baixa presença',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      dot: 'bg-red-500',
      barColor: 'bg-red-400',
    },
  }
  return configs[level]
}

function getEngagementLevel(avgEng: number, totalEng: number): 'high' | 'medium' | 'low' {
  if (avgEng >= 80 || totalEng >= 500) return 'high'
  if (avgEng >= 20 || totalEng >= 100) return 'medium'
  return 'low'
}

function getEngagementConfig(level: 'high' | 'medium' | 'low') {
  const configs = {
    high: { label: 'Alto engajamento', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    medium: { label: 'Engajamento médio', color: 'text-amber-600', bg: 'bg-amber-500/10' },
    low: { label: 'Baixo engajamento', color: 'text-gray-500', bg: 'bg-gray-500/10' },
  }
  return configs[level]
}

function generateHeadline(theme: string, insight: NarrativeInsight): string {
  const { dominanceLevel, engagementLevel, rank, dominancePercent } = insight

  if (rank === 1 && engagementLevel === 'high')
    return `${theme} lidera com forte engajamento nas redes`
  if (rank === 1)
    return `${theme} domina a narrativa do mandato`
  if (dominanceLevel === 'dominant')
    return `${theme} concentra ${dominancePercent.toFixed(0)}% das menções`
  if (engagementLevel === 'high' && dominanceLevel === 'relevant')
    return `${theme} gera alto impacto quando aparece`
  if (dominanceLevel === 'relevant')
    return `${theme} mantém presença relevante nas pautas`
  if (dominanceLevel === 'low')
    return `${theme} com baixa presença recente`
  return `${theme} precisa de reforço estratégico`
}

function getFrequencyLabel(usageCount: number, posts: number): string {
  if (usageCount >= 15 && posts >= 5) return 'Alta frequência com bom desempenho'
  if (usageCount >= 10) return 'Boa frequência de aparição'
  if (usageCount >= 5) return 'Frequência moderada'
  if (usageCount >= 1) return 'Aparição pontual'
  return 'Sem aparições recentes'
}

function estimateTrend(narrative: Narrative): 'up' | 'down' | 'stable' {
  const total = narrative.usage_count || 0
  const performance = narrative.performance_score || 0

  if (performance >= 60 && total >= 5) return 'up'
  if (total <= 2 || performance <= 15) return 'down'
  return 'stable'
}

function getTrendConfig(trend: 'up' | 'down' | 'stable') {
  const configs = {
    up: { label: 'crescendo', color: 'text-emerald-500', symbol: '↑', Icon: ArrowUpRight },
    down: { label: 'caindo', color: 'text-red-500', symbol: '↓', Icon: ArrowDownRight },
    stable: { label: 'estável', color: 'text-gray-400', symbol: '→', Icon: ArrowRight },
  }
  return configs[trend]
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NarrativasPage() {
  const [narrativas, setNarrativas] = useState<Narrative[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterTheme, setFilterTheme] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchNarrativas()
  }, [searchTerm, filterTheme, filterStatus])

  const fetchNarrativas = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (filterTheme) params.append('theme', filterTheme)
      if (filterStatus) params.append('status', filterStatus)

      // Buscar narrativas e performance em paralelo
      const [narrativasResponse, performanceResponse] = await Promise.all([
        fetch(`/api/narrativas?${params.toString()}`),
        fetch('/api/narrativas/performance'),
      ])

      // Montar mapa de performance por tema
      const perfMap = new Map<string, ThemePerformance>()
      if (performanceResponse.ok) {
        const perfData = await performanceResponse.json()
        if (perfData.themes) {
          perfData.themes.forEach((t: ThemePerformance) => {
            perfMap.set(t.theme, t)
          })
        }
      }

      if (narrativasResponse.ok) {
        const data = await narrativasResponse.json()

        // Buscar stats + merge com performance
        const narrativasEnriquecidas: Narrative[] = await Promise.all(
          data.map(async (narrativa: Narrative) => {
            let stats = {
              usage_count: 0,
              performance_score: 0,
              instagram_count: 0,
              news_count: 0,
              boosted_count: 0,
            }
            try {
              const statsResponse = await fetch(
                `/api/narrativas/stats?theme=${encodeURIComponent(narrativa.theme)}`
              )
              if (statsResponse.ok) {
                stats = await statsResponse.json()
              }
            } catch (error) {
              console.error(`Erro ao buscar stats para ${narrativa.theme}:`, error)
            }

            // Enriquecer com performance metrics
            const perf = perfMap.get(narrativa.theme)

            return {
              ...narrativa,
              usage_count: stats.usage_count || 0,
              performance_score: stats.performance_score || 0,
              instagram_count: stats.instagram_count || 0,
              news_count: stats.news_count || 0,
              boosted_count: stats.boosted_count || 0,
              totalLikes: perf?.totalLikes || 0,
              totalComments: perf?.totalComments || 0,
              totalEngagement: perf?.totalEngagement || 0,
              totalViews: perf?.totalViews || 0,
              avgEngagement: perf?.avgEngagement || 0,
              posts: perf?.posts || 0,
            }
          })
        )

        // Ordenar por relevância (uso + engajamento)
        narrativasEnriquecidas.sort((a, b) => {
          const scoreA = (a.usage_count || 0) * 2 + (a.totalEngagement || 0) / 100
          const scoreB = (b.usage_count || 0) * 2 + (b.totalEngagement || 0) / 100
          return scoreB - scoreA
        })

        setNarrativas(narrativasEnriquecidas)
      } else {
        console.error('Erro ao buscar narrativas')
      }
    } catch (error) {
      console.error('Erro ao buscar narrativas:', error)
    } finally {
      setLoading(false)
    }
  }

  // ─── Compute insights para todas as narrativas ───

  const insightsMap = useMemo(() => {
    const map = new Map<string, NarrativeInsight>()
    if (narrativas.length === 0) return map

    const totalUsage = narrativas.reduce((sum, n) => sum + (n.usage_count || 0), 0)
    const totalEngagement = narrativas.reduce((sum, n) => sum + (n.totalEngagement || 0), 0)

    narrativas.forEach((n, index) => {
      const dominancePercent = totalUsage > 0
        ? ((n.usage_count || 0) / totalUsage) * 100
        : 0
      const engagementSharePercent = totalEngagement > 0
        ? ((n.totalEngagement || 0) / totalEngagement) * 100
        : 0
      const dominanceLevel = getDominanceLevel(dominancePercent)
      const engagementLevel = getEngagementLevel(n.avgEngagement || 0, n.totalEngagement || 0)
      const trend = estimateTrend(n)

      const insight: NarrativeInsight = {
        rank: index + 1,
        dominancePercent,
        dominanceLevel,
        engagementLevel,
        engagementSharePercent,
        frequencyLabel: getFrequencyLabel(n.usage_count || 0, n.posts || 0),
        headline: '',
        trend,
      }
      insight.headline = generateHeadline(n.theme, insight)
      map.set(n.id, insight)
    })

    return map
  }, [narrativas])

  // ─── Dados resumo do radar ───

  const radarSummary = useMemo(() => {
    if (narrativas.length === 0) return null

    const activeNarrativas = narrativas.filter(n => n.status === 'ativa')
    const top = activeNarrativas[0] || narrativas[0]
    const topInsight = insightsMap.get(top.id)

    // Encontrar tendências
    const growingNarrative = narrativas.find(n => {
      if (n.id === top.id) return false
      const insight = insightsMap.get(n.id)
      return insight && insight.trend === 'up'
    }) ?? null

    const weakestNarrative = narrativas.find(n => {
      const insight = insightsMap.get(n.id)
      return insight && insight.dominanceLevel === 'low' && n.status === 'ativa'
    }) ?? null

    // Se não encontrou growing, pegar o segundo com melhor score
    let growing: Narrative | null = growingNarrative
    if (!growing && narrativas.length > 1) {
      const second = narrativas.find(n => n.id !== top.id && n.status === 'ativa')
      if (second) {
        const secondInsight = insightsMap.get(second.id)
        if (secondInsight && secondInsight.trend !== 'down') growing = second
      }
    }
    const weakest: Narrative | null = weakestNarrative

    // Gerar frase-resumo principal
    let mainSentence = ''
    if (topInsight) {
      const engShare = topInsight.engagementSharePercent
      if (engShare >= 50) {
        mainSentence = `${top.theme} domina a narrativa do mandato nos últimos 30 dias, concentrando ${engShare.toFixed(0)}% do engajamento total.`
      } else if (engShare >= 30) {
        mainSentence = `${top.theme} lidera o posicionamento com ${engShare.toFixed(0)}% do engajamento, seguido de perto por outras pautas.`
      } else if (topInsight.dominancePercent >= 30) {
        mainSentence = `${top.theme} concentra ${topInsight.dominancePercent.toFixed(0)}% das menções, liderando o radar de posicionamento.`
      } else {
        mainSentence = `As narrativas estão distribuídas. ${top.theme} lidera com ${topInsight.dominancePercent.toFixed(0)}% das menções.`
      }
    }

    return { top, topInsight, growing, weakest, mainSentence }
  }, [narrativas, insightsMap])

  // ─── Handlers ───

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta narrativa?')) return
    try {
      const response = await fetch(`/api/narrativas/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchNarrativas()
      } else {
        alert('Erro ao excluir narrativa')
      }
    } catch {
      alert('Erro ao excluir narrativa')
    }
  }

  const handleEdit = (narrative: Narrative) => {
    setSelectedNarrative(narrative)
    setModalOpen(true)
  }

  const handleNew = () => {
    setSelectedNarrative(null)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedNarrative(null)
  }

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const uniqueThemes = Array.from(new Set(narrativas.map(n => n.theme))).sort()

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 lg:px-6 max-w-7xl mx-auto">

        {/* ═══════════════════════════════════════════════════════════════════
            RADAR HERO — Principal insight do posicionamento
            ═══════════════════════════════════════════════════════════════════ */}
        {!loading && radarSummary && (
          <div className="mb-8 animate-reveal">
            <div className="bg-surface rounded-2xl border border-card overflow-hidden">
              {/* Accent bar topo */}
              <div className="h-1 bg-gradient-to-r from-accent-gold via-amber-400 to-accent-gold" />

              <div className="p-6 lg:p-8">
                {/* Título da seção */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-accent-gold/10">
                    <Target className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text-primary tracking-tight">
                      Radar de Posicionamento
                    </h2>
                    <p className="text-xs text-secondary">Últimos 30 dias</p>
                  </div>
                </div>

                {/* Headline principal */}
                <div className="mb-6">
                  <p className="text-xs text-secondary uppercase tracking-wider font-medium mb-1.5">
                    Principal narrativa do mês
                  </p>
                  <p className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
                    <Crown className="w-6 h-6 text-accent-gold animate-breathe flex-shrink-0" />
                    {radarSummary.top.theme}
                  </p>
                  <p className="text-sm text-secondary mt-2.5 leading-relaxed max-w-2xl">
                    {radarSummary.mainSentence}
                  </p>
                </div>

                {/* Quick indicators — 3 colunas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Marca do mandato */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-subtle-pulse flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                        Marca do mandato
                      </p>
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {radarSummary.top.theme}
                      </p>
                    </div>
                  </div>

                  {/* Em crescimento */}
                  {radarSummary.growing ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                      <ArrowUpRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                          Em crescimento
                        </p>
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {radarSummary.growing.theme}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-500/5 border border-gray-500/10">
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Em crescimento
                        </p>
                        <p className="text-sm text-secondary truncate">
                          Nenhuma pauta destacada
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Precisa reforçar */}
                  {radarSummary.weakest ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">
                          Precisa reforçar
                        </p>
                        <p className="text-sm font-semibold text-text-primary truncate">
                          {radarSummary.weakest.theme}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-500/5 border border-gray-500/10">
                      <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Precisa reforçar
                        </p>
                        <p className="text-sm text-secondary truncate">
                          Todas as pautas ativas
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AÇÕES E FILTROS
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <button
              onClick={handleNew}
              className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Narrativa
            </button>

            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 text-sm bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                />
              </div>

              <select
                value={filterTheme}
                onChange={(e) => setFilterTheme(e.target.value)}
                className="px-4 py-2 text-sm bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
              >
                <option value="">Todos os temas</option>
                {uniqueThemes.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 text-sm bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
              >
                <option value="">Todos os status</option>
                <option value="ativa">Ativa</option>
                <option value="rascunho">Rascunho</option>
                <option value="arquivada">Arquivada</option>
              </select>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            CARDS — Lista de narrativas com insights
            ═══════════════════════════════════════════════════════════════════ */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface rounded-2xl border border-card overflow-hidden animate-pulse">
                <div className="h-1 bg-gray-200" />
                <div className="p-6">
                  <div className="flex gap-3 mb-4">
                    <div className="w-8 h-8 bg-background rounded-lg" />
                    <div className="flex-1">
                      <div className="h-5 bg-background rounded mb-2 w-3/4" />
                      <div className="h-3 bg-background rounded w-full" />
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <div className="h-6 bg-background rounded-full w-24" />
                    <div className="h-6 bg-background rounded-full w-32" />
                  </div>
                  <div className="h-2 bg-background rounded-full mb-4" />
                  <div className="h-4 bg-background rounded mb-2" />
                  <div className="h-4 bg-background rounded w-2/3" />
                  <div className="mt-4 pt-4 border-t border-card">
                    <div className="h-3 bg-background rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : narrativas.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-secondary mx-auto mb-4" />
            <p className="text-secondary">
              {searchTerm || filterTheme || filterStatus
                ? 'Nenhuma narrativa encontrada com os filtros aplicados'
                : 'Nenhuma narrativa cadastrada. Clique em "Nova Narrativa" para começar.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {narrativas.map((narrativa, index) => {
              const insight = insightsMap.get(narrativa.id)
              if (!insight) return null

              const domConfig = getDominanceConfig(insight.dominanceLevel)
              const engConfig = getEngagementConfig(insight.engagementLevel)
              const trendConfig = getTrendConfig(insight.trend)
              const isFirst = insight.rank === 1
              const isExpanded = expandedCards.has(narrativa.id)
              const TrendIcon = trendConfig.Icon
              const hasEngagementData = (narrativa.totalLikes || 0) > 0 || (narrativa.totalViews || 0) > 0

              return (
                <div
                  key={narrativa.id}
                  className={cn(
                    'bg-surface rounded-2xl border overflow-hidden relative group',
                    'hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out',
                    isFirst
                      ? 'border-accent-gold/30 shadow-[0_2px_12px_rgba(0,0,0,0.04)]'
                      : 'border-card',
                    `animate-reveal animate-reveal-${Math.min(index + 1, 6)}`
                  )}
                >
                  {/* ── Accent bar topo (cor por dominância) ── */}
                  <div className={cn(
                    'h-1 transition-all duration-500',
                    isFirst
                      ? 'bg-gradient-to-r from-accent-gold via-amber-400 to-accent-gold'
                      : insight.dominanceLevel === 'dominant'
                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        : insight.dominanceLevel === 'relevant'
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                          : 'bg-gradient-to-r from-red-300 to-red-400'
                  )} />

                  <div className="p-6">
                    {/* ── Header: Rank + Tema + Trend ── */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Badge de ranking */}
                        <div className={cn(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold',
                          isFirst
                            ? 'bg-accent-gold text-white'
                            : 'bg-background text-secondary border border-card'
                        )}>
                          {isFirst ? <Crown className="w-4 h-4" /> : `#${insight.rank}`}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Nome do tema + indicador de tendência */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-text-primary truncate">
                              {narrativa.theme}
                            </h3>
                            <span className={cn(
                              'inline-flex items-center gap-0.5 text-xs font-medium flex-shrink-0',
                              trendConfig.color
                            )}>
                              <TrendIcon className="w-3.5 h-3.5" />
                              {trendConfig.label}
                            </span>
                          </div>

                          {/* Micro headline dinâmica */}
                          <p className="text-[13px] text-secondary mt-0.5 italic leading-snug">
                            &ldquo;{insight.headline}&rdquo;
                          </p>
                        </div>
                      </div>

                      {/* Status + Ações */}
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className={cn(
                          'px-2 py-0.5 text-[11px] font-medium rounded-full',
                          narrativa.status === 'ativa'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : narrativa.status === 'rascunho'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-gray-500/10 text-gray-500'
                        )}>
                          {narrativa.status}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                          <button
                            onClick={() => handleEdit(narrativa)}
                            className="p-1.5 text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(narrativa.id)}
                            className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── Badges: Dominância + Engajamento ── */}
                    <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border',
                        domConfig.bg, domConfig.color, domConfig.border
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', domConfig.dot)} />
                        {domConfig.label}
                      </span>

                      <span className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full',
                        engConfig.bg, engConfig.color
                      )}>
                        <Zap className="w-3 h-3" />
                        {engConfig.label}
                      </span>
                    </div>

                    {/* ── Barra de dominância visual ── */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-secondary">Participação nas menções</span>
                        <span className="font-semibold text-text-primary">
                          {insight.dominancePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full animate-grow', domConfig.barColor)}
                          style={{ width: `${Math.max(insight.dominancePercent, 2)}%` }}
                        />
                      </div>
                    </div>

                    {/* ── Mensagem-chave ── */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-1">
                        Mensagem-chave
                      </p>
                      <p className="text-sm text-text-primary leading-relaxed">
                        {narrativa.key_message}
                      </p>
                    </div>

                    {/* ── Público ── */}
                    <p className="text-xs text-secondary mb-4">
                      <span className="font-medium">Público:</span> {narrativa.target_audience}
                    </p>

                    {/* ── Seção expansível: Argumentos + Frases ── */}
                    {((narrativa.arguments && narrativa.arguments.length > 0) ||
                      (narrativa.tested_phrases && narrativa.tested_phrases.length > 0)) && (
                      <div className="mb-4">
                        <button
                          onClick={() => toggleExpanded(narrativa.id)}
                          className="text-xs text-accent-gold hover:text-accent-gold/80 font-medium transition-colors"
                        >
                          {isExpanded ? '▾ Ocultar detalhes' : '▸ Ver argumentos e frases'}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 space-y-3 animate-reveal">
                            {narrativa.arguments && narrativa.arguments.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">
                                  Argumentos
                                </p>
                                <ul className="space-y-1">
                                  {narrativa.arguments.map((arg, idx) => (
                                    <li key={idx} className="text-sm text-secondary flex items-start gap-2">
                                      <span className="text-accent-gold mt-0.5 text-xs">●</span>
                                      <span>{arg}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {narrativa.tested_phrases && narrativa.tested_phrases.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">
                                  Frases testadas
                                </p>
                                <ul className="space-y-1">
                                  {narrativa.tested_phrases.map((phrase, idx) => (
                                    <li key={idx} className="text-sm text-secondary italic">
                                      &ldquo;{phrase}&rdquo;
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Stats section ── */}
                    <div className="pt-4 border-t border-card space-y-3">
                      {/* Linha primária: menções, posts, performance */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-secondary" />
                          <span className="text-sm font-semibold text-text-primary">
                            {narrativa.usage_count || 0}
                          </span>
                          <span className="text-xs text-secondary">menções</span>
                          <span className={cn('text-xs font-bold', trendConfig.color)}>
                            {trendConfig.symbol}
                          </span>
                        </div>

                        <span className="text-gray-300">·</span>

                        <div className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-secondary" />
                          <span className="text-sm font-semibold text-text-primary">
                            {narrativa.posts || 0}
                          </span>
                          <span className="text-xs text-secondary">posts</span>
                        </div>

                        <span className="text-gray-300">·</span>

                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                          <span className="text-sm font-semibold text-text-primary">
                            {narrativa.performance_score || 0}%
                          </span>
                          <span className="text-xs text-secondary">performance</span>
                        </div>
                      </div>

                      {/* Breakdown por canal */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center justify-between px-2.5 py-2 bg-blue-500/5 rounded-lg border border-blue-500/10">
                          <span className="text-blue-600/70">Instagram</span>
                          <span className="font-semibold text-blue-700">
                            {narrativa.instagram_count || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                          <span className="text-emerald-600/70">Notícias</span>
                          <span className="font-semibold text-emerald-700">
                            {narrativa.news_count || 0}
                          </span>
                        </div>
                        <div className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg border',
                          (narrativa.boosted_count || 0) > 0
                            ? 'bg-purple-500/5 border-purple-500/10'
                            : 'bg-gray-500/5 border-gray-500/10'
                        )}>
                          <span className={cn(
                            (narrativa.boosted_count || 0) > 0
                              ? 'text-purple-600/70'
                              : 'text-gray-500/70'
                          )}>
                            Impulsionados
                          </span>
                          <span className={cn(
                            'font-semibold',
                            (narrativa.boosted_count || 0) > 0
                              ? 'text-purple-700'
                              : 'text-gray-500'
                          )}>
                            {narrativa.boosted_count || 0}
                          </span>
                        </div>
                      </div>

                      {/* Métricas de engajamento (os dados de ouro) */}
                      {hasEngagementData && (
                        <div className="flex items-center gap-4 text-xs pt-1">
                          {(narrativa.totalViews || 0) > 0 && (
                            <div className="flex items-center gap-1 text-secondary">
                              <Eye className="w-3.5 h-3.5" />
                              <span className="font-semibold text-text-primary">
                                {formatCompact(narrativa.totalViews || 0)}
                              </span>
                              <span>views</span>
                            </div>
                          )}
                          {(narrativa.totalLikes || 0) > 0 && (
                            <div className="flex items-center gap-1 text-secondary">
                              <Heart className="w-3.5 h-3.5 text-red-400" />
                              <span className="font-semibold text-text-primary">
                                {formatCompact(narrativa.totalLikes || 0)}
                              </span>
                              <span>curtidas</span>
                            </div>
                          )}
                          {(narrativa.totalComments || 0) > 0 && (
                            <div className="flex items-center gap-1 text-secondary">
                              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                              <span className="font-semibold text-text-primary">
                                {formatCompact(narrativa.totalComments || 0)}
                              </span>
                              <span>comentários</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Label de frequência (insight automático) */}
                      <div className="flex items-center gap-2 pt-1">
                        <Flame className="w-3.5 h-3.5 text-accent-gold" />
                        <span className="text-xs font-medium text-secondary italic">
                          {insight.frequencyLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <NarrativeModal
          narrative={selectedNarrative}
          onClose={handleCloseModal}
          onUpdate={fetchNarrativas}
        />
      )}
    </div>
  )
}
