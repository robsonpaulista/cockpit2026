import { cn } from '@/lib/utils'

/** Azul primário Cockpit 2026 — use tokens CSS quando possível. */
export const PREMIUM_PRIMARY = 'rgb(var(--color-primary))'
export const PREMIUM_PRIMARY_TINT = 'rgb(var(--color-primary-tint))'
export const PREMIUM_PRIMARY_HOVER = 'rgb(var(--color-primary-hover))'

export const sidebarSectionLabelClass =
  'text-[10px] font-normal uppercase tracking-[0.06em] text-text-muted'

export const sidebarNavItemClass = (active: boolean) =>
  cn(
    'relative flex w-full items-center gap-2 rounded-[10px] border-l-2 px-2.5 py-[7px]',
    'text-[12.5px] font-medium leading-none transition-colors duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary)/0.35)] focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
    active
      ? 'border-l-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] text-text-primary shadow-none'
      : 'border-l-transparent text-text-secondary hover:bg-bg-app hover:text-text-primary'
  )

export const sidebarNavIconClass = (active: boolean) =>
  cn(
    'h-[14px] w-[14px] shrink-0 transition-opacity duration-200',
    active ? 'opacity-100 text-[rgb(var(--color-primary))]' : 'opacity-70 text-text-secondary'
  )

export const sidebarChildItemClass = (active: boolean) =>
  cn(
    'flex w-full min-w-0 items-center gap-2 truncate rounded-[8px] border-l-2 px-2.5 py-[7px] text-[12.5px] font-medium transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary)/0.35)] focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
    active
      ? 'border-l-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] text-text-primary'
      : 'border-l-transparent text-text-secondary hover:bg-bg-app hover:text-text-primary'
  )

export const ghostButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-3 py-1.5 text-[12px] font-medium text-text-primary transition-colors hover:bg-bg-app'

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-[rgb(var(--color-primary))] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[rgb(var(--color-primary-hover))] disabled:pointer-events-none disabled:opacity-50'

export const metricCardClass =
  'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-[14px]'

export const pillInputClass =
  'rounded-[99px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-3 py-1 text-[11.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.25)]'

export const pillFilterActiveClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] px-2.5 py-1 text-[11.5px] font-medium text-[rgb(var(--color-primary))]'

export const pillFilterIdleClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-2.5 py-1 text-[11.5px] font-medium text-text-secondary transition-colors hover:bg-bg-app'

export const cargoChipClass =
  'inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-2.5 py-0.5 text-[11px]'

export const municipalityCardClass =
  'overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface transition-colors hover:border-[rgb(var(--color-border-secondary)/0.9)]'
