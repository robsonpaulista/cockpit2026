'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
import { ConteudoRedesShell } from '@/components/conteudo-redes/conteudo-redes-shell'
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Share2, 
  Play, 
  Calendar, 
  Eye, 
  Heart, 
  BarChart4, 
  FileText,
  MessageCircle,
  Download,
  ExternalLink,
  Filter,
  X,
  Sparkles,
  BarChart3,
  Settings,
  RefreshCw,
  AlertCircle,
  Loader2,
  Camera,
  Activity,
  MapPin
} from 'lucide-react'
import {
  fetchInstagramData,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  saveInstagramConfig,
  clearInstagramConfig,
  saveInstagramSnapshot,
  fetchInstagramHistory,
  InstagramMetrics,
  InstagramHistoryResponse,
} from '@/lib/instagramApi'
import { useTheme } from '@/contexts/theme-context'
import { InstagramFollowersHistoryChart } from '@/components/conteudo-redes/instagram-followers-history-chart'
import { InstagramContentTypeComparison } from '@/components/conteudo-redes/instagram-content-type-comparison'
import { InstagramThemeComparisonTable } from '@/components/conteudo-redes/instagram-theme-comparison-table'
import { mapMetricsPostsToDayRecords } from '@/lib/instagram-day-posts'
import { cn } from '@/lib/utils'
import { municipalityCardClass } from '@/lib/premium-ui-classes'
import {
  conteudoRedesAmberTextClass,
  conteudoRedesGhostButtonClass,
  conteudoRedesPillFilterActiveClass,
  conteudoRedesPillInputClass,
  conteudoRedesTextClass,
} from '@/lib/conteudo-redes-styles'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { InstagramAudienceKpiStrip } from '@/components/conteudo-redes/instagram-audience-kpi-strip'
import { PremiumMetricCard } from '@/components/premium/metric-card'
import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import { ChampionPostCard } from '@/components/conteudo-redes/champion-post-card'
import {
  IconAlertCircle,
  IconLoader2,
  IconMapPin,
  IconRefresh,
  IconSettings,
  IconUsers,
  IconX,
} from '@tabler/icons-react'

const producao = [
  { etapa: 'Roteiro', quantidade: 3, cor: 'bg-[#C8900A]/10 border-[#C8900A]/30' },
  { etapa: 'Gravação', quantidade: 2, cor: 'bg-status-warning/10 border-status-warning/30' },
  { etapa: 'Edição', quantidade: 4, cor: 'bg-status-warning/10 border-status-warning/30' },
  { etapa: 'Aprovação', quantidade: 1, cor: 'bg-status-success/10 border-status-success/30' },
  { etapa: 'Publicado', quantidade: 12, cor: 'bg-status-success/10 border-status-success/30' },
]

// Dados mockados de posts para a aba de Audiência
const mockPosts = [
  {
    id: '1',
    type: 'image',
    url: 'https://instagram.com/p/1',
    thumbnail: 'https://via.placeholder.com/200',
    caption: 'Post sobre saúde pública e bem-estar da população',
    postedAt: '2024-01-15T10:00:00',
    metrics: {
      likes: 1250,
      comments: 45,
      views: 8500,
      shares: 12,
      saves: 89,
      engagement: 1396,
    },
  },
  {
    id: '2',
    type: 'video',
    url: 'https://instagram.com/p/2',
    thumbnail: 'https://via.placeholder.com/200',
    caption: 'Vídeo sobre educação e investimentos na área',
    postedAt: '2024-01-14T15:30:00',
    metrics: {
      likes: 2100,
      comments: 78,
      views: 12000,
      shares: 25,
      saves: 156,
      engagement: 2359,
    },
  },
  {
    id: '3',
    type: 'carousel',
    url: 'https://instagram.com/p/3',
    thumbnail: 'https://via.placeholder.com/200',
    caption: 'Carrossel mostrando obras e melhorias na cidade',
    postedAt: '2024-01-13T18:00:00',
    metrics: {
      likes: 1890,
      comments: 62,
      views: 9800,
      shares: 18,
      saves: 124,
      engagement: 1994,
    },
  },
  {
    id: '4',
    type: 'image',
    url: 'https://instagram.com/p/4',
    thumbnail: 'https://via.placeholder.com/200',
    caption: 'Anúncio sobre novo programa social',
    postedAt: '2024-01-12T14:00:00',
    metrics: {
      likes: 980,
      comments: 32,
      views: 6500,
      shares: 8,
      saves: 67,
      engagement: 1087,
    },
  },
]

// Temas padrão da outra aplicação
const defaultThemes = [
  'Atendimentos',
  'Autismo',
  'Campanha',
  'Causa Animal',
  'Depoimento',
  'Dica',
  'Eca Digital',
  'Educação',
  'Evento',
  'Família',
  'Hospital do Amor',
  'Informativo',
  'Obras',
  "PL'S",
  'Pesquisas',
  'Promoção',
  'Saúde',
  'Segurança',
  'Outros'
]

type PostClassification = {
  theme?: string
  isBoosted?: boolean
  obraMapaId?: string | null
}

function isTemaObras(theme: string | undefined | null): boolean {
  return String(theme || '').trim().toLowerCase() === 'obras'
}

function obraOptionLabel(obra: { municipio: string; obra?: string | null; tipo?: string | null }): string {
  const nome = (obra.obra || obra.tipo || 'Obra').trim()
  const muni = obra.municipio?.trim() || 'Município'
  const curto = nome.length > 48 ? `${nome.slice(0, 48)}…` : nome
  return `${muni} — ${curto}`
}

export default function ConteudoPage() {
  const { theme } = useTheme()
  const isCockpit = false
  const sectionShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'border-card bg-surface shadow-card'
  const innerPanelClass = isCockpit
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
    : 'border-card bg-background/50'
  const sectionWrapClass = cn('mb-6 rounded-2xl border p-4', sectionShellClass)

  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'audience' | 'locations'>('posts')
  const [locationsMode, setLocationsMode] = useState<'followers' | 'engaged'>('followers')
  const [overviewThemeFilter, setOverviewThemeFilter] = useState<string>('all')
  const [overviewBoostedFilter, setOverviewBoostedFilter] = useState<string>('all')
  const [postClassifications, setPostClassifications] = useState<Record<string, PostClassification>>({})
  
  // Estados para Instagram
  const [isConfigured, setIsConfigured] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<{ token: string; businessAccountId: string } | null>(null)
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState('30d')
  const [metricsHistory, setMetricsHistory] = useState<InstagramHistoryResponse | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Estados para temas customizados
  const [customThemes, setCustomThemes] = useState<string[]>([])
  const [availableThemes, setAvailableThemes] = useState<string[]>(defaultThemes)
  const [obrasMapa, setObrasMapa] = useState<import('@/lib/obras-mapa').ObraMapaRow[]>([])
  const [showAddTheme, setShowAddTheme] = useState<string | null>(null) // ID do post que está adicionando tema
  const [newTheme, setNewTheme] = useState('')

  // Função para obter identificador único do post
  const getPostIdentifier = (post: { id: string; postedAt?: string; caption?: string }) => {
    if (post.id) return post.id
    if (post.postedAt && post.caption) {
      const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
      const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
      return `${dateStr}_${captionHash}`
    }
    return `post_${Date.now()}`
  }

  // Ref para detectar cliques fora do modal
  const themeModalRef = useRef<HTMLDivElement>(null)

  // Fechar modal ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeModalRef.current && !themeModalRef.current.contains(event.target as Node)) {
        setShowAddTheme(null)
        setNewTheme('')
      }
    }

    if (showAddTheme) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddTheme])

  // Carregar temas customizados do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('instagram_custom_themes')
      if (saved) {
        try {
          const themes = JSON.parse(saved)
          setCustomThemes(themes)
          setAvailableThemes([...defaultThemes, ...themes])
        } catch (e) {
          // Erro silencioso
        }
      }
    }
  }, [])

  // Função para adicionar novo tema
  const handleAddTheme = (postId: string, currentIsBoosted: boolean) => {
    const themeName = newTheme.trim()
    if (themeName && !availableThemes.includes(themeName)) {
      const updatedCustomThemes = [...customThemes, themeName]
      setCustomThemes(updatedCustomThemes)
      setAvailableThemes([...defaultThemes, ...updatedCustomThemes])
      
      // Salvar no localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('instagram_custom_themes', JSON.stringify(updatedCustomThemes))
      }
      
      // Aplicar o novo tema ao post que estava sendo editado
      const postsToDisplay = metrics?.posts || mockPosts
      const post = postsToDisplay.find(p => getPostIdentifier(p) === postId)
      if (post) {
        saveClassification(post, themeName, currentIsBoosted)
      }
      
      setNewTheme('')
      setShowAddTheme(null)
    }
  }

  // Carregar classificações do backend
  useEffect(() => {
    const loadClassifications = async () => {
      try {
        const response = await fetch('/api/instagram/classifications')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.classifications) {
            setPostClassifications(data.classifications)
            // Também salvar no localStorage como cache
            if (typeof window !== 'undefined') {
              localStorage.setItem('instagram_post_classifications', JSON.stringify(data.classifications))
            }
          }
        }
      } catch (error) {
        // Fallback: tentar carregar do localStorage
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('instagram_post_classifications')
          if (saved) {
            try {
              setPostClassifications(JSON.parse(saved))
            } catch (e) {
              // Erro silencioso
            }
          }
        }
      }
    }

    loadClassifications()

    const loadObrasMapa = async () => {
      try {
        const response = await fetch('/api/obras/mapa?escopo=lista&periodo=todos')
        if (!response.ok) return
        const data = await response.json()
        const list = Array.isArray(data?.obras) ? data.obras : Array.isArray(data) ? data : []
        setObrasMapa(list)
      } catch {
        // silencioso — seletor de obra fica vazio
      }
    }
    void loadObrasMapa()
  }, [])

  // Função para salvar classificação
  const saveClassification = async (
    post: { id: string; postedAt?: string; caption?: string },
    theme: string,
    isBoosted: boolean,
    obraMapaId?: string | null
  ) => {
    const identifier = getPostIdentifier(post)
    const obraId = isTemaObras(theme) ? (obraMapaId ?? null) : null

    const updated = {
      ...postClassifications,
      [identifier]: {
        theme: theme || undefined,
        isBoosted,
        obraMapaId: obraId,
      },
    }
    setPostClassifications(updated)

    if (typeof window !== 'undefined') {
      localStorage.setItem('instagram_post_classifications', JSON.stringify(updated))
    }

    try {
      const response = await fetch('/api/instagram/classifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id || undefined,
          postDate: post.postedAt || undefined,
          postCaption: post.caption || undefined,
          theme: theme || '',
          isBoosted,
          obraMapaId: obraId,
        }),
      })

      if (!response.ok) {
        // Erro silencioso
      }
    } catch (error) {
      // Erro silencioso
    }
  }

  // Função para calcular comparação
  const getComparison = (current: number, previous: number | null) => {
    if (!previous || previous === 0) return null
    const diff = ((current - previous) / previous) * 100
    return {
      value: diff,
      isBetter: diff > 0,
      isWorse: diff < 0,
      isEqual: diff === 0,
    }
  }

  // Componente de badge de comparação
  const ComparisonBadge = ({ comparison, label }: { comparison: any; label: string }) => {
    if (!comparison) return null
    
    if (comparison.isEqual) {
      return (
        <span className="text-xs" title={`Igual ao post anterior`}>
          =
        </span>
      )
    }
    
    const color = comparison.isBetter ? 'text-status-success' : 'text-status-error'
    const icon = comparison.isBetter ? '↑' : '↓'
    const sign = comparison.isBetter ? '+' : ''
    
    return (
      <span 
        className={`text-xs font-semibold ${color}`}
        title={`${label}: ${sign}${comparison.value.toFixed(1)}% em relação ao post anterior`}
      >
        {icon} {sign}{Math.abs(comparison.value).toFixed(1)}%
      </span>
    )
  }

  const typeLabels = {
    image: 'Imagem',
    video: 'Vídeo',
    carousel: 'Carrossel',
  }

  // Carregar configuração ao montar: localStorage síncrono primeiro (evita objeto vazio no modal que sobrescrevia o cache)
  useEffect(() => {
    const sync = loadInstagramConfig()
    if (sync.token && sync.businessAccountId) {
      setConfig(sync)
      setIsConfigured(true)
      setShowConfig(false)
      setError(null)
      fetchData(sync).catch((err) => {
        console.error('Erro ao carregar dados do Instagram:', err)
      })
      return
    }

    let cancelled = false
    const loadConfig = async () => {
      const savedConfig = await loadInstagramConfigAsync()
      if (cancelled) return
      if (savedConfig.token && savedConfig.businessAccountId) {
        setConfig(savedConfig)
        setIsConfigured(true)
        setShowConfig(false)
        setError(null)
        fetchData(savedConfig).catch((err) => {
          console.error('Erro ao carregar dados do Instagram:', err)
        })
      } else {
        setConfig(null)
        setIsConfigured(false)
        setError(null)
      }
    }
    void loadConfig()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isConfigured) return
    void loadMetricsHistory()
  }, [dateRange, isConfigured])

  // Função para buscar histórico de métricas
  const loadMetricsHistory = async () => {
    setLoadingHistory(true)
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '90d' ? 90 : 30
      const history = await fetchInstagramHistory(days)
      setMetricsHistory(history)
    } catch (err) {
      console.error('Erro ao buscar histórico:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Função para buscar dados do Instagram
  const fetchData = async (instagramConfig: { token: string; businessAccountId: string }, forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchInstagramData(
        instagramConfig.token,
        instagramConfig.businessAccountId,
        dateRange,
        forceRefresh
      )

      if (data) {
        console.log('[Frontend] Dados do Instagram recebidos:', {
          username: data.username,
          followers: data.followers?.total,
          hasDemographics: !!data.demographics,
          hasTopLocations: !!data.demographics?.topLocations,
          topLocationsCount: data.demographics?.topLocations ? Object.keys(data.demographics.topLocations).length : 0,
          engagedTopLocationsCount: data.demographics?.engagedTopLocations
            ? Object.keys(data.demographics.engagedTopLocations).length
            : 0,
          topLocations: data.demographics?.topLocations,
        })
        setMetrics(data)
        setIsConfigured(true)
        setShowConfig(false) // Garantir que o modal não está aberto
        
        // Salvar snapshot diário automaticamente
        await saveInstagramSnapshot(data)
        
        // Buscar histórico de métricas
        loadMetricsHistory()
      } else {
        setError('Erro ao buscar dados do Instagram')
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Erro ao conectar com Instagram'
      setError(errorMessage)
      
      // Não limpar credenciais automaticamente em caso de erro
      // Apenas mostrar erro, mas manter credenciais salvas
      // O usuário pode tentar novamente ou atualizar as credenciais manualmente
    } finally {
      setLoading(false)
    }
  }

  // Função para salvar configuração
  const handleSaveConfig = (newConfig: { token: string; businessAccountId: string }) => {
    saveInstagramConfig(newConfig.token, newConfig.businessAccountId)
    setConfig(newConfig)
    setIsConfigured(true)
    setShowConfig(false)
    fetchData(newConfig)
  }

  // Função para desconectar
  const handleDisconnect = () => {
    clearInstagramConfig()
    setConfig(null)
    setIsConfigured(false)
    setMetrics(null)
    // Só mostrar modal quando usuário explicitamente desconectar
    setShowConfig(true)
  }

  // Função para atualizar dados
  const handleRefresh = () => {
    if (config?.token && config?.businessAccountId) {
      fetchData(config, true)
    }
  }

  // Usar posts reais se disponível, senão usar mock
  const postsToDisplay = metrics?.posts || mockPosts

  const postsForEngagementChart = useMemo(
    () =>
      (metrics?.posts ?? []).map((post) => ({
        postedAt: post.postedAt,
        engagement: post.metrics.engagement || 0,
      })),
    [metrics?.posts]
  )

  const livePostsForChart = useMemo(
    () => mapMetricsPostsToDayRecords(metrics?.posts ?? []),
    [metrics?.posts]
  )

  // Calcular estatísticas por tipo de conteúdo
  const contentStats = useMemo(() => {
    const posts = postsToDisplay
    
    if (!posts || posts.length === 0) return null
    
    const stats = {
      image: { posts: 0, likes: 0, comments: 0, views: 0, shares: 0, saves: 0, engagement: 0 },
      video: { posts: 0, likes: 0, comments: 0, views: 0, shares: 0, saves: 0, engagement: 0 },
      carousel: { posts: 0, likes: 0, comments: 0, views: 0, shares: 0, saves: 0, engagement: 0 }
    }
    
    posts.forEach((post: any) => {
      const type = post.type as 'image' | 'video' | 'carousel'
      if (stats[type]) {
        stats[type].posts++
        stats[type].likes += post.metrics.likes || 0
        stats[type].comments += post.metrics.comments || 0
        stats[type].views += post.metrics.views || 0
        stats[type].shares += post.metrics.shares || 0
        stats[type].saves += post.metrics.saves || 0
        stats[type].engagement += post.metrics.engagement || 0
      }
    })
    
    // Calcular médias
    return {
      image: {
        posts: stats.image.posts,
        avgLikes: stats.image.posts > 0 ? Math.round(stats.image.likes / stats.image.posts) : 0,
        avgComments: stats.image.posts > 0 ? Math.round(stats.image.comments / stats.image.posts) : 0,
        avgViews: stats.image.posts > 0 ? Math.round(stats.image.views / stats.image.posts) : 0,
        avgShares: stats.image.posts > 0 ? Math.round(stats.image.shares / stats.image.posts) : 0,
        avgSaves: stats.image.posts > 0 ? Math.round(stats.image.saves / stats.image.posts) : 0,
        avgEngagement: stats.image.posts > 0 ? Math.round(stats.image.engagement / stats.image.posts) : 0,
        totalLikes: stats.image.likes,
        totalComments: stats.image.comments,
        totalViews: stats.image.views,
        totalShares: stats.image.shares,
        totalSaves: stats.image.saves,
        totalEngagement: stats.image.engagement
      },
      video: {
        posts: stats.video.posts,
        avgLikes: stats.video.posts > 0 ? Math.round(stats.video.likes / stats.video.posts) : 0,
        avgComments: stats.video.posts > 0 ? Math.round(stats.video.comments / stats.video.posts) : 0,
        avgViews: stats.video.posts > 0 ? Math.round(stats.video.views / stats.video.posts) : 0,
        avgShares: stats.video.posts > 0 ? Math.round(stats.video.shares / stats.video.posts) : 0,
        avgSaves: stats.video.posts > 0 ? Math.round(stats.video.saves / stats.video.posts) : 0,
        avgEngagement: stats.video.posts > 0 ? Math.round(stats.video.engagement / stats.video.posts) : 0,
        totalLikes: stats.video.likes,
        totalComments: stats.video.comments,
        totalViews: stats.video.views,
        totalShares: stats.video.shares,
        totalSaves: stats.video.saves,
        totalEngagement: stats.video.engagement
      },
      carousel: {
        posts: stats.carousel.posts,
        avgLikes: stats.carousel.posts > 0 ? Math.round(stats.carousel.likes / stats.carousel.posts) : 0,
        avgComments: stats.carousel.posts > 0 ? Math.round(stats.carousel.comments / stats.carousel.posts) : 0,
        avgViews: stats.carousel.posts > 0 ? Math.round(stats.carousel.views / stats.carousel.posts) : 0,
        avgShares: stats.carousel.posts > 0 ? Math.round(stats.carousel.shares / stats.carousel.posts) : 0,
        avgSaves: stats.carousel.posts > 0 ? Math.round(stats.carousel.saves / stats.carousel.posts) : 0,
        avgEngagement: stats.carousel.posts > 0 ? Math.round(stats.carousel.engagement / stats.carousel.posts) : 0,
        totalLikes: stats.carousel.likes,
        totalComments: stats.carousel.comments,
        totalViews: stats.carousel.views,
        totalShares: stats.carousel.shares,
        totalSaves: stats.carousel.saves,
        totalEngagement: stats.carousel.engagement
      }
    }
  }, [postsToDisplay])

  // Calcular estatísticas por tema de classificação
  const themeStats = useMemo(() => {
    const posts = postsToDisplay
    
    if (!posts || posts.length === 0 || Object.keys(postClassifications).length === 0) return null
    
    const stats: Record<string, {
      posts: number
      likes: number
      comments: number
      views: number
      shares: number
      saves: number
      engagement: number
      avgLikes: number
      avgComments: number
      avgViews: number
      avgShares: number
      avgSaves: number
      avgEngagement: number
    }> = {}
    
    posts.forEach((post: any) => {
      const identifier = getPostIdentifier(post)
      const classification = postClassifications[identifier]
      
      if (classification?.theme) {
        const theme = classification.theme
        if (!stats[theme]) {
          stats[theme] = {
            posts: 0,
            likes: 0,
            comments: 0,
            views: 0,
            shares: 0,
            saves: 0,
            engagement: 0,
            avgLikes: 0,
            avgComments: 0,
            avgViews: 0,
            avgShares: 0,
            avgSaves: 0,
            avgEngagement: 0
          }
        }
        
        stats[theme].posts++
        stats[theme].likes += post.metrics.likes || 0
        stats[theme].comments += post.metrics.comments || 0
        stats[theme].views += post.metrics.views || 0
        stats[theme].shares += post.metrics.shares || 0
        stats[theme].saves += post.metrics.saves || 0
        stats[theme].engagement += post.metrics.engagement || 0
      }
    })
    
    // Calcular médias
    Object.keys(stats).forEach(theme => {
      const s = stats[theme]
      s.avgLikes = s.posts > 0 ? Math.round(s.likes / s.posts) : 0
      s.avgComments = s.posts > 0 ? Math.round(s.comments / s.posts) : 0
      s.avgViews = s.posts > 0 ? Math.round(s.views / s.posts) : 0
      s.avgShares = s.posts > 0 ? Math.round(s.shares / s.posts) : 0
      s.avgSaves = s.posts > 0 ? Math.round(s.saves / s.posts) : 0
      s.avgEngagement = s.posts > 0 ? Math.round(s.engagement / s.posts) : 0
    })
    
    return stats
  }, [postsToDisplay, postClassifications])

  // Filtrar posts
  const filteredPosts = useMemo(() => {
    let posts = [...postsToDisplay]
    
    posts = posts.filter(post => {
      const identifier = getPostIdentifier(post)
      const classification = postClassifications[identifier]
      
      const themeMatch = overviewThemeFilter === 'all' || classification?.theme === overviewThemeFilter
      const boostedMatch = overviewBoostedFilter === 'all' || 
        (overviewBoostedFilter === 'boosted' && classification?.isBoosted) ||
        (overviewBoostedFilter === 'organic' && !classification?.isBoosted)
      
      return themeMatch && boostedMatch
    })
    
    return posts.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  }, [postsToDisplay, overviewThemeFilter, overviewBoostedFilter, postClassifications])

  const championPosts = useMemo(() => {
    if (filteredPosts.length === 0) return null

    return {
      likes: filteredPosts.reduce((best, post) =>
        post.metrics.likes > best.metrics.likes ? post : best, filteredPosts[0]),
      comments: filteredPosts.reduce((best, post) =>
        post.metrics.comments > best.metrics.comments ? post : best, filteredPosts[0]),
      views: filteredPosts.reduce((best, post) =>
        (post.metrics.views || 0) > (best.metrics.views || 0) ? post : best, filteredPosts[0]),
      shares: filteredPosts.reduce((best, post) =>
        (post.metrics.shares || 0) > (best.metrics.shares || 0) ? post : best, filteredPosts[0]),
      saves: filteredPosts.reduce((best, post) =>
        (post.metrics.saves || 0) > (best.metrics.saves || 0) ? post : best, filteredPosts[0]),
      engagement: filteredPosts.reduce((best, post) =>
        post.metrics.engagement > best.metrics.engagement ? post : best, filteredPosts[0]),
    }
  }, [filteredPosts])

  const pageSubtitle = useMemo(() => {
    if (!config) return 'Conecte o Instagram para ver posts e insights'
    if (loading && !metrics) return 'Carregando métricas do Instagram…'
    const followers = metrics?.followers?.total?.toLocaleString('pt-BR') ?? '0'
    const postsCount = metrics?.posts?.length ?? 0
    return `${followers} seguidores · ${postsCount} publicações no período`
  }, [config, loading, metrics])

  const audienceKpiData = useMemo(
    () => ({
      followers: metrics?.followers?.total ?? 0,
      profileViews: metrics?.insights?.profileViews ?? 0,
      reach: metrics?.insights?.reach ?? 0,
      websiteClicks: metrics?.insights?.websiteClicks ?? 0,
      periodGrowth: metricsHistory?.summary?.growth,
      growthPercentage: metricsHistory?.summary?.growthPercentage,
      totalProfileViewsInPeriod: metricsHistory?.summary?.totalProfileViews,
    }),
    [metrics, metricsHistory?.summary]
  )

  const headerActions = (
    <>
      {config ? (
        <>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className={cn(conteudoRedesGhostButtonClass, 'disabled:opacity-50')}
          >
            <IconRefresh
              className={cn('h-[14px] w-[14px] opacity-70', loading && 'animate-spin')}
              stroke={1.5}
              aria-hidden
            />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className={cn(
              conteudoRedesGhostButtonClass,
              'border-status-error/30 text-status-error hover:bg-status-error/10',
            )}
          >
            <IconX className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
            Desconectar
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => setShowConfig(true)}
        className={sidebarPrimaryCTAButtonClass(isCockpit)}
      >
        <IconSettings className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
        {config ? 'Configurar Instagram' : 'Conectar Instagram'}
      </button>
    </>
  )

  return (
    <>
      <ConteudoRedesShell
        activeTab={activeSubTab}
        onTabChange={setActiveSubTab}
        metaLine={pageSubtitle}
        tabActions={headerActions}
      >
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-status-error/30 bg-status-error/10 p-4">
            <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-error" stroke={1.5} />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Erro ao carregar dados</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Conteúdo da sub-tab Posts & Insights */}
          {activeSubTab === 'posts' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="py-12 text-center">
                  <IconLoader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#C8900A]" stroke={1.5} />
                  <p className="text-sm">Carregando dados do Instagram...</p>
                  </div>
              ) : !isConfigured ? (
                <div className="py-12 text-center">
                  <IconAlertCircle className="mx-auto mb-4 h-12 w-12 opacity-70" stroke={1.5} />
                  <p className="mb-4 text-sm">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowConfig(true)}
                    className={sidebarPrimaryCTAButtonClass(isCockpit)}
                  >
                    Conectar Instagram
                  </button>
                </div>
              ) : (
                <>
                  <section className={sectionWrapClass}>
                    <InstagramFollowersHistoryChart
                      metricsHistory={metricsHistory}
                      loading={loadingHistory}
                      dateRange={dateRange}
                      onDateRangeChange={setDateRange}
                      onRefresh={loadMetricsHistory}
                      currentFollowers={metrics?.followers?.total}
                      posts={postsForEngagementChart}
                      livePosts={livePostsForChart}
                    />
                  </section>

                  {contentStats ? (
                <>
                  <InstagramContentTypeComparison
                    contentStats={contentStats}
                    sectionClassName={sectionWrapClass}
                    panelClassName={innerPanelClass}
                  />

                  {themeStats && Object.keys(themeStats).length > 0 && (
                    <InstagramThemeComparisonTable
                      themeStats={themeStats}
                      sectionClassName={sectionWrapClass}
                      panelClassName={innerPanelClass}
                    />
                  )}

                  <section className={sectionWrapClass}>
                    <PremiumSectionHeader
                      title="Campeões por Indicador"
                      description="Postagens que se destacaram em cada métrica"
                    />
                    {(overviewThemeFilter !== 'all' || overviewBoostedFilter !== 'all') && (
                      <div className="mb-4 flex flex-wrap items-center gap-2">
                        {overviewThemeFilter !== 'all' && (
                          <span className={conteudoRedesPillFilterActiveClass}>Tema: {overviewThemeFilter}</span>
                        )}
                        {overviewBoostedFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 rounded-[99px] border border-status-warning/30 bg-status-warning/10 px-2.5 py-1 text-[11.5px] font-medium text-status-warning">
                            {overviewBoostedFilter === 'boosted' ? 'Impulsionadas' : 'Orgânicas'}
                          </span>
                        )}
                      </div>
                    )}

                    {!championPosts ? (
                      <div className="py-8 text-center">
                        <FileText className="mx-auto mb-4 h-12 w-12 opacity-70" />
                        <p className="text-sm">
                          Nenhuma postagem encontrada para os filtros selecionados
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <ChampionPostCard
                          title="Mais Curtidas"
                          icon={Heart}
                          post={championPosts.likes}
                          metricValue={championPosts.likes.metrics.likes}
                          panelClassName={innerPanelClass}
                        />
                        <ChampionPostCard
                          title="Mais Comentários"
                          icon={MessageCircle}
                          post={championPosts.comments}
                          metricValue={championPosts.comments.metrics.comments}
                          panelClassName={innerPanelClass}
                        />
                        <ChampionPostCard
                          title="Mais Visualizações"
                          icon={Eye}
                          post={championPosts.views}
                          metricValue={championPosts.views.metrics.views || 0}
                          panelClassName={innerPanelClass}
                        />
                        <ChampionPostCard
                          title="Mais Compartilhamentos"
                          icon={Share2}
                          post={championPosts.shares}
                          metricValue={championPosts.shares.metrics.shares || 0}
                          panelClassName={innerPanelClass}
                        />
                        <ChampionPostCard
                          title="Mais Salvamentos"
                          icon={Download}
                          post={championPosts.saves}
                          metricValue={championPosts.saves.metrics.saves || 0}
                          panelClassName={innerPanelClass}
                        />
                        <ChampionPostCard
                          title="Maior Engajamento"
                          icon={TrendingUp}
                          post={championPosts.engagement}
                          metricValue={championPosts.engagement.metrics.engagement}
                          panelClassName={innerPanelClass}
                        />
                      </div>
                    )}
                  </section>


                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto mb-4 h-12 w-12 opacity-70" />
                  <p className="text-sm">
                    Nenhum dado disponível. Classifique algumas postagens para ver os comparativos.
                  </p>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {/* Conteúdo da sub-tab Audiência - Estrutura correta */}
          {activeSubTab === 'audience' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="py-12 text-center">
                  <IconLoader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#C8900A]" stroke={1.5} />
                  <p className="text-sm">Carregando dados do Instagram...</p>
                </div>
              ) : !isConfigured ? (
                <div className="py-12 text-center">
                  <IconAlertCircle className="mx-auto mb-4 h-12 w-12 opacity-70" stroke={1.5} />
                  <p className="mb-4 text-sm">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowConfig(true)}
                    className={sidebarPrimaryCTAButtonClass(isCockpit)}
                  >
                    Conectar Instagram
                  </button>
                      </div>
              ) : (
                <>
              <section className={sectionWrapClass}>
                <PremiumSectionHeader
                  title="Evolução de Seguidores & Métricas"
                  description="Acompanhe o crescimento da sua audiência e visitas ao perfil ao longo do tempo"
                  actions={
                    <button
                      type="button"
                      onClick={loadMetricsHistory}
                      disabled={loadingHistory}
                      className={cn(conteudoRedesGhostButtonClass, 'disabled:opacity-50')}
                    >
                      {loadingHistory ? (
                        <IconLoader2 className="h-[14px] w-[14px] animate-spin opacity-70" />
                      ) : (
                        <IconRefresh className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
                      )}
                      Atualizar
                    </button>
                  }
                />

                <InstagramAudienceKpiStrip {...audienceKpiData} />
              </section>

              <section className={sectionWrapClass}>
                <PremiumSectionHeader
                  title="Publicações por Tipo de Conteúdo"
                  description="Visualize todas as postagens para identificar qual conteúdo tem melhor aceitação. Comparação com o post anterior."
                />

                <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-4">
                  <span className="text-[11px] font-medium uppercase tracking-wide">
                    Filtros
                  </span>
                  <div className="h-4 w-px bg-[rgb(var(--color-border-tertiary))]" />
                  <select
                    value={overviewThemeFilter}
                    onChange={(e) => setOverviewThemeFilter(e.target.value)}
                    className={cn(conteudoRedesPillInputClass, 'pr-8')}
                    aria-label="Filtrar por tema"
                  >
                    <option value="all">Todos os temas</option>
                    {availableThemes.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                  <select
                    value={overviewBoostedFilter}
                    onChange={(e) => setOverviewBoostedFilter(e.target.value)}
                    className={cn(conteudoRedesPillInputClass, 'pr-8')}
                    aria-label="Filtrar por impulsionamento"
                  >
                    <option value="all">Todas</option>
                    <option value="boosted">Impulsionadas</option>
                    <option value="organic">Orgânicas</option>
                  </select>
                  {(overviewThemeFilter !== 'all' || overviewBoostedFilter !== 'all') && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setOverviewThemeFilter('all')
                          setOverviewBoostedFilter('all')
                        }}
                        className={conteudoRedesGhostButtonClass}
                      >
                        <IconX className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
                        Limpar
                      </button>
                      <span className="text-[11px]">
                        {filteredPosts.length}{' '}
                        {filteredPosts.length === 1 ? 'postagem' : 'postagens'}
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-3">
                  {filteredPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="mx-auto mb-4 h-12 w-12 opacity-70" />
                      <p>
                        Nenhuma postagem encontrada para os filtros selecionados
                      </p>
                    </div>
                  ) : (
                    filteredPosts.map((post, index) => {
                      const previousPost = index < filteredPosts.length - 1 ? filteredPosts[index + 1] : null
                      const identifier = getPostIdentifier(post)
                      const classification = postClassifications[identifier] || {}

                      const likesComparison = getComparison(
                        post.metrics.likes,
                        previousPost?.metrics.likes || null
                      )
                      const commentsComparison = getComparison(
                        post.metrics.comments,
                        previousPost?.metrics.comments || null
                      )
                      const viewsComparison = getComparison(
                        post.metrics.views || 0,
                        previousPost?.metrics.views || null
                      )
                      const sharesComparison = getComparison(
                        post.metrics.shares || 0,
                        previousPost?.metrics.shares || null
                      )
                      const savesComparison = getComparison(
                        post.metrics.saves || 0,
                        previousPost?.metrics.saves || null
                      )

                      return (
                        <div
                          key={post.id}
                          className={cn(municipalityCardClass, 'border-2')}
                        >
                          <div className="flex flex-col sm:flex-row">
                            <div className="w-full sm:w-48 h-48 bg-background relative flex-shrink-0">
                              <div
                                className="w-full h-full bg-center bg-cover"
                                style={{ backgroundImage: `url(${post.thumbnail})` }}
                              />
                              <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                <div
                                  className={`text-white text-xs px-2 py-1 rounded ${
                                    post.type === 'video'
                                      ? 'bg-red-500'
                                      : post.type === 'carousel'
                                      ? 'bg-[#9A6B08]'
                                      : 'bg-[#C8900A]'
                                  }`}
                                >
                                  {typeLabels[post.type as keyof typeof typeLabels] || post.type}
                                </div>
                                {classification?.isBoosted && (
                                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Impulsionada
                                  </div>
                                )}
                                {classification?.theme && (
                                  <div className="bg-status-success text-white text-xs px-2 py-1 rounded">
                                    {classification.theme}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="p-3 flex-1 flex flex-col min-h-0">
                              <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
                                <div>
                                  <span className="text-xs">
                                    {new Date(post.postedAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <a
                                  href={post.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center text-[11px] font-medium text-[#C8900A] hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" /> Ver
                                </a>
                              </div>

                              <p className="text-xs line-clamp-2 mb-2 flex-shrink-0">
                                {post.caption || 'Sem legenda'}
                              </p>

                              {/* Campos de classificação */}
                              <div className="mb-2 flex gap-2 items-center flex-shrink-0 flex-wrap">
                                <div className="flex-1 relative">
                                  <select
                                    value={classification?.theme || ''}
                                    onChange={(e) => {
                                      if (e.target.value === '__add_new__') {
                                        const postId = getPostIdentifier(post)
                                        setShowAddTheme(postId)
                                      } else {
                                        const nextTheme = e.target.value
                                        const keepObra = isTemaObras(nextTheme)
                                          ? classification?.obraMapaId ?? null
                                          : null
                                        saveClassification(
                                          post,
                                          nextTheme,
                                          classification?.isBoosted ?? false,
                                          keepObra
                                        )
                                      }
                                    }}
                                    className="h-7 text-xs w-full px-2 border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-[#C8900A]/30"
                                  >
                                    <option value="">Tema</option>
                                    {availableThemes.map((theme) => (
                                      <option key={theme} value={theme}>
                                        {theme}
                                      </option>
                                    ))}
                                    <option value="__add_new__">+ Adicionar novo tema</option>
                                  </select>
                                  
                                  {/* Modal para adicionar novo tema - apenas para este post */}
                                  {showAddTheme === getPostIdentifier(post) && (
                                    <div 
                                      ref={themeModalRef}
                                      className="absolute top-full left-0 mt-1 z-50 bg-surface border border-card rounded-lg shadow-lg p-3 min-w-[200px]"
                                    >
                                      <div className="flex flex-col gap-2">
                                        <label className="text-xs font-medium">
                                          Novo Tema
                                        </label>
                                        <input
                                          type="text"
                                          value={newTheme}
                                          onChange={(e) => setNewTheme(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault()
                                              handleAddTheme(getPostIdentifier(post), classification?.isBoosted ?? false)
                                            } else if (e.key === 'Escape') {
                                              setShowAddTheme(null)
                                              setNewTheme('')
                                            }
                                          }}
                                          placeholder="Digite o nome do tema"
                                          className="text-xs px-2 py-1.5 border border-card rounded bg-background focus:outline-none focus:ring-2 focus:ring-[#C8900A]/30"
                                          autoFocus
                                        />
                                        {newTheme.trim() && availableThemes.includes(newTheme.trim()) && (
                                          <p className="text-xs text-status-error">
                                            Este tema já existe
                                          </p>
                                        )}
                                        <div className="flex gap-2">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              handleAddTheme(getPostIdentifier(post), classification?.isBoosted ?? false)
                                            }}
                                            disabled={!newTheme.trim() || availableThemes.includes(newTheme.trim())}
                                            className="flex-1 rounded-[10px] bg-[#C8900A] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#B07F09]"
                                          >
                                            Adicionar
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              setShowAddTheme(null)
                                              setNewTheme('')
                                            }}
                                            className="px-2 py-1.5 text-xs border border-card rounded hover:bg-background transition-colors"
                                          >
                                            Cancelar
                                          </button>
                </div>
              </div>
                                    </div>
                                  )}
                                </div>
                                {isTemaObras(classification?.theme) ? (
                                  <select
                                    value={classification?.obraMapaId || ''}
                                    onChange={(e) =>
                                      saveClassification(
                                        post,
                                        classification?.theme || 'Obras',
                                        classification?.isBoosted ?? false,
                                        e.target.value || null
                                      )
                                    }
                                    className="h-7 text-xs min-w-[160px] max-w-[220px] flex-[1.4] px-2 border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-[#C8900A]/30"
                                    title="Relacionar post à obra do Mapa / Diagnóstico"
                                  >
                                    <option value="">Obra (match)</option>
                                    {[...obrasMapa]
                                      .sort((a, b) =>
                                        a.municipio.localeCompare(b.municipio, 'pt-BR') ||
                                        String(a.obra || '').localeCompare(String(b.obra || ''), 'pt-BR')
                                      )
                                      .map((obra) => (
                                        <option key={obra.id} value={obra.id}>
                                          {obraOptionLabel(obra)}
                                        </option>
                                      ))}
                                  </select>
                                ) : null}
                                <select
                                  value={classification?.isBoosted ? 'sim' : 'nao'}
                                  onChange={(e) =>
                                    saveClassification(
                                      post,
                                      classification?.theme || '',
                                      e.target.value === 'sim',
                                      classification?.obraMapaId ?? null
                                    )
                                  }
                                  className="h-7 text-xs w-[90px] px-2 border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-[#C8900A]/30"
                                  title="Impulsionado?"
                                >
                                  <option value="nao">Não</option>
                                  <option value="sim">Sim</option>
                                </select>
            </div>

                              {/* Métricas */}
                              <div className="grid grid-cols-5 gap-1 text-center flex-1 items-end">
                                <div>
                                  <div className="flex items-center justify-center">
                                    <Heart className="h-3 w-3 text-red-500 mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.likes.toLocaleString('pt-BR')}
                                    </span>
                    </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px]">Curtidas</span>
                                    {previousPost && (
                                      <ComparisonBadge comparison={likesComparison} label="Curtidas" />
                                    )}
                  </div>
              </div>
                                <div>
                                  <div className="flex items-center justify-center">
                                    <MessageCircle className="h-3 w-3 text-[#C8900A] mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.comments.toLocaleString('pt-BR')}
                                    </span>
            </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px]">Coment.</span>
                                    {previousPost && (
                                      <ComparisonBadge
                                        comparison={commentsComparison}
                                        label="Comentários"
                                      />
                                    )}
          </div>
        </div>
                                <div>
                                  <div className="flex items-center justify-center">
                                    <Eye className="h-3 w-3 text-[#C8900A] mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.views
                                        ? post.metrics.views.toLocaleString('pt-BR')
                                        : 'N/A'}
                                    </span>
      </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px]">Visual.</span>
                                    {previousPost && viewsComparison && (
                                      <ComparisonBadge
                                        comparison={viewsComparison}
                                        label="Visualizações"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-center">
                                    <Share2 className="h-3 w-3 text-green-500 mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.shares > 0
                                        ? post.metrics.shares.toLocaleString('pt-BR')
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px]">Compart.</span>
                                    {previousPost && sharesComparison && (
                                      <ComparisonBadge
                                        comparison={sharesComparison}
                                        label="Compartilhamentos"
                                      />
                                    )}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center justify-center">
                                    <Download className="h-3 w-3 text-orange-500 mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.saves > 0
                                        ? post.metrics.saves.toLocaleString('pt-BR')
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px]">Salvam.</span>
                                    {previousPost && savesComparison && (
                                      <ComparisonBadge
                                        comparison={savesComparison}
                                        label="Salvamentos"
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
              </>
              )}
            </div>
          )}

          {/* Conteúdo da sub-tab Por Cidade */}
          {activeSubTab === 'locations' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="py-12 text-center">
                  <IconLoader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#C8900A]" stroke={1.5} />
                  <p className="text-sm">Carregando dados do Instagram...</p>
                </div>
              ) : !isConfigured ? (
                <div className="py-12 text-center">
                  <IconAlertCircle className="mx-auto mb-4 h-12 w-12 opacity-70" stroke={1.5} />
                  <p className="mb-4 text-sm">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowConfig(true)}
                    className={sidebarPrimaryCTAButtonClass(isCockpit)}
                  >
                    Conectar Instagram
                  </button>
                </div>
              ) : (
                <>
                  <section className={sectionWrapClass}>
                    <PremiumSectionHeader
                      title="Distribuição por cidade"
                      description="Top ~45 cidades via Instagram Graph API · seguidores (base) e engajamento com publicações"
                    />

                    <div className="mb-4 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLocationsMode('followers')}
                        className={
                          locationsMode === 'followers'
                            ? conteudoRedesPillFilterActiveClass
                            : cn(conteudoRedesGhostButtonClass, 'rounded-[99px] px-2.5 py-1 text-[13px]')
                        }
                      >
                        Seguidores
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocationsMode('engaged')}
                        className={
                          locationsMode === 'engaged'
                            ? conteudoRedesPillFilterActiveClass
                            : cn(conteudoRedesGhostButtonClass, 'rounded-[99px] px-2.5 py-1 text-[13px]')
                        }
                      >
                        Engajamento
                      </button>
                    </div>

                    {(() => {
                      const isEngaged = locationsMode === 'engaged'
                      const locationMap = isEngaged
                        ? metrics?.demographics?.engagedTopLocations
                        : metrics?.demographics?.topLocations
                      const entries = Object.entries(locationMap || {}).sort(([, a], [, b]) => b - a)
                      const mappedTotal = entries.reduce((sum, [, count]) => sum + count, 0)
                      const maxCount = Math.max(...entries.map(([, count]) => count), 0)
                      const totalFollowers = metrics?.followers?.total || 0
                      const unitLabel = isEngaged ? 'contas engajadas' : 'seguidores'
                      const metricLabel = isEngaged ? 'Engajamento mapeado' : 'Seguidores mapeados'
                      const pctBase = isEngaged ? mappedTotal : totalFollowers
                      const pctSuffix = isEngaged
                        ? 'do engajamento mapeado'
                        : 'do total de seguidores'

                      if (entries.length === 0) {
                        return (
                          <div className="py-12 text-center">
                            <IconMapPin
                              className={cn('mx-auto mb-4 h-12 w-12 opacity-70', conteudoRedesAmberTextClass)}
                              stroke={1.5}
                            />
                            <p className="mb-2 font-medium">
                              {isEngaged
                                ? 'Engajamento por cidade não disponível'
                                : 'Dados de localização não disponíveis'}
                            </p>
                            <p className="mx-auto max-w-lg text-sm">
                              {isEngaged
                                ? 'A API exige pelo menos 100 engajamentos no período (this_month) e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'
                                : 'A API exige conta profissional com 100+ seguidores e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'}{' '}
                              A Meta devolve só o top de cidades (não o histórico nem os 224 municípios).
                            </p>
                          </div>
                        )
                      }

                      return (
                        <>
                          <p className="mb-3 text-[12px] text-black/60">
                            {isEngaged
                              ? 'Quem interagiu com publicações no período (engaged_audience_demographics · this_month).'
                              : 'Base atual de seguidores (follower_demographics · last_30_days).'}
                          </p>
                          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-lg">
                            <PremiumMetricCard
                              label="Total de cidades"
                              value={entries.length}
                              icon={IconMapPin}
                            />
                            <PremiumMetricCard
                              label={metricLabel}
                              value={mappedTotal.toLocaleString('pt-BR')}
                              icon={IconUsers}
                            />
                          </div>

                          <div className="space-y-2">
                            {entries.map(([city, count], index) => {
                              const percentage =
                                pctBase > 0 ? ((count / pctBase) * 100).toFixed(1) : '0.0'
                              const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0

                              return (
                                <div key={`${locationsMode}-${city}`} className={cn(municipalityCardClass, 'p-4')}>
                                  <div className="mb-2 flex items-center justify-between">
                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                      <div
                                        className={cn(
                                          'flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium',
                                          index === 0
                                            ? 'bg-[#C8900A] text-white'
                                            : 'bg-[#C8900A]/12 text-[#C8900A]'
                                        )}
                                      >
                                        {index + 1}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13.5px] font-medium">{city}</p>
                                        <p className="text-[11px]">
                                          {percentage}% {pctSuffix}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="ml-4 text-right">
                                      <p className="text-base font-medium tabular-nums text-[#C8900A]">
                                        {count.toLocaleString('pt-BR')}
                                      </p>
                                      <p className="text-[11px]">{unitLabel}</p>
                                    </div>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-app">
                                    <div
                                      className="h-full rounded-full bg-[#C8900A] transition-all duration-500"
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )
                    })()}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      </ConteudoRedesShell>

      {/* Modal de Configuração do Instagram */}
      {showConfig && (
        <InstagramConfigModal
          onClose={() => {
            setShowConfig(false)
            if (!config?.token || !config?.businessAccountId) {
              const savedConfig = loadInstagramConfig()
              if (savedConfig.token && savedConfig.businessAccountId) {
                setConfig(savedConfig)
                setIsConfigured(true)
              }
            }
          }}
          onSave={handleSaveConfig}
          currentConfig={
            config && config.token && config.businessAccountId ? config : undefined
          }
        />
      )}
    </>
  )
}
