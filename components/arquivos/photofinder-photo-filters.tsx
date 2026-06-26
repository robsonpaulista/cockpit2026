'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderPhotoFilters } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface PhotoFiltersProps {
  filters: PhotofinderPhotoFilters
  onFilterChange: (filters: Partial<PhotofinderPhotoFilters>) => void
}

export function PhotofinderPhotoFilters({ filters, onFilterChange }: PhotoFiltersProps) {
  const [search, setSearch] = useState(filters.search ?? '')
  const [person, setPerson] = useState(filters.person ?? '')
  const [city, setCity] = useState(filters.city ?? '')
  const [cities, setCities] = useState<string[]>([])

  useEffect(() => {
    void photofinderApi
      .getCities()
      .then(setCities)
      .catch(() => undefined)
  }, [])

  const apply = () => {
    onFilterChange({
      search: search || undefined,
      person: person || undefined,
      city: city || undefined,
    })
  }

  const clear = () => {
    setSearch('')
    setPerson('')
    setCity('')
    onFilterChange({})
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-[#C8900A]" />
        <h2 className="text-sm font-semibold text-text-primary">Filtros</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome do arquivo"
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] bg-bg-surface px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder="Pessoa"
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] bg-bg-surface px-3 py-2 text-sm"
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] bg-bg-surface px-3 py-2 text-sm"
        >
          <option value="">Todas as cidades</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={apply} className={cn(sidebarPrimaryCTAButtonClass, 'px-4 py-2 text-sm')}>
          Aplicar
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2 text-sm text-text-muted hover:bg-bg-muted"
        >
          Limpar
        </button>
      </div>
    </div>
  )
}
