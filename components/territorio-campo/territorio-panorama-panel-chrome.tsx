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

export const TERRITORIO_PANORAMA_PANEL_HEIGHT_PX = 500
export const TERRITORIO_PANORAMA_TABLE_MAX_HEIGHT_PX = 300
/** 8 linhas × 2rem + cabeçalho — corpo rolável alinhado entre os painéis da linha superior. */
export const TERRITORIO_PANORAMA_TABLE_BODY_HEIGHT_PX = 284
export const TERRITORIO_PANORAMA_PREVIEW_ROWS = 8
/** Altura mínima igual do cabeçalho nos painéis do Panorama (linha superior). */
export const territorioPanoramaPanelHeaderClass = 'min-h-[4rem]'

export const territorioPanoramaPanelLayout = {
  className: 'h-full',
  style: { height: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX },
} as const

/** Painéis da linha superior: altura pelo conteúdo, sem folga na base. */
export const territorioPanoramaTopRowPanelLayout = {
  className: 'h-auto',
} as const

export const territorioPanoramaTableTotalClass =
  'shrink-0 border-t-2 border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-surface'

/** Scroll só no corpo da tabela; total e link fixos abaixo. */
export function TerritorioPanoramaTableSection({
  children,
  footer,
  expandAction,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
  expandAction?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 flex-col gap-1 px-4 pb-2 pt-1.5">
      <div
        className="shrink-0 overflow-auto"
        style={{ height: TERRITORIO_PANORAMA_TABLE_BODY_HEIGHT_PX }}
      >
        {children}
      </div>
      {footer ? <div className="shrink-0">{footer}</div> : null}
      {expandAction ? <div className="shrink-0 leading-none">{expandAction}</div> : null}
    </div>
  )
}

export const TERRITORIO_PANORAMA_QUADRANT_PANEL_HEIGHT_PX = 520

export const territorioPanoramaQuadrantLayout = {
  className: 'h-full xl:col-span-2',
  style: { height: TERRITORIO_PANORAMA_QUADRANT_PANEL_HEIGHT_PX },
} as const

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
  className,
}: {
  title: string
  description?: React.ReactNode
  meta?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'shrink-0 border-b border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-surface px-4 pb-2 pt-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className={typographySectionTitleClass}>{title}</h2>
          {description ? (
            <p className={cn('mt-0.5', typographySectionLeadClass)}>{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0 self-start pt-0.5">{action}</div> : null}
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

export function TerritorioPanelIconButton({
  active = false,
  onClick,
  title,
  icon: Icon,
}: {
  active?: boolean
  onClick: () => void
  title: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        active
          ? 'bg-[#C8900A]/12 text-[#C8900A] ring-1 ring-[#C8900A]/35'
          : 'text-text-muted hover:bg-bg-surface hover:text-text-primary'
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

export function TerritorioPanelIconToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app p-0.5"
      role="toolbar"
    >
      {children}
    </div>
  )
}

export function TerritorioPanelIconDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-[rgb(var(--color-border-secondary)/0.55)]" aria-hidden />
}

export function TerritorioSearchField({
  value,
  onChange,
  placeholder,
  className,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  compact?: boolean
}) {
  return (
    <label className={cn('relative block min-w-[8rem]', compact ? 'w-36' : 'min-w-[12rem] flex-1', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-muted',
          compact ? 'left-2 h-3 w-3' : 'left-3 h-3.5 w-3.5'
        )}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-[rgb(var(--color-border-secondary)/0.65)] bg-bg-surface outline-none transition-colors placeholder:text-text-muted focus:border-[#C8900A]/55 focus:ring-2 focus:ring-[#C8900A]/12',
          typographyBodyClass,
          compact ? 'py-1 pl-7 pr-2' : 'py-1.5 pl-8 pr-3'
        )}
      />
    </label>
  )
}

export function TerritorioTableScroll({
  children,
  maxHeight,
}: {
  children: React.ReactNode
  maxHeight?: number
}) {
  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-bg-surface"
      style={maxHeight != null ? { maxHeight } : undefined}
    >
      {children}
    </div>
  )
}

export const territorioThClass = cn(
  'sticky top-0 z-10 border-b border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-app px-3 py-1',
  typographyTableThClass
)

export const territorioTdClass = cn(
  'border-b border-[rgb(var(--color-border-secondary)/0.3)] bg-bg-surface px-3 py-1 leading-tight',
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
          active ? 'bg-[#C8900A]' : 'bg-[#C8900A]/55'
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function TerritorioRowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app text-text-muted">
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
