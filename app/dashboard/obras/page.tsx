'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { Building2, MapPin, Calendar, DollarSign, User, Filter, Search, Plus, Edit, Trash2, Loader2, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ObrasImportModal } from '@/components/obras-import-modal'

interface Obra {
  id: string
  nome_obra: string
  localizacao?: string
  cidade?: string
  estado?: string
  tipo_obra?: string
  status?: string
  data_inicio?: string
  data_prevista_conclusao?: string
  data_conclusao?: string
  valor_orcado?: number
  valor_executado?: number
  percentual_execucao?: number
  responsavel?: string
  observacoes?: string
  created_at?: string
  updated_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCidade, setFilterCidade] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    fetchObras()
  }, [filterCidade, filterEstado, filterStatus, filterTipo])

  const fetchObras = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCidade) params.append('cidade', filterCidade)
      if (filterEstado) params.append('estado', filterEstado)
      if (filterStatus) params.append('status', filterStatus)
      if (filterTipo) params.append('tipo', filterTipo)

      const response = await fetch(`/api/obras?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setObras(data.obras || [])
      }
    } catch (error) {
      console.error('Erro ao buscar obras:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar obras por termo de busca
  const filteredObras = useMemo(() => {
    if (!searchTerm) return obras

    const term = searchTerm.toLowerCase()
    return obras.filter((obra) => {
      return (
        obra.nome_obra?.toLowerCase().includes(term) ||
        obra.localizacao?.toLowerCase().includes(term) ||
        obra.cidade?.toLowerCase().includes(term) ||
        obra.responsavel?.toLowerCase().includes(term) ||
        obra.tipo_obra?.toLowerCase().includes(term)
      )
    })
  }, [obras, searchTerm])

  // Obter valores únicos para filtros
  const cidades = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.cidade).filter(Boolean))).sort()
  }, [obras])

  const estados = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.estado).filter(Boolean))).sort()
  }, [obras])

  const statusList = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.status).filter(Boolean))).sort()
  }, [obras])

  const tipos = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.tipo_obra).filter(Boolean))).sort()
  }, [obras])

  const formatCurrency = (value?: number) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatPercent = (value?: number) => {
    if (!value) return '-'
    return `${value.toFixed(1)}%`
  }

  const formatDateFull = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Obras" subtitle="Gestão de obras e projetos" showFilters={false} />

      <div className="px-4 py-6 lg:px-6">
        {/* Filtros e Busca */}
        <div className="mb-6 bg-surface rounded-xl border border-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar por nome, localização, cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
            </div>

            {/* Filtro Cidade */}
            <div>
              <select
                value={filterCidade}
                onChange={(e) => setFilterCidade(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todas as cidades</option>
                {cidades.map((cidade) => (
                  <option key={cidade} value={cidade}>
                    {cidade}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Estado */}
            <div>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os estados</option>
                {estados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Status */}
            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os status</option>
                {statusList.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtro Tipo */}
          <div className="mt-4">
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">Todos os tipos</option>
              {tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-accent-gold" />
              <span className="text-sm font-medium text-secondary">Total de Obras</span>
            </div>
            <p className="text-2xl font-bold text-primary">{obras.length}</p>
          </div>
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-secondary">Valor Total Orçado</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(obras.reduce((sum, o) => sum + (o.valor_orcado || 0), 0))}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-secondary">Valor Total Executado</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(obras.reduce((sum, o) => sum + (o.valor_executado || 0), 0))}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-secondary">Em Andamento</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {obras.filter((o) => o.status?.toLowerCase().includes('andamento')).length}
            </p>
          </div>
        </div>

        {/* Tabela de Obras */}
        <div className="bg-surface rounded-2xl border border-card overflow-hidden">
          <div className="p-6 border-b border-card flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-gold" />
              Lista de Obras ({filteredObras.length})
            </h3>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Importar do Excel
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-secondary">Carregando obras...</span>
            </div>
          ) : filteredObras.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-sm text-secondary">
                {searchTerm || filterCidade || filterEstado || filterStatus || filterTipo
                  ? 'Nenhuma obra encontrada com os filtros aplicados'
                  : 'Nenhuma obra cadastrada ainda'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-card">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Obra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Localização
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Execução
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Valor Orçado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Responsável
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card">
                  {filteredObras.map((obra) => (
                    <tr key={obra.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">{obra.nome_obra}</div>
                        {obra.data_inicio && (
                          <div className="text-xs text-secondary mt-1">
                            Início: {formatDateFull(obra.data_inicio)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-secondary">
                          <MapPin className="w-4 h-4" />
                          <div>
                            {obra.cidade && obra.estado ? (
                              <>
                                <div>{obra.cidade}</div>
                                <div className="text-xs">{obra.estado}</div>
                              </>
                            ) : (
                              <div>{obra.localizacao || '-'}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-secondary">{obra.tipo_obra || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            obra.status?.toLowerCase().includes('concluída')
                              ? 'bg-green-100 text-green-800'
                              : obra.status?.toLowerCase().includes('andamento')
                              ? 'bg-blue-100 text-blue-800'
                              : obra.status?.toLowerCase().includes('paralisada')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {obra.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          {formatPercent(obra.percentual_execucao)}
                        </div>
                        {obra.percentual_execucao !== undefined && (
                          <div className="w-24 h-2 bg-background rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full bg-accent-gold transition-all"
                              style={{ width: `${Math.min(obra.percentual_execucao, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          {formatCurrency(obra.valor_orcado)}
                        </div>
                        {obra.valor_executado && (
                          <div className="text-xs text-secondary">
                            Executado: {formatCurrency(obra.valor_executado)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-secondary">
                          <User className="w-4 h-4" />
                          <span>{obra.responsavel || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Importação */}
      {showImportModal && (
        <ObrasImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            fetchObras()
            setShowImportModal(false)
          }}
        />
      )}
    </div>
  )
}
