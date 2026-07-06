import { cn } from '@/lib/utils'

/** Marca âmbar — cor do segmento PIT e acentos da UI. */
export const SIDEBAR_BRAND_AMBER = '#C8900A'

export const APP_BRAND_TAGLINE = 'Campanha · 2026'

/** Wordmark tipográfico COCK + PIT — sans extrabold, máximo impacto. */
export const brandWordmarkClass =
  'font-sans font-extrabold uppercase leading-none tracking-[-0.04em]'

export const brandWordmarkTaglineClass =
  'font-sans text-[length:var(--text-2xs)] font-medium uppercase leading-none tracking-[0.16em] text-text-muted'

export const sidebarBrandLogoMarkClass =
  'flex h-6 w-6 shrink-0 items-center justify-center font-sans text-[11px] font-extrabold leading-none tracking-tighter'

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

/** Ícone / destaque âmbar — mesma cor do logo mark (não usar accent-gold no tema republicanos). */
export const brandAmberIconClass = 'text-[#C8900A]'

export const brandAmberIconWrapClass =
  'rounded-lg bg-[#C8900A]/10 p-2 text-[#C8900A] shrink-0'

export const brandAmberButtonClass =
  'inline-flex items-center gap-2 rounded-lg bg-[#C8900A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A87408] disabled:opacity-50'

export const brandAmberCalloutClass =
  'rounded-lg border border-[#C8900A]/30 bg-[#FAEEDA] px-3 py-2.5 text-sm text-text-primary'

export const brandAmberPillBaseClass =
  'cursor-pointer rounded-[99px] border px-2.5 py-1 text-[11.5px] transition-colors'

export const brandAmberPillActiveClass =
  'border-[#C8900A] bg-[#FAEEDA] font-medium text-[#854F0B]'

export const brandAmberPillIdleClass =
  'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-secondary'

export const brandAmberFilterSelectClass =
  'appearance-none rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent py-1 pl-2.5 pr-7 text-[11.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#C8900A]/25'

export const brandAmberChipClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#C8900A] bg-[#FAEEDA] px-2.5 py-1 text-[11.5px] font-medium text-[#854F0B]'

export const brandAmberCompactButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border-none bg-[#C8900A] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#A87408]'

export const brandAmberBadgeClass =
  'inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border border-[#E8D4A8] bg-[#FAEEDA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#854F0B]'

export const brandAmberInfoButtonClass =
  'inline-flex rounded-full p-0.5 text-[#A87408] transition-colors hover:bg-[#FAEEDA] hover:text-[#854F0B]'

export const brandAmberSortButtonClass =
  'inline-flex items-center gap-1 select-none rounded transition-colors hover:text-[#C8900A] focus:outline-none focus:ring-2 focus:ring-[#C8900A]/40'

export const brandAmberSortIconClass = 'h-3.5 w-3.5 text-[#C8900A]'

export const brandAmberMetricClass = 'font-semibold text-[#C8900A]'

export const brandAmberPanelBorderClass =
  'rounded-xl border border-[#E8D4A8]/50 bg-background/90 p-4'

export const brandAmberFocusRingClass = 'focus-visible:ring-2 focus-visible:ring-[#C8900A]/40'

/** Divider entre seções — 0.5px #E2E4E8, margem horizontal 14px */
export const sidebarBrandDividerClass = 'mx-[14px] h-[0.5px] bg-[#E2E4E8]'
