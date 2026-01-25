'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface City {
  id: string
  name: string
  state: string
}

interface Agenda {
  id?: string
  date: string
  city_id?: string
  type: string
  status?: string
  description?: string
}

interface AgendaModalProps {
  agenda: Agenda | null
  onClose: () => void
  onSuccess: () => void
}

export function AgendaModal({ agenda, onClose, onSuccess }: AgendaModalProps) {
  const [formData, setFormData] = useState({
    date: agenda?.date || '',
    city_id: agenda?.city_id || '',
    type: agenda?.type || 'visita',
    description: agenda?.description || '',
  })
  const [cities, setCities] = useState<City[]>([])
  const [filteredCities, setFilteredCities] = useState<City[]>([])
  const [loadingCities, setLoadingCities] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCities()
  }, [])

  const fetchCities = async () => {
    try {
      setLoadingCities(true)
      const response = await fetch('/api/campo/cities')
      if (response.ok) {
        const data = await response.json()
        // Ordenar por nome
        const sorted = data.sort((a: City, b: City) => a.name.localeCompare(b.name))
        setCities(sorted)
        setFilteredCities(sorted)
      } else {
        // Se houver erro, tentar sincronizar do IBGE
        console.log('Tentando sincronizar municípios do IBGE...')
        const syncResponse = await fetch('/api/campo/cities/sync', { method: 'POST' })
        if (syncResponse.ok) {
          const data = await syncResponse.json()
          const sorted = data.data?.sort((a: City, b: City) => a.name.localeCompare(b.name)) || []
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = agenda?.id ? `/api/campo/agendas/${agenda.id}` : '/api/campo/agendas'
      const method = agenda?.id ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          city_id: formData.city_id || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao salvar agenda')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar agenda')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-primary">
            {agenda?.id ? 'Editar Agenda' : 'Nova Agenda'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Data *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Município (Piauí) *
            </label>
            {loadingCities ? (
              <div className="w-full px-4 py-2 border border-card rounded-lg bg-background animate-pulse">
                <span className="text-sm text-secondary">Carregando municípios...</span>
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
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft mb-2"
                />
                <select
                  value={formData.city_id}
                  onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                  style={{ maxHeight: '200px', overflowY: 'auto' }}
                >
                  <option value="">Selecione um município</option>
                  {(filteredCities.length > 0 ? filteredCities : cities).map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {cities.length > 0 && (
                  <p className="text-xs text-secondary mt-1">
                    {filteredCities.length === cities.length 
                      ? `${cities.length} municípios do Piauí disponíveis`
                      : `${filteredCities.length} de ${cities.length} municípios encontrados`
                    }
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Tipo *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              required
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="visita">Visita</option>
              <option value="evento">Evento</option>
              <option value="reuniao">Reunião</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Descrição
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              placeholder="Detalhes da agenda..."
            />
          </div>

          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : agenda?.id ? 'Atualizar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

