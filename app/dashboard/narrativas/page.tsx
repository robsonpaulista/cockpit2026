'use client'

import { useEffect, useState } from 'react'
import { FileText, TrendingUp, MessageSquare, Search, Edit, Trash2, Plus } from 'lucide-react'
import { NarrativeModal } from '@/components/narrative-modal'

interface Narrative {
  id: string
  theme: string
  target_audience: string
  key_message: string
  arguments: string[]
  proofs: any[]
  tested_phrases: string[]
  usage_count: number
  performance_score: number
  status: 'ativa' | 'rascunho' | 'arquivada'
  created_at?: string
  updated_at?: string
  // Estatísticas detalhadas
  instagram_count?: number
  news_count?: number
  boosted_count?: number
}

export default function NarrativasPage() {
  const [narrativas, setNarrativas] = useState<Narrative[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTheme, setFilterTheme] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

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

      const response = await fetch(`/api/narrativas?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        
        // Buscar estatísticas para cada narrativa
        const narrativasComStats = await Promise.all(
          data.map(async (narrativa: Narrative) => {
            try {
              const statsResponse = await fetch(`/api/narrativas/stats?theme=${encodeURIComponent(narrativa.theme)}`)
              if (statsResponse.ok) {
                const stats = await statsResponse.json()
                return {
                  ...narrativa,
                  usage_count: stats.usage_count,
                  performance_score: stats.performance_score,
                  instagram_count: stats.instagram_count || 0,
                  news_count: stats.news_count || 0,
                  boosted_count: stats.boosted_count || 0,
                }
              }
            } catch (error) {
              console.error(`Erro ao buscar stats para ${narrativa.theme}:`, error)
            }
            return {
              ...narrativa,
              instagram_count: 0,
              news_count: 0,
              boosted_count: 0,
            }
          })
        )
        
        setNarrativas(narrativasComStats)
      } else {
        console.error('Erro ao buscar narrativas')
      }
    } catch (error) {
      console.error('Erro ao buscar narrativas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta narrativa?')) {
      return
    }

    try {
      const response = await fetch(`/api/narrativas/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchNarrativas()
      } else {
        alert('Erro ao excluir narrativa')
      }
    } catch (error) {
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

  const uniqueThemes = Array.from(new Set(narrativas.map(n => n.theme))).sort()

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        {/* Barra de ações e filtros */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <button
              onClick={handleNew}
              className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Narrativa
            </button>

            {/* Filtros */}
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
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
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

        {/* Lista de narrativas */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-surface rounded-2xl border border-card p-6 animate-pulse"
              >
                <div className="h-6 bg-background rounded mb-4" />
                <div className="h-4 bg-background rounded mb-2" />
                <div className="h-4 bg-background rounded w-3/4" />
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
            {narrativas.map((narrativa) => (
              <div
                key={narrativa.id}
                className="bg-surface rounded-2xl border border-card p-6 hover:shadow-card-hover transition-all duration-200 ease-out relative group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{narrativa.theme}</h3>
                    <p className="text-sm text-secondary mt-1">Público: {narrativa.target_audience}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-lg ${
                      narrativa.status === 'ativa'
                        ? 'bg-green-100 text-green-700'
                        : narrativa.status === 'rascunho'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {narrativa.status}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => handleEdit(narrativa)}
                        className="p-1.5 text-accent-gold hover:bg-accent-gold-soft rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(narrativa.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-primary mb-2">Mensagem-chave</p>
                  <p className="text-sm text-secondary">{narrativa.key_message}</p>
                </div>

                {narrativa.arguments && narrativa.arguments.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-primary mb-2">Argumentos</p>
                    <ul className="space-y-1">
                      {narrativa.arguments.map((arg, idx) => (
                        <li key={idx} className="text-sm text-secondary flex items-start gap-2">
                          <span className="text-accent-gold mt-1">•</span>
                          <span>{arg}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {narrativa.tested_phrases && narrativa.tested_phrases.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-primary mb-2">Frases testadas</p>
                    <ul className="space-y-1">
                      {narrativa.tested_phrases.slice(0, 2).map((phrase, idx) => (
                        <li key={idx} className="text-sm text-secondary italic">
                          "{phrase}"
                        </li>
                      ))}
                      {narrativa.tested_phrases.length > 2 && (
                        <li className="text-xs text-secondary">
                          +{narrativa.tested_phrases.length - 2} mais
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="pt-4 border-t border-card space-y-3">
                  {/* Resumo de usos */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium text-primary">{narrativa.usage_count || 0} usos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-secondary" />
                      <span className="text-sm font-medium text-primary">{narrativa.performance_score || 0}% performance</span>
                    </div>
                  </div>
                  
                  {/* Detalhamento dos usos */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between px-2 py-1.5 bg-blue-50 rounded-lg">
                      <span className="text-secondary">Instagram:</span>
                      <span className="font-medium text-blue-700">{narrativa.instagram_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 bg-green-50 rounded-lg">
                      <span className="text-secondary">Notícias:</span>
                      <span className="font-medium text-green-700">{narrativa.news_count || 0}</span>
                    </div>
                    {(narrativa.boosted_count || 0) > 0 && (
                      <div className="col-span-2 flex items-center justify-between px-2 py-1.5 bg-purple-50 rounded-lg">
                        <span className="text-secondary">Posts Impulsionados:</span>
                        <span className="font-medium text-purple-700">{narrativa.boosted_count || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

