'use client'

import { Calendar, MapPin, FolderOpen } from 'lucide-react'
import { useState } from 'react'

interface FilterOption {
  value: string
  label: string
}

const periodOptions: FilterOption[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'personalizado', label: 'Personalizado' },
]

const regionOptions: FilterOption[] = [
  { value: 'estado', label: 'Estado' },
  { value: 'macro', label: 'Macro' },
  { value: 'municipio', label: 'Município' },
]

const themeOptions: FilterOption[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'saude', label: 'Saúde' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'educacao', label: 'Educação' },
  { value: 'economia', label: 'Economia' },
]

const phaseOptions: FilterOption[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pre', label: 'Pré-campanha' },
  { value: 'convencao', label: 'Convenção' },
  { value: 'oficial', label: 'Campanha Oficial' },
  { value: 'reta-final', label: 'Reta Final' },
]

interface HeaderProps {
  title: string
  subtitle?: string
  showFilters?: boolean
}

export function Header({ title, subtitle, showFilters = true }: HeaderProps) {
  const [period, setPeriod] = useState('30d')
  const [region, setRegion] = useState('estado')
  const [theme, setTheme] = useState('todos')
  const [phase, setPhase] = useState('todas')

  return (
    <header className="sticky top-0 z-20 bg-surface border-b border-border">
      <div className="px-4 py-4 lg:px-6">
        {/* Title Section */}
        <div className="mb-4">
          <h1 className="text-2xl lg:text-3xl font-semibold text-text-strong">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-base lg:text-lg text-text-muted font-medium">{subtitle}</p>
          )}
        </div>

        {/* Filters */}
        {showFilters && (
        <div className="flex flex-wrap gap-3">
          {/* Período */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-text-muted" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface hover:border-primary transition-premium focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Região */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-text-muted" />
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface hover:border-primary transition-premium focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              {regionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tema */}
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-text-muted" />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface hover:border-primary transition-premium focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              {themeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Fase */}
          <div className="flex items-center gap-2">
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface hover:border-primary transition-premium focus:outline-none focus:ring-2 focus:ring-primary-soft"
            >
              {phaseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(period !== '30d' || region !== 'estado' || theme !== 'todos' || phase !== 'todas') && (
            <button
              onClick={() => {
                setPeriod('30d')
                setRegion('estado')
                setTheme('todos')
                setPhase('todas')
              }}
              className="ml-auto px-3 py-1.5 text-sm text-text-muted hover:text-primary transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>
        )}
      </div>
    </header>
  )
}




