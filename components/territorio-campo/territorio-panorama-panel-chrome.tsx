'use client'

import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  dashboardHubTabActiveClass,
  dashboardHubTabBaseClass,
  dashboardHubTabIdleClass,
} from '@/lib/sidebar-brand-styles'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyBodyMutedClass,
  typographyLinkClass,
  typographyMetricValueClass,
  typographySectionLabelClass,
  typographySectionLeadClass,
  typographySectionTitleClass,
  typographyTabClass,
  typographyTableFootClass,
  typographyTableTdClass,
  typographyTableThClass,
} from '@/lib/typography-chrome'
import {
  DashboardHubTabBar,
  DashboardPageHeader,
  dashboardPageBgClass,
} from '@/components/dashboard/dashboard-page-chrome'

/** Página branca (como Apify); cinza só em elementos internos. */
export const territorioPageBgClass = dashboardPageBgClass
export const territorioMutedBgClass = 'bg-bg-app'

export const TERRITORIO_PANORAMA_PANEL_HEIGHT_PX = 440
export const TERRITORIO_PANORAMA_TABLE_MAX_HEIGHT_PX = 300

export function TerritorioDataPanel({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[rgb(var(--color-border-secondary)/0.7)] bg-bg-surface',
        className
      )}
      style={style}
    >
      {children}
    </section>
  )
}

export function TerritorioPanelHeader({
  title,
  description,
  meta,
  action,
}: {
  title: string
  description?: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="shrink-0 border-b border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-surface px-4 pb-3 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={typographySectionTitleClass}>{title}</h2>
          {description ? (
            <p className={cn('mt-1', typographySectionLeadClass)}>{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {meta ? <div className="mt-2.5 flex flex-wrap items-center gap-2">{meta}</div> : null}
    </div>
  )
}

export function TerritorioMetaChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'positive' | 'negative' | 'primary'
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app px-2 py-1', typographyBodyClass)}>
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          tone === 'positive' && 'text-emerald-600',
          tone === 'negative' && 'text-red-600',
          tone === 'primary' && 'text-[rgb(var(--color-primary))]',
          tone === 'neutral' && 'text-text-primary'
        )}
      >
        {value}
      </span>
    </span>
  )
}

export function TerritorioPanelToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-2 border-b border-[rgb(var(--color-border-secondary)/0.45)] px-4 py-2.5',
        territorioMutedBgClass
      )}
    >
      {children}
    </div>
  )
}

export function TerritorioPanelSearchBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'shrink-0 border-b border-[rgb(var(--color-border-secondary)/0.45)] px-4 py-2.5',
        territorioMutedBgClass
      )}
    >
      {children}
    </div>
  )
}

export function TerritorioTabButton({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        dashboardHubTabBaseClass,
        'px-1 pb-2 pt-0.5',
        typographyTabClass,
        active ? dashboardHubTabActiveClass : dashboardHubTabIdleClass
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </button>
  )
}

export function TerritorioFilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 transition-colors',
        typographyBodyMediumClass,
        active
          ? 'border-[rgb(var(--color-primary)/0.45)] bg-bg-surface text-[rgb(var(--color-primary))] shadow-[0_1px_2px_rgb(0_0_0/0.04)]'
          : 'border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app/70 text-text-secondary hover:bg-bg-surface hover:text-text-primary'
      )}
    >
      {children}
    </button>
  )
}

export function TerritorioSearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
}) {
  return (
    <label className={cn('relative block min-w-[12rem] flex-1', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-[rgb(var(--color-border-secondary)/0.65)] bg-bg-surface py-1.5 pl-8 pr-3 outline-none transition-colors placeholder:text-text-muted focus:border-[rgb(var(--color-primary)/0.55)] focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.12)]',
          typographyBodyClass
        )}
      />
    </label>
  )
}

export function TerritorioTableScroll({
  children,
  maxHeight = TERRITORIO_PANORAMA_TABLE_MAX_HEIGHT_PX,
}: {
  children: React.ReactNode
  maxHeight?: number
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-bg-surface" style={{ maxHeight }}>
      {children}
    </div>
  )
}

export const territorioThClass = cn(
  'sticky top-0 z-10 border-b border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-app px-4 py-2',
  typographyTableThClass
)

export const territorioTdClass = cn(
  'border-b border-[rgb(var(--color-border-secondary)/0.3)] bg-bg-surface px-4 py-2.5',
  typographyTableTdClass
)

export const territorioTfootClass = cn(
  'border-t border-[rgb(var(--color-border-secondary)/0.45)] bg-bg-app',
  typographyTableFootClass
)

export function TerritorioThinProgress({
  percent,
  active = false,
}: {
  percent: number
  active?: boolean
}) {
  const width = Math.max(0, Math.min(100, percent))
  return (
    <div className="h-1.5 w-full min-w-[4rem] max-w-[7rem] overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.4)]">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          active ? 'bg-[rgb(var(--color-primary))]' : 'bg-text-primary/70'
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function TerritorioRowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app text-text-muted">
      {children}
    </span>
  )
}

export function TerritorioPageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return <DashboardPageHeader title={title} description={description} />
}

export function TerritorioHubTabBar({
  tabs,
  activeTab,
  onTabChange,
  actions,
}: {
  tabs: Array<{ id: string; label: string; icon?: React.ComponentType<{ className?: string }> }>
  activeTab: string
  onTabChange: (id: string) => void
  actions?: React.ReactNode
}) {
  return (
    <DashboardHubTabBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onTabChange}
      actions={actions}
    />
  )
}

export function TerritorioKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--color-border-secondary)/0.6)] bg-bg-app px-4 py-3">
      <p className={typographySectionLabelClass}>{label}</p>
      <p className={cn('mt-1', typographyMetricValueClass)}>{value}</p>
    </div>
  )
}

export function TerritorioTextButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(typographyLinkClass, className)}
    >
      {children}
    </button>
  )
}
