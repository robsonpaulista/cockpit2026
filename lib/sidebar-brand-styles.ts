import { cn } from '@/lib/utils'

/**
 * Marca — paleta oficial Copiloto (`docs/paleta-copiloto.md`).
 * Accent coral para ênfase; azul institucional para UI recorrente.
 */
export const SIDEBAR_BRAND_AMBER = '#f04b23'
export const SIDEBAR_BRAND_INST = '#005b8f'
export const SIDEBAR_BRAND_PETROL = '#022b3a'

/** Slogan institucional — igual splash / login. */
export const APP_BRAND_TAGLINE = 'Comando Dep Fed Jadyel Alencar'

/** Wordmark tipográfico COCKPIT 2026 — sans bold, alinhado à splash. */
export const brandWordmarkClass =
  'font-sans font-bold uppercase leading-none tracking-[-0.01em]'

export const brandWordmarkTaglineClass =
  'font-sans text-[length:var(--text-2xs)] font-medium uppercase leading-snug tracking-[0.14em] text-white/50'

export const sidebarBrandLogoMarkClass =
  'flex h-6 w-6 shrink-0 items-center justify-center font-sans text-[11px] font-extrabold leading-none tracking-tighter'

/** Nome do produto na sidebar — contraste sobre fundo escuro. */
export const sidebarBrandNameClass =
  'truncate text-xs font-semibold leading-tight tracking-tight text-white/90'

/** Sub-label do cliente ativo */
export const sidebarBrandClientClass =
  'mt-0.5 truncate text-[10px] font-normal leading-snug text-white/45'

/** Saudação do usuário na sidebar */
export const sidebarBrandWelcomeClass =
  'truncate text-[10px] font-normal leading-snug text-white/50'

export const sidebarBrandWelcomeNameClass = 'font-medium text-white/85'

/** Rótulo de seção CAPS — sobre fundo escuro */
export const sidebarBrandSectionLabelClass = cn(
  'px-[14px] text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.18em] text-white/45'
)

/** Borda e foco do item ativo na sidebar */
export const sidebarActiveBorderClass = 'border-l-[#f04b23]'

export const sidebarActiveFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f04b23]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[#022b3a]'

/** Divider entre seções */
export const sidebarBrandDividerClass = 'mx-[14px] h-px bg-white/10'

/** Abas horizontais das páginas (DashboardHubTabBar). */
export const dashboardHubTabBaseClass =
  'inline-flex items-center gap-1.5 rounded-none border-b-2 px-0.5 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005b8f]/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-app'

export const dashboardHubTabActiveClass = 'border-[#005b8f] text-text-primary'

export const dashboardHubTabIdleClass =
  'border-transparent text-text-muted hover:text-text-primary'

/** Ícone / destaque — accent oficial. */
export const brandAmberIconClass = 'text-[#f04b23]'

export const brandAmberIconWrapClass =
  'rounded-lg bg-[#f04b23]/10 p-2 text-[#f04b23] shrink-0'

export const brandAmberButtonClass =
  'inline-flex items-center gap-2 rounded-lg bg-[#005b8f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004870] disabled:opacity-50'

export const brandAmberCalloutClass =
  'rounded-lg border border-[#005b8f]/25 bg-[#ddeaf3] px-3 py-2.5 text-sm text-text-primary'

export const brandAmberPillBaseClass =
  'cursor-pointer rounded-[99px] border px-2.5 py-1 text-[11.5px] transition-colors'

export const brandAmberPillActiveClass =
  'border-[#005b8f] bg-[#ddeaf3] font-medium text-[#005b8f]'

export const brandAmberPillIdleClass =
  'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-secondary'

export const brandAmberFilterSelectClass =
  'appearance-none rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent py-1 pl-2.5 pr-7 text-[11.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#005b8f]/25'

export const brandAmberChipClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#005b8f] bg-[#ddeaf3] px-2.5 py-1 text-[11.5px] font-medium text-[#005b8f]'

export const brandAmberCompactButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border-none bg-[#005b8f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#004870]'

export const brandAmberBadgeClass =
  'inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border border-[#cdd5df] bg-[#ddeaf3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#005b8f]'

export const brandAmberInfoButtonClass =
  'inline-flex rounded-full p-0.5 text-[#005b8f] transition-colors hover:bg-[#ddeaf3] hover:text-[#004870]'

export const brandAmberSortButtonClass =
  'inline-flex items-center gap-1 select-none rounded transition-colors hover:text-[#005b8f] focus:outline-none focus:ring-2 focus:ring-[#005b8f]/40'

export const brandAmberSortIconClass = 'h-3.5 w-3.5 text-[#005b8f]'

export const brandAmberMetricClass = 'font-semibold text-[#005b8f]'

export const brandAmberPanelBorderClass =
  'rounded-[18px] border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(2,43,58,0.03)]'

export const brandAmberFocusRingClass = 'focus-visible:ring-2 focus-visible:ring-[#005b8f]/40'
