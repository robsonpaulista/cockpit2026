'use client'

import {
  IconChevronDown,
  IconNews,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import type { FiltroDestaque } from '@/lib/noticias-page-utils'
import {
  ghostButtonClass,
  pillFilterActiveClass,
  pillFilterIdleClass,
  pillInputClass,
} from '@/lib/premium-ui-classes'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { cn } from '@/lib/utils'

interface NoticiasPageHeaderProps {
  lastUpdatedLabel: string
  refreshing: boolean
  onRefresh: () => void
  onNewAlert: () => void
}

export function NoticiasPageHeader({
  lastUpdatedLabel,
  refreshing,
  onRefresh,
  onNewAlert,
}: NoticiasPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <IconNews className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[rgb(var(--color-primary))]" stroke={1.5} aria-hidden />
        <div>
          <h1 className="text-sm font-medium text-text-primary">Inbox de notícias</h1>
          <p className="text-[11.5px] text-text-muted">Monitoramento via RSS · {lastUpdatedLabel}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className={cn(ghostButtonClass, 'disabled:opacity-50')}
        >
          <IconRefresh className={cn('h-[14px] w-[14px] opacity-70', refreshing && 'animate-spin')} stroke={1.5} aria-hidden />
          Atualizar
        </button>
        <button type="button" onClick={onNewAlert} className={sidebarPrimaryCTAButtonClass(false)}>
          <IconPlus className="h-[14px] w-[14px] shrink-0 text-white" stroke={1.5} aria-hidden />
          Novo alerta
        </button>
      </div>
    </div>
  )
}

interface NoticiasFilterBarProps {
  filterSentiment: string
  filterRisk: string
  filterDestaque: FiltroDestaque
  searchInput: string
  ocultarLixo: boolean
  onSentimentChange: (v: string) => void
  onRiskChange: (v: string) => void
  onDestaqueChange: (v: FiltroDestaque) => void
  onSearchChange: (v: string) => void
  onOcultarLixoChange: (v: boolean) => void
}

function PillSelect({
  value,
  activeValue,
  onChange,
  onClear,
  placeholder,
  options,
}: {
  value: string
  activeValue: string
  onChange: (v: string) => void
  onClear: () => void
  placeholder: string
  options: { value: string; label: string }[]
}) {
  const isActive = value !== activeValue

  if (isActive) {
    const label = options.find((o) => o.value === value)?.label ?? value
    return (
      <span className={pillFilterActiveClass}>
        {label}
        <button type="button" onClick={onClear} className="ml-0.5 inline-flex opacity-80 hover:opacity-100" aria-label={`Limpar filtro ${placeholder}`}>
          <IconX className="h-3 w-3" stroke={2} />
        </button>
      </span>
    )
  }

  return (
    <label className="relative inline-flex shrink-0 items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(pillFilterIdleClass, 'cursor-pointer appearance-none pr-7')}
        aria-label={placeholder}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown className="pointer-events-none absolute right-2.5 h-2.5 w-2.5 text-text-muted opacity-70" stroke={2} aria-hidden />
    </label>
  )
}

export function NoticiasFilterBar({
  filterSentiment,
  filterRisk,
  filterDestaque,
  searchInput,
  ocultarLixo,
  onSentimentChange,
  onRiskChange,
  onDestaqueChange,
  onSearchChange,
  onOcultarLixoChange,
}: NoticiasFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <PillSelect
          value={filterSentiment}
          activeValue="all"
          onChange={onSentimentChange}
          onClear={() => onSentimentChange('all')}
          placeholder="Sentimento"
          options={[
            { value: 'all', label: 'Sentimento' },
            { value: 'positive', label: 'Positivo' },
            { value: 'negative', label: 'Negativo' },
            { value: 'neutral', label: 'Neutro' },
          ]}
        />
        <PillSelect
          value={filterRisk}
          activeValue="all"
          onChange={onRiskChange}
          onClear={() => onRiskChange('all')}
          placeholder="Risco"
          options={[
            { value: 'all', label: 'Risco' },
            { value: 'high', label: 'Alto' },
            { value: 'medium', label: 'Médio' },
            { value: 'low', label: 'Baixo' },
          ]}
        />
        <PillSelect
          value={filterDestaque}
          activeValue="all"
          onChange={(v) => onDestaqueChange(v as FiltroDestaque)}
          onClear={() => onDestaqueChange('all')}
          placeholder="Destaque"
          options={[
            { value: 'all', label: 'Destaque' },
            { value: 'painel', label: 'Painel' },
            { value: 'monitor', label: 'Monitor' },
          ]}
        />

        <span className="hidden h-4 w-px shrink-0 bg-[rgb(var(--color-border-tertiary))] sm:block" aria-hidden />

        <label className="relative min-w-[10rem] flex-1 shrink-0">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted opacity-70" stroke={1.75} aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Palavra-chave ou fonte"
            className={cn(pillInputClass, 'w-full min-w-[9rem] pl-8')}
            autoComplete="off"
          />
        </label>
      </div>

      {ocultarLixo ? (
        <button
          type="button"
          onClick={() => onOcultarLixoChange(false)}
          className={pillFilterActiveClass}
        >
          Ocultar lixo
          <IconX className="ml-0.5 h-3 w-3" stroke={2} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => onOcultarLixoChange(true)} className={pillFilterIdleClass}>
          Ocultar lixo
        </button>
      )}
    </div>
  )
}

export { AlertasKpiStrip as NoticiasStatsRow } from '@/components/monitoramento/alertas-kpi-strip'
