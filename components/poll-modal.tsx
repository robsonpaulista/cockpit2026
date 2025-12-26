'use client'

import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
}

interface Poll {
  id?: string
  data: string
  instituto: string
  candidato_nome: string
  tipo: 'estimulada' | 'espontanea'
  cargo: 'dep_estadual' | 'dep_federal' | 'governador' | 'senador' | 'presidente'
  cidade_id?: string | null
  intencao: number
  rejeicao: number
}

interface PollModalProps {
  poll: Poll | null
  onClose: () => void
  onUpdate: () => void
}

const cargoOptions = [
  { value: 'dep_estadual', label: 'Dep. Estadual' },
  { value: 'dep_federal', label: 'Dep. Federal' },
  { value: 'governador', label: 'Governador' },
  { value: 'senador', label: 'Senador' },
  { value: 'presidente', label: 'Presidente' },
]

const tipoOptions = [
  { value: 'estimulada', label: 'Estimulada' },
  { value: 'espontanea', label: 'Espontânea' },
]

export function PollModal({ poll, onClose, onUpdate }: PollModalProps) {
  const [formData, setFormData] = useState<Poll>({
    data: '',
    instituto: '',
    candidato_nome: '',
    tipo: 'estimulada',
    cargo: 'dep_estadual',
    cidade_id: null,
    intencao: 0,
    rejeicao: 0,
  })
  const [cities, setCities] = useState<City[]>([])
  const [filteredCities, setFilteredCities] = useState<City[]>([])
  const [loadingCities, setLoadingCities] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [candidatosExistentes, setCandidatosExistentes] = useState<string[]>([])

  useEffect(() => {
    fetchCities()
    fetchCandidatosExistentes()
  }, [])

  useEffect(() => {
    if (poll) {
      // Garantir que a data está no formato correto (YYYY-MM-DD)
      let dataFormatada = poll.data
      if (dataFormatada && dataFormatada.includes('T')) {
        // Se tem timestamp, extrair apenas a data
        dataFormatada = dataFormatada.split('T')[0]
      }
      setFormData({
        ...poll,
        data: dataFormatada,
      })
    } else {
      // Resetar para valores padrão
      const today = new Date().toISOString().split('T')[0]
      setFormData({
        data: today,
        instituto: '',
        candidato_nome: '',
        tipo: 'estimulada',
        cargo: 'dep_estadual',
        cidade_id: null,
        intencao: 0,
        rejeicao: 0,
      })
    }
  }, [poll])

  const fetchCities = async () => {
    try {
      setLoadingCities(true)
      const response = await fetch('/api/campo/cities')
      if (response.ok) {
        const data = await response.json()
        
        // Se não houver cidades, sincronizar do IBGE
        if (!data || data.length === 0) {
          console.log('Nenhuma cidade encontrada, sincronizando do IBGE...')
          const syncResponse = await fetch('/api/campo/cities/sync', { method: 'POST' })
          if (syncResponse.ok) {
            const syncData = await syncResponse.json()
            const citiesData = syncData.data || []
            const sorted = citiesData.sort((a: City, b: City) => a.name.localeCompare(b.name))
            setCities(sorted)
            setFilteredCities(sorted)
            return
          }
        }
        
        // Ordenar por nome
        const sorted = data.sort((a: City, b: City) => a.name.localeCompare(b.name))
        setCities(sorted)
        setFilteredCities(sorted)
      } else {
        // Se houver erro, tentar sincronizar do IBGE
        console.log('Tentando sincronizar municípios do IBGE...')
        const syncResponse = await fetch('/api/campo/cities/sync', { method: 'POST' })
        if (syncResponse.ok) {
          const syncData = await syncResponse.json()
          const citiesData = syncData.data || []
          const sorted = citiesData.sort((a: City, b: City) => a.name.localeCompare(b.name))
          setCities(sorted)
          setFilteredCities(sorted)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar cidades:', error)
    } finally {
      setLoadingCities(false)
    }
  }

  const fetchCandidatosExistentes = async () => {
    try {
      const response = await fetch('/api/pesquisa')
      if (response.ok) {
        const data = await response.json()
        // Extrair nomes únicos de candidatos, ordenados alfabeticamente
        const candidatos = Array.from(
          new Set(
            data
              .map((p: Poll) => p.candidato_nome)
              .filter((nome: string) => nome && nome.trim() !== '')
          )
        ).sort((a: string, b: string) => a.localeCompare(b)) as string[]
        setCandidatosExistentes(candidatos)
      }
    } catch (error) {
      console.error('Erro ao buscar candidatos existentes:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = poll?.id ? `/api/pesquisa/${poll.id}` : '/api/pesquisa'
      const method = poll?.id ? 'PUT' : 'POST'

      // Preparar dados para envio
      const dataToSend = {
        ...formData,
        cidade_id: formData.cidade_id && formData.cidade_id.trim() !== '' 
          ? formData.cidade_id 
          : null,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        onUpdate()
        
        // Atualizar lista de candidatos existentes após salvar
        await fetchCandidatosExistentes()
        
        // Se for edição, fechar o modal
        if (poll?.id) {
          onClose()
        } else {
          // Se for nova pesquisa, manter os dados e limpar apenas candidato e valores
          setFormData({
            ...formData,
            candidato_nome: '',
            intencao: 0,
            rejeicao: 0,
          })
          // Não fechar o modal, permitir cadastrar outro candidato
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao salvar pesquisa')
      }
    } catch (error) {
      alert('Erro ao salvar pesquisa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-strong">
            {poll?.id ? 'Editar Pesquisa' : 'Nova Pesquisa'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Data *
            </label>
            <input
              type="date"
              value={formData.data}
              onChange={(e) => setFormData({ ...formData, data: e.target.value })}
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
            />
          </div>

          {/* Instituto */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Instituto *
            </label>
            <input
              type="text"
              value={formData.instituto}
              onChange={(e) => setFormData({ ...formData, instituto: e.target.value })}
              placeholder="Nome do instituto"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
            />
          </div>

          {/* Nome do Candidato */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Nome do Candidato *
            </label>
            <input
              type="text"
              list="candidatos-list"
              value={formData.candidato_nome}
              onChange={(e) => setFormData({ ...formData, candidato_nome: e.target.value })}
              placeholder="Digite ou selecione um candidato existente"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
            />
            <datalist id="candidatos-list">
              {candidatosExistentes.map((candidato) => (
                <option key={candidato} value={candidato} />
              ))}
            </datalist>
            {candidatosExistentes.length > 0 && (
              <p className="text-xs text-text-muted mt-1">
                {candidatosExistentes.length} candidato{candidatosExistentes.length !== 1 ? 's' : ''} cadastrado{candidatosExistentes.length !== 1 ? 's' : ''} anteriormente. Você pode selecionar ou digitar um novo nome.
              </p>
            )}
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Município (Piauí)
            </label>
            {loadingCities ? (
              <div className="w-full px-4 py-2 border border-border rounded-lg bg-background animate-pulse">
                <span className="text-sm text-text-muted">Carregando municípios...</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Digite para buscar município (ex: Teresina, Parnaíba...)"
                  onChange={(e) => {
                    const searchTerm = e.target.value.toLowerCase()
                    if (searchTerm === '') {
                      setFilteredCities(cities)
                    } else {
                      const filtered = cities.filter(city => 
                        city.name.toLowerCase().includes(searchTerm)
                      )
                      setFilteredCities(filtered)
                    }
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft mb-2 bg-surface"
                />
                <select
                  value={formData.cidade_id || ''}
                  onChange={(e) => setFormData({ ...formData, cidade_id: e.target.value || null })}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  <option value="">Selecione um município (opcional)</option>
                  {(filteredCities.length > 0 ? filteredCities : cities).map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {cities.length > 0 && (
                  <p className="text-xs text-text-muted mt-1">
                    {filteredCities.length === cities.length 
                      ? `${cities.length} municípios do Piauí disponíveis`
                      : `${filteredCities.length} de ${cities.length} municípios encontrados`
                    }
                  </p>
                )}
              </>
            )}
          </div>

          {/* Tipo e Cargo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as Poll['tipo'] })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
              >
                {tipoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Cargo *
              </label>
              <select
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value as Poll['cargo'] })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
              >
                {cargoOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Intenção e Rejeição */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Intenção (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.intencao}
                onChange={(e) => setFormData({ ...formData, intencao: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-strong mb-2">
                Rejeição (%) *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.rejeicao}
                onChange={(e) => setFormData({ ...formData, rejeicao: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Salvando...' : poll?.id ? 'Salvar Alterações' : 'Salvar e Adicionar Outro'}
            </button>
            {!poll?.id && (
              <button
                type="button"
                onClick={() => {
                  onUpdate()
                  onClose()
                }}
                className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
              >
                Salvar e Fechar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
            >
              {poll?.id ? 'Cancelar' : 'Fechar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

