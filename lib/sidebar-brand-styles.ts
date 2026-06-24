import { cn } from '@/lib/utils'

/** Marca âmbar 22×22 — logo mark da sidebar. */
export const SIDEBAR_BRAND_AMBER = '#C8900A'

export const sidebarBrandLogoMarkClass =
  'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] bg-[#C8900A] text-white'

/** Nome do produto na sidebar — 12px / 600 / #1a1a1a */
export const sidebarBrandNameClass =
  'truncate text-xs font-semibold leading-tight tracking-tight text-[#1a1a1a]'

/** Sub-label do cliente ativo — 10px / 400 / #888 */
export const sidebarBrandClientClass =
  'mt-0.5 truncate text-[10px] font-normal leading-snug text-[#888888]'

/** Saudação do usuário na sidebar — 10px */
export const sidebarBrandWelcomeClass =
  'truncate text-[10px] font-normal leading-snug text-[#888888]'

export const sidebarBrandWelcomeNameClass = 'font-medium text-[#1a1a1a]'

/** Rótulo de seção CAPS — --text-2xs, --caps-tracking, #aaa */
export const sidebarBrandSectionLabelClass = cn(
  'px-[14px] text-[length:var(--text-2xs)] font-normal uppercase tracking-[var(--caps-tracking)] text-[#aaaaaa]'
)

/** Borda e foco do item ativo na sidebar — mesma cor do logo mark. */
export const sidebarActiveBorderClass = 'border-l-[#C8900A]'

export const sidebarActiveFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8900A]/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-surface'

/** Abas horizontais das páginas (DashboardHubTabBar) — guia ativa âmbar. */
export const dashboardHubTabBaseClass =
  'inline-flex items-center gap-1.5 rounded-none border-b-2 px-0.5 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8900A]/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-app'

export const dashboardHubTabActiveClass = 'border-[#C8900A] text-text-primary'

export const dashboardHubTabIdleClass =
  'border-transparent text-text-muted hover:text-text-primary'

/** Divider entre seções — 0.5px #E2E4E8, margem horizontal 14px */
export const sidebarBrandDividerClass = 'mx-[14px] h-[0.5px] bg-[#E2E4E8]'
