import { cn } from '@/lib/utils'
import {
  sidebarApifyChildItemClass,
  sidebarApifyNavIconClass,
  sidebarApifyNavItemClass,
  sidebarApifySectionLabelClass,
} from '@/lib/sidebar-apify-styles'

/** Azul primário Cockpit 2026 — use tokens CSS quando possível. */
export const PREMIUM_PRIMARY = 'rgb(var(--color-primary))'
export const PREMIUM_PRIMARY_TINT = 'rgb(var(--color-primary-tint))'
export const PREMIUM_PRIMARY_HOVER = 'rgb(var(--color-primary-hover))'

export const sidebarSectionLabelClass = sidebarApifySectionLabelClass

export const sidebarNavItemClass = sidebarApifyNavItemClass

export const sidebarNavIconClass = sidebarApifyNavIconClass

export const sidebarChildItemClass = sidebarApifyChildItemClass

export const ghostButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-3 py-1.5 text-[13px] font-medium text-text-primary transition-colors hover:bg-bg-app'

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-[rgb(var(--color-primary))] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[rgb(var(--color-primary-hover))] disabled:pointer-events-none disabled:opacity-50'

export const metricCardClass =
  'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-[14px]'

export const metricCardCompactClass =
  'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-2'

export const pillInputClass =
  'rounded-[99px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-3 py-1 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.25)]'

export const pillFilterActiveClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] px-2.5 py-1 text-[13px] font-medium text-[rgb(var(--color-primary))]'

export const pillFilterIdleClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-2.5 py-1 text-[13px] font-medium text-text-secondary transition-colors hover:bg-bg-app'

export const cargoChipClass =
  'inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-2.5 py-0.5 text-[13px]'

export const municipalityCardClass =
  'overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface transition-colors hover:border-[rgb(var(--color-border-secondary)/0.9)]'
