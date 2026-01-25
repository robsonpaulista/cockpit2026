'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Header } from '@/components/header'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
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
  InstagramHistoryResponse
} from '@/lib/instagramApi'

const producao = [
  { etapa: 'Roteiro', quantidade: 3, cor: 'bg-accent-gold-soft border-accent-gold/30' },
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
  "PL'S",
  'Pesquisas',
  'Promoção',
  'Saúde',
  'Segurança',
  'Outros'
]

export default function ConteudoPage() {
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'audience' | 'locations'>('posts')
  const [overviewThemeFilter, setOverviewThemeFilter] = useState<string>('all')
  const [overviewBoostedFilter, setOverviewBoostedFilter] = useState<string>('all')
  const [postClassifications, setPostClassifications] = useState<Record<string, { theme?: string; isBoosted?: boolean }>>({})
  
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
  }, [])

  // Função para salvar classificação
  const saveClassification = async (post: { id: string; postedAt?: string; caption?: string }, theme: string, isBoosted: boolean) => {
    const identifier = getPostIdentifier(post)
    
    // Atualizar estado local imediatamente
    const updated = {
      ...postClassifications,
      [identifier]: { theme: theme || undefined, isBoosted },
    }
    setPostClassifications(updated)
    
    // Salvar no localStorage como cache
    if (typeof window !== 'undefined') {
      localStorage.setItem('instagram_post_classifications', JSON.stringify(updated))
    }
    
    // Salvar no backend
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
        <span className="text-xs text-secondary" title={`Igual ao post anterior`}>
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

  // Carregar configuração ao montar
  useEffect(() => {
    const loadConfig = async () => {
      // Primeiro tenta localStorage, depois busca do servidor (variáveis de ambiente)
      const savedConfig = await loadInstagramConfigAsync()
      
      if (savedConfig.token && savedConfig.businessAccountId) {
        setConfig(savedConfig)
        setIsConfigured(true)
        setShowConfig(false)
        
        // Tentar carregar dados silenciosamente
        fetchData(savedConfig).catch((err) => {
          console.error('Erro ao carregar dados do Instagram:', err)
        })
      } else {
        // Sem credenciais disponíveis
        setConfig({ token: '', businessAccountId: '' })
        setIsConfigured(false)
        setError('Token e Business Account ID são obrigatórios')
      }
    }
    
    loadConfig()
  }, [])

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
          topLocations: data.demographics?.topLocations
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
    if (config) {
      fetchData(config, true)
    }
  }

  // Usar posts reais se disponível, senão usar mock
  const postsToDisplay = metrics?.posts || mockPosts

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

  return (
    <div className="min-h-screen bg-background">
      <Header title="Conteúdo & Redes Sociais" subtitle="Comunicação orientada a resultado" />

      <div className="px-4 py-6 lg:px-6">
        {/* Botões de Configuração e Atualização */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config && (
              <>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-sm font-medium border border-status-error/30 text-status-error rounded-lg hover:bg-status-error/10 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Desconectar
                </button>
              </>
            )}
          </div>
          <button
            onClick={() => setShowConfig(true)}
            className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {config ? 'Configurar Instagram' : 'Conectar Instagram'}
          </button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-status-error/30 bg-status-error/10 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-status-error">Erro ao carregar dados</p>
              <p className="text-xs text-secondary mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Visão Geral com sub-tabs */}
        <div className="space-y-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-primary mb-2">Visão Geral</h2>
            <p className="text-sm text-secondary">Análise de desempenho e audiência das redes sociais</p>
                      </div>
          
          {/* Sub-tabs dentro da Visão Geral */}
          <div className="flex gap-2 border-b border-card">
            <button
              onClick={() => setActiveSubTab('posts')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSubTab === 'posts'
                  ? 'text-accent-gold border-b-2 border-accent-gold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Calendar className="inline-block w-4 h-4 mr-2" />
              Posts & Insights
            </button>
            <button
              onClick={() => setActiveSubTab('audience')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSubTab === 'audience'
                  ? 'text-accent-gold border-b-2 border-accent-gold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Users className="inline-block w-4 h-4 mr-2" />
              Audiência
            </button>
            <button
              onClick={() => setActiveSubTab('locations')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSubTab === 'locations'
                  ? 'text-accent-gold border-b-2 border-accent-gold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <MapPin className="inline-block w-4 h-4 mr-2" />
              Seguidores por Cidade
            </button>
                    </div>

          {/* Conteúdo da sub-tab Posts & Insights */}
          {activeSubTab === 'posts' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-accent-gold animate-spin mx-auto mb-4" />
                  <p className="text-secondary">Carregando dados do Instagram...</p>
                  </div>
              ) : !isConfigured ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
                  <p className="text-secondary mb-4">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
                  >
                    Conectar Instagram
                  </button>
              </div>
              ) : contentStats ? (
                <>
                  {/* Campeões por Indicador */}
                  <div className="bg-surface rounded-2xl border border-card p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
                        <BarChart4 className="w-5 h-5 text-accent-gold" />
                        Campeões por Indicador
                      </h2>
                      <p className="text-sm text-secondary">
                        Postagens que se destacaram em cada métrica
                      </p>
                      {(overviewThemeFilter !== 'all' || overviewBoostedFilter !== 'all') && (
                        <div className="flex items-center gap-2 mt-3">
                          {overviewThemeFilter !== 'all' && (
                            <span className="px-2 py-1 bg-accent-gold-soft text-accent-gold rounded text-xs font-medium">
                              Tema: {overviewThemeFilter}
                            </span>
                          )}
                          {overviewBoostedFilter !== 'all' && (
                            <span className="px-2 py-1 bg-status-warning/10 text-status-warning rounded text-xs font-medium">
                              {overviewBoostedFilter === 'boosted' ? 'Impulsionadas' : 'Orgânicas'}
                            </span>
                          )}
              </div>
                      )}
            </div>

                    {(() => {
                      // Filtrar posts por tema e impulsionamento
                      const filteredPostsForChampions = filteredPosts

                      if (filteredPostsForChampions.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <FileText className="h-12 w-12 text-secondary mx-auto mb-4" />
                            <p className="text-secondary">
                              Nenhuma postagem encontrada para os filtros selecionados
                            </p>
                          </div>
                        )
                      }

                      // Encontrar melhor postagem para cada indicador
                      const bestLikes = filteredPostsForChampions.reduce((best, post) => 
                        post.metrics.likes > best.metrics.likes ? post : best, filteredPostsForChampions[0]
                      )
                      const bestComments = filteredPostsForChampions.reduce((best, post) => 
                        post.metrics.comments > best.metrics.comments ? post : best, filteredPostsForChampions[0]
                      )
                      const bestViews = filteredPostsForChampions.reduce((best, post) => 
                        (post.metrics.views || 0) > (best.metrics.views || 0) ? post : best, filteredPostsForChampions[0]
                      )
                      const bestShares = filteredPostsForChampions.reduce((best, post) => 
                        (post.metrics.shares || 0) > (best.metrics.shares || 0) ? post : best, filteredPostsForChampions[0]
                      )
                      const bestSaves = filteredPostsForChampions.reduce((best, post) => 
                        (post.metrics.saves || 0) > (best.metrics.saves || 0) ? post : best, filteredPostsForChampions[0]
                      )
                      const bestEngagement = filteredPostsForChampions.reduce((best, post) => 
                        post.metrics.engagement > best.metrics.engagement ? post : best, filteredPostsForChampions[0]
                      )

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Melhor em Curtidas */}
                          <div className="border rounded-lg p-3 bg-red-50/50 border-red-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Heart className="h-4 w-4 text-red-600" />
                              <span className="text-sm font-semibold text-red-900">Mais Curtidas</span>
                            </div>
                            {bestLikes && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestLikes.thumbnail && (
                                    <img 
                                      src={bestLikes.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestLikes.metrics.likes.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestLikes.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestLikes.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Melhor em Comentários */}
                          <div className="border rounded-lg p-3 bg-blue-50/50 border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageCircle className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900">Mais Comentários</span>
                            </div>
                            {bestComments && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestComments.thumbnail && (
                                    <img 
                                      src={bestComments.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestComments.metrics.comments.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestComments.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestComments.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Melhor em Visualizações */}
                          <div className="border rounded-lg p-3 bg-blue-50/50 border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Eye className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900">Mais Visualizações</span>
                            </div>
                            {bestViews && bestViews.metrics.views && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestViews.thumbnail && (
                                    <img 
                                      src={bestViews.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestViews.metrics.views.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestViews.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestViews.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Melhor em Compartilhamentos */}
                          <div className="border rounded-lg p-3 bg-green-50/50 border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Share2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-semibold text-green-900">Mais Compartilhamentos</span>
                            </div>
                            {bestShares && bestShares.metrics.shares > 0 && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestShares.thumbnail && (
                                    <img 
                                      src={bestShares.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestShares.metrics.shares.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestShares.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestShares.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Melhor em Salvamentos */}
                          <div className="border rounded-lg p-3 bg-orange-50/50 border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Download className="h-4 w-4 text-orange-600" />
                              <span className="text-sm font-semibold text-orange-900">Mais Salvamentos</span>
                            </div>
                            {bestSaves && bestSaves.metrics.saves > 0 && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestSaves.thumbnail && (
                                    <img 
                                      src={bestSaves.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-orange-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestSaves.metrics.saves.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestSaves.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestSaves.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Melhor em Engajamento */}
                          <div className="border rounded-lg p-3 bg-blue-50/50 border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900">Maior Engajamento</span>
                            </div>
                            {bestEngagement && (
                              <div className="space-y-2">
                                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                                  {bestEngagement.thumbnail && (
                                    <img 
                                      src={bestEngagement.thumbnail} 
                                      alt="Post" 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <div className="absolute top-1 right-1 bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                                    {bestEngagement.metrics.engagement.toLocaleString('pt-BR')}
                                  </div>
                                </div>
                                <p className="text-xs text-secondary line-clamp-2">{bestEngagement.caption || 'Sem legenda'}</p>
                                <a 
                                  href={bestEngagement.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-accent-gold hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" /> Ver postagem
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Comparativo de Aceitação por Tipo de Conteúdo */}
            <div className="bg-surface rounded-2xl border border-card p-6">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
                        <BarChart4 className="w-5 h-5 text-accent-gold" />
                        Comparativo de Aceitação por Tipo de Conteúdo
                      </h2>
                      <p className="text-sm text-secondary">
                        Análise comparativa de desempenho entre Imagens, Vídeos e Carrosséis
                      </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Imagens */}
                      <div className="border-2 border-card rounded-xl p-4 bg-surface">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-1">
                            <Camera className="h-5 w-5 text-blue-500" />
                            Imagens
                          </h3>
                          <p className="text-sm text-secondary">{contentStats.image.posts} postagens</p>
                        </div>
                        <div className="space-y-3">
                      <div>
                            <p className="text-xs text-secondary mb-2">Média por postagem</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3 text-red-500" />
                                  Curtidas:
                                </span>
                                <span className="font-semibold">{contentStats.image.avgLikes.toLocaleString('pt-BR')}</span>
                        </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3 text-blue-500" />
                                  Comentários:
                                </span>
                                <span className="font-semibold">{contentStats.image.avgComments.toLocaleString('pt-BR')}</span>
                      </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-blue-500" />
                                  Visualizações:
                        </span>
                                <span className="font-semibold">
                                  {contentStats.image.avgViews > 0 ? contentStats.image.avgViews.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Share2 className="h-3 w-3 text-green-500" />
                                  Compartilhamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.image.avgShares > 0 ? contentStats.image.avgShares.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Download className="h-3 w-3 text-orange-500" />
                                  Salvamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.image.avgSaves > 0 ? contentStats.image.avgSaves.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-accent-gold" />
                                  Engajamento:
                                </span>
                                <span className="font-semibold">{contentStats.image.avgEngagement.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                    </div>

                      {/* Vídeos */}
                      <div className="border-2 border-card rounded-xl p-4 bg-surface">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-1">
                            <Camera className="h-5 w-5 text-red-500" />
                            Vídeos
                          </h3>
                          <p className="text-sm text-secondary">{contentStats.video.posts} postagens</p>
                        </div>
                        <div className="space-y-3">
                      <div>
                            <p className="text-xs text-secondary mb-2">Média por postagem</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3 text-red-500" />
                                  Curtidas:
                                </span>
                                <span className="font-semibold">{contentStats.video.avgLikes.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3 text-blue-500" />
                                  Comentários:
                                </span>
                                <span className="font-semibold">{contentStats.video.avgComments.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-blue-500" />
                                  Visualizações:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.video.avgViews > 0 ? contentStats.video.avgViews.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Share2 className="h-3 w-3 text-green-500" />
                                  Compartilhamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.video.avgShares > 0 ? contentStats.video.avgShares.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Download className="h-3 w-3 text-orange-500" />
                                  Salvamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.video.avgSaves > 0 ? contentStats.video.avgSaves.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-accent-gold" />
                                  Engajamento:
                                </span>
                                <span className="font-semibold">{contentStats.video.avgEngagement.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Carrosséis */}
                      <div className="border-2 border-card rounded-xl p-4 bg-surface">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold text-primary flex items-center gap-2 mb-1">
                            <Camera className="h-5 w-5 text-blue-700" />
                            Carrosséis
                          </h3>
                          <p className="text-sm text-secondary">{contentStats.carousel.posts} postagens</p>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-secondary mb-2">Média por postagem</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Heart className="h-3 w-3 text-red-500" />
                                  Curtidas:
                                </span>
                                <span className="font-semibold">{contentStats.carousel.avgLikes.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3 text-blue-500" />
                                  Comentários:
                                </span>
                                <span className="font-semibold">{contentStats.carousel.avgComments.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 text-blue-500" />
                                  Visualizações:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.carousel.avgViews > 0 ? contentStats.carousel.avgViews.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Share2 className="h-3 w-3 text-green-500" />
                                  Compartilhamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.carousel.avgShares > 0 ? contentStats.carousel.avgShares.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <Download className="h-3 w-3 text-orange-500" />
                                  Salvamentos:
                                </span>
                                <span className="font-semibold">
                                  {contentStats.carousel.avgSaves > 0 ? contentStats.carousel.avgSaves.toLocaleString('pt-BR') : 'N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3 text-accent-gold" />
                                  Engajamento:
                                </span>
                                <span className="font-semibold">{contentStats.carousel.avgEngagement.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparativo de Indicadores por Tema */}
                  {themeStats && Object.keys(themeStats).length > 0 && (() => {
                    const sortedThemes = Object.entries(themeStats)
                      .sort(([, a], [, b]) => b.avgEngagement - a.avgEngagement)
                    
                    const bestTheme = sortedThemes[0]
                    const totalPosts = sortedThemes.reduce((sum, [, stats]) => sum + stats.posts, 0)
                    const avgEngagement = sortedThemes.reduce((sum, [, stats]) => sum + stats.avgEngagement, 0) / sortedThemes.length
                    const maxEngagement = bestTheme[1].avgEngagement
                    
                    return (
                      <div className="bg-surface rounded-2xl border border-card p-6 mt-6 space-y-6">
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-primary mb-2 flex items-center gap-2">
                            <BarChart4 className="w-5 h-5 text-accent-gold" />
                            Comparativo de Indicadores por Tema
                          </h2>
                          <p className="text-sm text-secondary">
                            Análise comparativa de desempenho entre temas de classificação
                          </p>
                        </div>

                        {/* KPIs Principais - Gestão à Vista */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-accent-gold/30 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-primary">🏆 Tema Mais Engajado</span>
                              <TrendingUp className="h-5 w-5 text-accent-gold" />
                            </div>
                            <p className="text-2xl font-bold text-accent-gold mb-1">{bestTheme[0]}</p>
                            <p className="text-xs text-secondary">
                              {bestTheme[1].avgEngagement.toLocaleString('pt-BR')} engajamento médio
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-2 border-green-500/30 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-primary">📊 Total Classificado</span>
                              <FileText className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-2xl font-bold text-green-500 mb-1">{totalPosts}</p>
                            <p className="text-xs text-secondary">
                              {sortedThemes.length} {sortedThemes.length === 1 ? 'tema' : 'temas'} diferentes
                            </p>
                          </div>

                          <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-2 border-blue-500/30 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-medium text-primary">📈 Engajamento Médio</span>
                              <BarChart4 className="h-5 w-5 text-blue-500" />
                            </div>
                            <p className="text-2xl font-bold text-blue-500 mb-1">{Math.round(avgEngagement).toLocaleString('pt-BR')}</p>
                            <p className="text-xs text-secondary">
                              Média geral de engajamento
                            </p>
                          </div>
                        </div>

                        {/* Gráfico de Barras: Engajamento por Tema */}
                        <div className="bg-surface rounded-xl border border-card p-6">
                          <h3 className="text-lg font-semibold text-primary mb-4">
                            Engajamento Médio por Tema
                          </h3>
              <div className="space-y-4">
                            {sortedThemes.map(([theme, stats], index) => {
                              const percentage = maxEngagement > 0 ? (stats.avgEngagement / maxEngagement) * 100 : 0
                              const isBest = index === 0
                              
                              return (
                                <div key={theme} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {isBest && <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />}
                                      <span className={`font-medium text-sm ${isBest ? 'text-green-600' : 'text-primary'} truncate`}>
                                        {theme}
                                      </span>
                                      <span className="text-xs text-secondary ml-2">
                                        ({stats.posts} {stats.posts === 1 ? 'post' : 'posts'})
                                      </span>
                                    </div>
                                    <span className={`text-lg font-bold ml-4 ${isBest ? 'text-green-600' : 'text-accent-gold'}`}>
                                      {stats.avgEngagement.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                  <div className="relative h-8 bg-surface-secondary rounded-lg overflow-hidden border border-card">
                                    <div
                                      className={`h-full rounded-lg transition-all duration-500 ${
                                        isBest 
                                          ? 'bg-gradient-to-r from-green-500 to-green-600' 
                                          : 'bg-gradient-to-r from-primary to-primary-dark'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="text-xs font-semibold text-primary">
                                        {percentage.toFixed(0)}% do melhor tema
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Tabela Comparativa Detalhada */}
                        <div className="bg-surface rounded-xl border border-card overflow-hidden">
                          <div className="p-4 border-b border-card bg-surface-secondary">
                            <h3 className="text-lg font-semibold text-primary">
                              Tabela Comparativa Detalhada
                            </h3>
                            <p className="text-sm text-secondary mt-1">
                              Métricas completas de cada tema classificado
                            </p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-card bg-surface-secondary">
                                  <th className="text-left p-4 font-semibold text-primary">Tema</th>
                                  <th className="text-right p-4 font-semibold text-primary">Postagens</th>
                                  <th className="text-right p-4 font-semibold text-primary">Curtidas (média)</th>
                                  <th className="text-right p-4 font-semibold text-primary">Comentários (média)</th>
                                  <th className="text-right p-4 font-semibold text-primary">Visualizações (média)</th>
                                  <th className="text-right p-4 font-semibold text-primary">Compartilhamentos (média)</th>
                                  <th className="text-right p-4 font-semibold text-primary">Salvamentos (média)</th>
                                  <th className="text-right p-4 font-semibold text-primary">Engajamento (média)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedThemes.map(([theme, stats], index) => {
                                  const isBest = index === 0
                                  return (
                                    <tr 
                                      key={theme} 
                                      className={`border-b border-card hover:bg-surface-secondary transition-colors ${
                                        isBest ? 'bg-green-500/5' : ''
                                      }`}
                                    >
                                      <td className="p-4 font-medium">
                                        <div className="flex items-center gap-2">
                                          {isBest && <TrendingUp className="h-4 w-4 text-green-500" />}
                                          <span className={isBest ? 'text-green-600 font-semibold' : 'text-primary'}>
                                            {theme}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="text-right p-4 text-primary">{stats.posts}</td>
                                      <td className="text-right p-4 text-primary">
                                        <div className="flex items-center justify-end gap-2">
                                          <Heart className="h-3 w-3 text-red-500" />
                                          {stats.avgLikes.toLocaleString('pt-BR')}
                                        </div>
                                      </td>
                                      <td className="text-right p-4 text-primary">
                                        <div className="flex items-center justify-end gap-2">
                                          <MessageCircle className="h-3 w-3 text-blue-500" />
                                          {stats.avgComments.toLocaleString('pt-BR')}
                                        </div>
                                      </td>
                                      <td className="text-right p-4 text-secondary">
                                        {stats.avgViews > 0 ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <Eye className="h-3 w-3 text-blue-500" />
                                            {stats.avgViews.toLocaleString('pt-BR')}
                                          </div>
                                        ) : 'N/A'}
                                      </td>
                                      <td className="text-right p-4 text-secondary">
                                        {stats.avgShares > 0 ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <Share2 className="h-3 w-3 text-green-500" />
                                            {stats.avgShares.toLocaleString('pt-BR')}
                                          </div>
                                        ) : 'N/A'}
                                      </td>
                                      <td className="text-right p-4 text-secondary">
                                        {stats.avgSaves > 0 ? (
                                          <div className="flex items-center justify-end gap-2">
                                            <Download className="h-3 w-3 text-orange-500" />
                                            {stats.avgSaves.toLocaleString('pt-BR')}
                                          </div>
                                        ) : 'N/A'}
                                      </td>
                                      <td className={`text-right p-4 font-bold ${isBest ? 'text-green-600' : 'text-accent-gold'}`}>
                                        {stats.avgEngagement.toLocaleString('pt-BR')}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Comparativo Visual: Curtidas vs Comentários */}
                        <div className="bg-surface rounded-xl border border-card p-6">
                          <h3 className="text-lg font-semibold text-primary mb-4">
                            Comparativo Visual: Curtidas vs Comentários
                          </h3>
                          <p className="text-sm text-secondary mb-6">
                            Análise comparativa entre interações por tema
                          </p>
                          <div className="space-y-6">
                            {sortedThemes.map(([theme, stats]) => {
                              const maxLikes = Math.max(...sortedThemes.map(([, s]) => s.avgLikes))
                              const maxComments = Math.max(...sortedThemes.map(([, s]) => s.avgComments))
                              const likesPercentage = maxLikes > 0 ? (stats.avgLikes / maxLikes) * 100 : 0
                              const commentsPercentage = maxComments > 0 ? (stats.avgComments / maxComments) * 100 : 0
                              
                              return (
                                <div key={theme} className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-primary">{theme}</span>
                                    <div className="flex items-center gap-4 text-xs text-secondary">
                                      <span className="flex items-center gap-1">
                                        <Heart className="h-3 w-3 text-red-500" />
                                        {stats.avgLikes.toLocaleString('pt-BR')}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <MessageCircle className="h-3 w-3 text-blue-500" />
                                        {stats.avgComments.toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                      <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-secondary flex items-center gap-1">
                                          <Heart className="h-3 w-3 text-red-500" />
                                          Curtidas
                                        </span>
                                        <span className="text-xs font-semibold text-primary">
                                          {stats.avgLikes.toLocaleString('pt-BR')}
                                        </span>
                        </div>
                                      <div className="h-4 bg-surface-secondary rounded-full overflow-hidden border border-card">
                                        <div
                                          className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500"
                                          style={{ width: `${likesPercentage}%` }}
                                        />
                      </div>
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-secondary flex items-center gap-1">
                                          <MessageCircle className="h-3 w-3 text-blue-500" />
                                          Comentários
                        </span>
                                        <span className="text-xs font-semibold text-primary">
                                          {stats.avgComments.toLocaleString('pt-BR')}
                                        </span>
                                      </div>
                                      <div className="h-4 bg-surface-secondary rounded-full overflow-hidden border border-card">
                                        <div
                                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                                          style={{ width: `${commentsPercentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-secondary mx-auto mb-4" />
                  <p className="text-secondary">
                    Nenhum dado disponível. Classifique algumas postagens para ver os comparativos.
                        </p>
                      </div>
                      )}
                    </div>
          )}

          {/* Conteúdo da sub-tab Audiência - Estrutura correta */}
          {activeSubTab === 'audience' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-accent-gold animate-spin mx-auto mb-4" />
                  <p className="text-secondary">Carregando dados do Instagram...</p>
                </div>
              ) : !isConfigured ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
                  <p className="text-secondary mb-4">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
                  >
                    Conectar Instagram
                  </button>
                      </div>
              ) : (
                <>
              {/* Card de Evolução de Seguidores e Métricas */}
              <div className="bg-surface rounded-2xl border border-card p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-accent-gold" />
                      Evolução de Seguidores & Métricas
                    </h3>
                    <p className="text-sm text-secondary">
                      Acompanhe o crescimento da sua audiência e visitas ao perfil ao longo do tempo
                    </p>
                  </div>
                  <button 
                    onClick={loadMetricsHistory}
                    disabled={loadingHistory}
                    className="px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors flex items-center gap-2"
                  >
                    {loadingHistory ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Atualizar
                  </button>
                </div>

                {/* Cards de Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* Seguidores Atuais */}
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-accent-gold/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-accent-gold" />
                      <span className="text-xs font-medium text-accent-gold uppercase tracking-wide">Seguidores</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {metrics?.followers?.total?.toLocaleString('pt-BR') || '0'}
                    </p>
                    {metricsHistory?.summary && metricsHistory.summary.growth !== 0 && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${metricsHistory.summary.growth > 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {metricsHistory.summary.growth > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {metricsHistory.summary.growth > 0 ? '+' : ''}{metricsHistory.summary.growth.toLocaleString('pt-BR')} ({metricsHistory.summary.growthPercentage}%)
                      </p>
                    )}
                  </div>

                  {/* Visitas ao Perfil */}
                  <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 rounded-xl border border-indigo-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Eye className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-medium text-indigo-500 uppercase tracking-wide">Visitas ao Perfil</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {(metrics?.insights?.profileViews || 0).toLocaleString('pt-BR')}
                    </p>
                    {metricsHistory?.summary && metricsHistory.summary.totalProfileViews > 0 && (
                      <p className="text-xs mt-1 text-secondary">
                        {metricsHistory.summary.totalProfileViews.toLocaleString('pt-BR')} no período
                      </p>
                    )}
                  </div>

                  {/* Alcance */}
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 rounded-xl border border-cyan-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-cyan-500" />
                      <span className="text-xs font-medium text-cyan-500 uppercase tracking-wide">Alcance</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {(metrics?.insights?.reach || 0).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs mt-1 text-secondary">Contas únicas alcançadas</p>
                  </div>

                  {/* Cliques no Site */}
                  <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-xl border border-amber-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ExternalLink className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-medium text-amber-500 uppercase tracking-wide">Cliques no Link</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">
                      {(metrics?.insights?.websiteClicks || 0).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs mt-1 text-secondary">Cliques no link da bio</p>
                  </div>
                </div>

                {/* Histórico de Evolução */}
                {metricsHistory?.history && metricsHistory.history.length > 0 && (
                  <div className="border-t border-card pt-6">
                    <h4 className="text-sm font-semibold text-primary mb-4">Histórico de Seguidores</h4>
                    <div className="overflow-x-auto">
                      <div className="flex gap-2 min-w-max pb-2">
                        {metricsHistory.history.slice(-14).map((snapshot, index, arr) => {
                          const prevSnapshot = index > 0 ? arr[index - 1] : null
                          const diff = prevSnapshot ? snapshot.followers_count - prevSnapshot.followers_count : 0
                          
                          return (
                            <div 
                              key={snapshot.id} 
                              className="flex flex-col items-center p-3 bg-background rounded-lg border border-card min-w-[80px]"
                            >
                              <span className="text-xs text-secondary mb-1">
                                {new Date(snapshot.snapshot_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </span>
                              <span className="text-sm font-semibold text-primary">
                                {snapshot.followers_count.toLocaleString('pt-BR')}
                              </span>
                              {diff !== 0 && (
                                <span className={`text-xs mt-0.5 ${diff > 0 ? 'text-status-success' : 'text-status-error'}`}>
                                  {diff > 0 ? '+' : ''}{diff}
                                </span>
                              )}
                              {snapshot.profile_views > 0 && (
                                <span className="text-xs text-indigo-500 mt-1 flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" /> {snapshot.profile_views}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {metricsHistory.history.length === 0 && (
                      <div className="text-center py-6 text-secondary">
                        <BarChart4 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Dados de histórico serão coletados automaticamente</p>
                        <p className="text-xs mt-1">Volte amanhã para ver a evolução</p>
                      </div>
                    )}
                  </div>
                )}

                {(!metricsHistory?.history || metricsHistory.history.length === 0) && !loadingHistory && (
                  <div className="border-t border-card pt-6 text-center py-6 text-secondary">
                    <BarChart4 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Dados de histórico serão coletados automaticamente</p>
                    <p className="text-xs mt-1">Volte amanhã para ver a evolução dos seguidores</p>
                  </div>
                )}

                {loadingHistory && (
                  <div className="border-t border-card pt-6 text-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-gold" />
                    <p className="text-sm text-secondary mt-2">Carregando histórico...</p>
                  </div>
                )}
              </div>

              {/* Card de Publicações por Tipo de Conteúdo */}
              <div className="bg-surface rounded-2xl border border-card p-6">
                <div className="flex items-start justify-between mb-4">
                      <div>
                    <h3 className="text-lg font-semibold text-primary mb-1">
                      Publicações por Tipo de Conteúdo
                    </h3>
                    <p className="text-sm text-secondary">
                      Visualize todas as postagens para identificar qual conteúdo tem melhor aceitação. Comparação com o post anterior.
                        </p>
                      </div>
                  <button className="px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors flex items-center gap-2">
                    <BarChart4 className="w-4 h-4" />
                    Ver Comparativo
                  </button>
                    </div>

                {/* Filtros */}
                <div className="mt-4 pt-4 border-t border-card">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Filter className="h-5 w-5 text-secondary" />
                      <span className="text-sm font-medium text-primary">Filtros:</span>
                  </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-secondary">Tema:</span>
                      <select
                        value={overviewThemeFilter}
                        onChange={(e) => setOverviewThemeFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      >
                        <option value="all">Todos os temas</option>
                        {availableThemes.map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                      </select>
              </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-secondary">Impulsionamento:</span>
                      <select
                        value={overviewBoostedFilter}
                        onChange={(e) => setOverviewBoostedFilter(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                      >
                        <option value="all">Todas</option>
                        <option value="boosted">Impulsionadas</option>
                        <option value="organic">Orgânicas</option>
                      </select>
                    </div>
                    {(overviewThemeFilter !== 'all' || overviewBoostedFilter !== 'all') && (
                      <>
                        <button
                          onClick={() => {
                            setOverviewThemeFilter('all')
                            setOverviewBoostedFilter('all')
                          }}
                          className="px-3 py-1.5 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors flex items-center gap-1"
                        >
                          <X className="h-4 w-4" />
                          Limpar filtros
                        </button>
                        <span className="text-sm text-secondary">
                          {filteredPosts.length} {filteredPosts.length === 1 ? 'postagem encontrada' : 'postagens encontradas'}
                        </span>
                      </>
                    )}
            </div>
          </div>

                {/* Lista de Posts */}
                <div className="mt-6 space-y-4">
                  {filteredPosts.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-secondary mx-auto mb-4" />
                      <p className="text-secondary">
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
                          className="border-2 border-card rounded-lg overflow-hidden"
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
                                      ? 'bg-blue-700'
                                      : 'bg-blue-500'
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

                            <div className="p-3 flex-1 h-48 flex flex-col overflow-hidden">
                              <div className="flex justify-between items-start mb-1.5 flex-shrink-0">
                                <div>
                                  <span className="text-xs text-secondary">
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
                                  className="text-accent-gold hover:underline text-xs flex items-center"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" /> Ver
                                </a>
                              </div>

                              <p className="text-xs line-clamp-2 mb-2 flex-shrink-0">
                                {post.caption || 'Sem legenda'}
                              </p>

                              {/* Campos de classificação */}
                              <div className="mb-2 flex gap-2 items-center flex-shrink-0">
                                <div className="flex-1 relative">
                                  <select
                                    value={classification?.theme || ''}
                                    onChange={(e) => {
                                      if (e.target.value === '__add_new__') {
                                        const postId = getPostIdentifier(post)
                                        setShowAddTheme(postId)
                                      } else {
                                        saveClassification(post, e.target.value, classification?.isBoosted ?? false)
                                      }
                                    }}
                                    className="h-7 text-xs w-full px-2 border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
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
                                        <label className="text-xs font-medium text-primary">
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
                                          className="text-xs px-2 py-1.5 border border-card rounded bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
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
                                            className="flex-1 px-2 py-1.5 text-xs bg-accent-gold text-white rounded hover:bg-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <select
                                  value={classification?.isBoosted ? 'sim' : 'nao'}
                                  onChange={(e) =>
                                    saveClassification(
                                      post,
                                      classification?.theme || '',
                                      e.target.value === 'sim'
                                    )
                                  }
                                  className="h-7 text-xs w-[90px] px-2 border border-card rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
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
                                    <span className="text-[10px] text-secondary">Curtidas</span>
                                    {previousPost && (
                                      <ComparisonBadge comparison={likesComparison} label="Curtidas" />
                                    )}
                  </div>
              </div>
                                <div>
                                  <div className="flex items-center justify-center">
                                    <MessageCircle className="h-3 w-3 text-blue-500 mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.comments.toLocaleString('pt-BR')}
                                    </span>
            </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px] text-secondary">Coment.</span>
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
                                    <Eye className="h-3 w-3 text-blue-500 mr-0.5" />
                                    <span className="text-xs font-medium">
                                      {post.metrics.views
                                        ? post.metrics.views.toLocaleString('pt-BR')
                                        : 'N/A'}
                                    </span>
      </div>
                                  <div className="flex items-center justify-center gap-0.5 mt-0.5">
                                    <span className="text-[10px] text-secondary">Visual.</span>
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
                                    <span className="text-[10px] text-secondary">Compart.</span>
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
                                    <span className="text-[10px] text-secondary">Salvam.</span>
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
              </div>
              </>
              )}
            </div>
          )}

          {/* Conteúdo da sub-tab Seguidores por Cidade */}
          {activeSubTab === 'locations' && (
            <div className="space-y-6">
              {loading && !metrics ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-accent-gold animate-spin mx-auto mb-4" />
                  <p className="text-secondary">Carregando dados do Instagram...</p>
                </div>
              ) : !isConfigured ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 text-secondary mx-auto mb-4" />
                  <p className="text-secondary mb-4">
                    Configure suas credenciais do Instagram para visualizar os dados
                  </p>
                  <button
                    onClick={() => setShowConfig(true)}
                    className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
                  >
                    Conectar Instagram
                  </button>
                </div>
              ) : (
                <>
                  {/* Card de Seguidores por Cidade */}
                  <div className="bg-surface rounded-2xl border border-card p-6">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-primary mb-1 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-accent-gold" />
                          Distribuição de Seguidores por Cidade
                        </h3>
                        <p className="text-sm text-secondary">
                          Visualize de quais cidades vêm seus seguidores do Instagram
                        </p>
                      </div>
                    </div>

                    {metrics?.demographics?.topLocations && Object.keys(metrics.demographics.topLocations).length > 0 ? (
                      <>
                        {/* Resumo */}
                        <div className="mb-6 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-accent-gold/20">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-sm text-secondary mb-1">Total de Cidades</p>
                              <p className="text-2xl font-bold text-primary">
                                {Object.keys(metrics.demographics.topLocations).length}
                              </p>
                            </div>
                            <div className="h-12 w-px bg-border" />
                            <div>
                              <p className="text-sm text-secondary mb-1">Total de Seguidores Mapeados</p>
                              <p className="text-2xl font-bold text-primary">
                                {Object.values(metrics.demographics.topLocations).reduce((sum, count) => sum + count, 0).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Lista de Cidades */}
                        <div className="space-y-2">
                          {Object.entries(metrics.demographics?.topLocations || {})
                            .sort(([, a], [, b]) => b - a)
                            .map(([city, count], index) => {
                              const totalFollowers = metrics?.followers?.total || 0
                              const percentage = totalFollowers > 0 ? ((count / totalFollowers) * 100).toFixed(1) : 0
                              const topLocations = metrics?.demographics?.topLocations || {}
                              const maxCount = Math.max(...Object.values(topLocations), 0)
                              const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0

                              return (
                                <div
                                  key={city}
                                  className="p-4 bg-background rounded-lg border border-card hover:border-accent-gold/30 transition-colors"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm ${
                                        index === 0 
                                          ? 'bg-accent-gold text-white' 
                                          : index === 1 
                                          ? 'bg-accent-gold/80 text-white'
                                          : index === 2
                                          ? 'bg-accent-gold/60 text-white'
                                          : 'bg-accent-gold-soft text-accent-gold'
                                      }`}>
                                        {index + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-primary truncate">{city}</p>
                                        <p className="text-xs text-secondary">
                                          {percentage}% do total de seguidores
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 ml-4">
                                      <div className="text-right">
                                        <p className="text-lg font-bold text-primary">
                                          {count.toLocaleString('pt-BR')}
                                        </p>
                                        <p className="text-xs text-secondary">seguidores</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-2">
                                    <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                                        style={{ width: `${barWidth}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-secondary mx-auto mb-4 opacity-50" />
                        <p className="text-secondary mb-2 font-semibold">
                          Dados de localização não disponíveis via API
                        </p>
                        <div className="space-y-3 text-sm text-secondary max-w-lg mx-auto">
                          <p className="text-status-warning">
                            ⚠️ A métrica <code className="px-2 py-1 bg-background rounded text-xs">audience_city</code> foi <strong>depreciada pelo Instagram</strong> no Graph API v18 (janeiro de 2024) e não está mais disponível.
                          </p>
                          <div className="p-4 bg-background rounded-lg border border-card text-left space-y-2">
                            <p className="font-semibold text-primary">Informação:</p>
                            <p>
                              O Instagram removeu o acesso programático a dados demográficos detalhados (incluindo localização por cidade) para proteger a privacidade dos usuários.
                            </p>
                            <p className="pt-2 border-t border-card">
                              <strong>Alternativas disponíveis:</strong>
                            </p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                              <li>Acessar os insights nativos do Instagram no app (menu Insights)</li>
                              <li>Utilizar ferramentas de analytics de terceiros que agregam dados públicos</li>
                            </ul>
                          </div>
                          <p className="text-xs text-secondary italic">
                            Esta limitação é uma política do Instagram/Meta e não pode ser contornada via API.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configuração do Instagram */}
      {showConfig && (
        <InstagramConfigModal
          onClose={() => {
            setShowConfig(false)
            // Não limpar credenciais ao fechar - manter as que estão salvas
            // Se não houver config salva, tentar carregar novamente
            if (!config) {
              const savedConfig = loadInstagramConfig()
              if (savedConfig) {
                setConfig(savedConfig)
                setIsConfigured(true)
              }
            }
          }}
          onSave={handleSaveConfig}
          currentConfig={config || undefined}
        />
      )}
    </div>
  )
}
