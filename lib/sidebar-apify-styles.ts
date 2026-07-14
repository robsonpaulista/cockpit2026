import {
  sidebarBrandDividerClass,
  sidebarBrandSectionLabelClass,
  sidebarActiveBorderClass,
  sidebarActiveFocusRingClass,
  dashboardHubTabActiveClass,
  dashboardHubTabBaseClass,
  dashboardHubTabIdleClass,
} from '@/lib/sidebar-brand-styles'
import { cn } from '@/lib/utils'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyLinkClass,
  typographyTabClass,
} from '@/lib/typography-chrome'

/** Classe no `<aside>` — fundo branco, borda fina (estilo Apify). */
export const SIDEBAR_APIFY_SHELL_CLASS = 'sidebar-apify-shell'

export const sidebarApifySectionLabelClass = sidebarBrandSectionLabelClass

export const sidebarApifyNavItemClass = (active: boolean) =>
  cn(
    'cockpit-sidebar-item relative flex w-full items-center gap-2 rounded-none border-l-2 px-2.5 py-2 no-underline hover:no-underline',
    'text-[13px] font-medium leading-[17px]',
    'transition-colors duration-150',
    sidebarActiveFocusRingClass,
    active
      ? cn(sidebarActiveBorderClass, 'bg-white/[0.06] text-white hover:text-white')
      : 'border-l-transparent text-white/72 hover:bg-white/[0.05] hover:text-white/90',
  )

export const sidebarApifyNavIconClass = (active: boolean) =>
  cn('cockpit-icon shrink-0', active ? 'text-[#ff9800]' : 'text-white/55')

/** Ícones decorativos no conteúdo — mesma cor dos ícones da sidebar. */
export const dashboardChromeIconClass = 'text-text-primary'

export const dashboardChromeIconShellSmClass =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app text-text-primary'

export const dashboardChromeIconShellMdClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app text-text-primary'

export const sidebarApifyChildItemClass = (active: boolean) =>
  cn(
    'flex w-full min-w-0 items-center truncate rounded-none border-l-2 py-1.5 pl-9 pr-2.5 no-underline hover:no-underline',
    typographyBodyMediumClass,
    'transition-colors duration-150',
    sidebarActiveFocusRingClass,
    active
      ? cn(sidebarActiveBorderClass, 'bg-white/[0.06] text-white hover:text-white')
      : 'border-l-transparent text-white/65 hover:bg-white/[0.05] hover:text-white/85',
  )

export const sidebarApifyIconButtonClass =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9800]/30'

export const sidebarApifyFooterActionClass = cn(
  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-white/72 transition-colors hover:bg-white/[0.05] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9800]/30',
  typographyBodyMediumClass
)

export const sidebarApifySearchInputClass = cn(
  'w-full rounded-md border border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-app py-1.5 pl-8 pr-11 outline-none transition-colors placeholder:text-text-muted focus:border-[rgb(var(--color-primary)/0.45)] focus:bg-bg-surface focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.1)]',
  typographyBodyClass
)

export const sidebarApifySearchKbdClass = cn(
  'pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[rgb(var(--color-border-secondary)/0.45)] bg-bg-surface px-1.5 py-0.5 text-text-muted',
  'text-[10px] font-medium uppercase tracking-[var(--caps-tracking)]',
  'normal-case tracking-normal'
)

export const sidebarApifyTooltipClass = cn(
  'fixed z-[200] whitespace-nowrap rounded-md border border-white/12 bg-[#141518] px-2.5 py-1.5 text-white/90 shadow-[0_8px_24px_rgb(0_0_0/0.45)]',
  typographyBodyMediumClass
)

export const sidebarApifyMobileToggleClass =
  'rounded-lg border border-[rgb(var(--color-border-secondary)/0.65)] bg-bg-surface p-2 text-text-primary shadow-[0_1px_3px_rgb(0_0_0/0.06)] transition-colors hover:bg-bg-app'

export const sidebarApifyDividerClass = sidebarBrandDividerClass

export const sidebarApifyHubTabClass = (active: boolean) =>
  cn(
    dashboardHubTabBaseClass,
    typographyTabClass,
    active ? dashboardHubTabActiveClass : dashboardHubTabIdleClass
  )
