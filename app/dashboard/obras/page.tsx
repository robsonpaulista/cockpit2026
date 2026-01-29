'use client'

import { useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/header'
import { Building2, MapPin, Calendar, DollarSign, User, Filter, Search, Plus, Edit, Trash2, Loader2, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ObrasImportModal } from '@/components/obras-import-modal'

interface Obra {
  id: string
  municipio?: string
  obra: string
  orgao?: string
  sei?: string
  sei_medicao?: string
  status?: string
  publicacao_os?: string
  solicitacao_medicao?: string
  data_medicao?: string
  status_medicao?: string
  valor_total?: number
  created_at?: string
  updated_at?: string
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMunicipio, setFilterMunicipio] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStatusMedicao, setFilterStatusMedicao] = useState('')
  const [filterOrgao, setFilterOrgao] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)

  useEffect(() => {
    fetchObras()
  }, [filterMunicipio, filterStatus, filterStatusMedicao, filterOrgao])

  const fetchObras = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterMunicipio) params.append('municipio', filterMunicipio)
      if (filterStatus) params.append('status', filterStatus)
      if (filterStatusMedicao) params.append('status_medicao', filterStatusMedicao)
      if (filterOrgao) params.append('orgao', filterOrgao)

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
        obra.obra?.toLowerCase().includes(term) ||
        obra.municipio?.toLowerCase().includes(term) ||
        obra.orgao?.toLowerCase().includes(term) ||
        obra.sei?.toLowerCase().includes(term) ||
        obra.sei_medicao?.toLowerCase().includes(term)
      )
    })
  }, [obras, searchTerm])

  // Obter valores únicos para filtros
  const municipios = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.municipio).filter(Boolean))).sort()
  }, [obras])

  const statusList = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.status).filter(Boolean))).sort()
  }, [obras])

  const statusMedicaoList = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.status_medicao).filter(Boolean))).sort()
  }, [obras])

  const orgaos = useMemo(() => {
    return Array.from(new Set(obras.map((o) => o.orgao).filter(Boolean))).sort()
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

            {/* Filtro Município */}
            <div>
              <select
                value={filterMunicipio}
                onChange={(e) => setFilterMunicipio(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os municípios</option>
                {municipios.map((municipio) => (
                  <option key={municipio} value={municipio}>
                    {municipio}
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

            {/* Filtro Status Medição */}
            <div>
              <select
                value={filterStatusMedicao}
                onChange={(e) => setFilterStatusMedicao(e.target.value)}
                className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos os status de medição</option>
                {statusMedicaoList.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Filtro Órgão */}
          <div className="mt-4">
            <select
              value={filterOrgao}
              onChange={(e) => setFilterOrgao(e.target.value)}
              className="w-full px-4 py-2 border border-card rounded-lg bg-background text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">Todos os órgãos</option>
              {orgaos.map((orgao) => (
                <option key={orgao} value={orgao}>
                  {orgao}
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
              {formatCurrency(obras.reduce((sum, o) => sum + (o.valor_total || 0), 0))}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-secondary">Com Medição</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {obras.filter((o) => o.data_medicao).length}
            </p>
          </div>
          <div className="bg-surface rounded-xl border border-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-secondary">Órgãos Diferentes</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {orgaos.length}
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
                {searchTerm || filterMunicipio || filterStatus || filterStatusMedicao || filterOrgao
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
                      Município
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Obra
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Órgão
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      SEI
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Pub. OS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Data Medição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Status Medição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                      Valor Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card">
                  {filteredObras.map((obra) => (
                    <tr key={obra.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">{obra.municipio || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-primary">{obra.obra}</div>
                        {obra.sei_medicao && (
                          <div className="text-xs text-secondary mt-1">
                            SEI Medição: {obra.sei_medicao}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-secondary">{obra.orgao || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-secondary font-mono">{obra.sei || '-'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            obra.status?.toLowerCase().includes('concluída') || obra.status?.toLowerCase().includes('concluida')
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
                        <div className="text-sm text-secondary">
                          {obra.publicacao_os ? formatDateFull(obra.publicacao_os) : '-'}
                        </div>
                        {obra.solicitacao_medicao && (
                          <div className="text-xs text-secondary mt-1">
                            Solicitada: {formatDateFull(obra.solicitacao_medicao)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-secondary">
                          {obra.data_medicao ? formatDateFull(obra.data_medicao) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            obra.status_medicao?.toLowerCase().includes('concluída') || obra.status_medicao?.toLowerCase().includes('concluida')
                              ? 'bg-green-100 text-green-800'
                              : obra.status_medicao?.toLowerCase().includes('pendente')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {obra.status_medicao || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-primary">
                          {formatCurrency(obra.valor_total)}
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
