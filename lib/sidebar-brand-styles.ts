import { cn } from '@/lib/utils'

/** Marca — mesma cor da splash, login e paleta IPT (#ff9800). */
export const SIDEBAR_BRAND_AMBER = '#ff9800'

/** Slogan institucional — igual splash / login. */
export const APP_BRAND_TAGLINE = 'Comando Central de Eleições Dep Fed Jadyel Alencar'

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
export const sidebarActiveBorderClass = 'border-l-[#ff9800]'

export const sidebarActiveFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9800]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b0b0d]'

/** Divider entre seções */
export const sidebarBrandDividerClass = 'mx-[14px] h-px bg-white/10'

/** Abas horizontais das páginas (DashboardHubTabBar) — guia ativa laranja IPT. */
export const dashboardHubTabBaseClass =
  'inline-flex items-center gap-1.5 rounded-none border-b-2 px-0.5 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9800]/25 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-app'

export const dashboardHubTabActiveClass = 'border-[#ff9800] text-text-primary'

export const dashboardHubTabIdleClass =
  'border-transparent text-text-muted hover:text-text-primary'

/** Ícone / destaque — mesma cor do logo mark (não usar accent-gold do tema republicanos). */
export const brandAmberIconClass = 'text-[#ff9800]'

export const brandAmberIconWrapClass =
  'rounded-lg bg-[#ff9800]/10 p-2 text-[#ff9800] shrink-0'

export const brandAmberButtonClass =
  'inline-flex items-center gap-2 rounded-lg bg-[#ff9800] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#e28000] disabled:opacity-50'

export const brandAmberCalloutClass =
  'rounded-lg border border-[#ff9800]/30 bg-[#fff4e5] px-3 py-2.5 text-sm text-text-primary'

export const brandAmberPillBaseClass =
  'cursor-pointer rounded-[99px] border px-2.5 py-1 text-[11.5px] transition-colors'

export const brandAmberPillActiveClass =
  'border-[#ff9800] bg-[#fff4e5] font-medium text-[#e28000]'

export const brandAmberPillIdleClass =
  'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-secondary'

export const brandAmberFilterSelectClass =
  'appearance-none rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent py-1 pl-2.5 pr-7 text-[11.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[#ff9800]/25'

export const brandAmberChipClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#ff9800] bg-[#fff4e5] px-2.5 py-1 text-[11.5px] font-medium text-[#e28000]'

export const brandAmberCompactButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border-none bg-[#ff9800] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#e28000]'

export const brandAmberBadgeClass =
  'inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border border-[#ffd59a] bg-[#fff4e5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#e28000]'

export const brandAmberInfoButtonClass =
  'inline-flex rounded-full p-0.5 text-[#e28000] transition-colors hover:bg-[#fff4e5] hover:text-[#e28000]'

export const brandAmberSortButtonClass =
  'inline-flex items-center gap-1 select-none rounded transition-colors hover:text-[#ff9800] focus:outline-none focus:ring-2 focus:ring-[#ff9800]/40'

export const brandAmberSortIconClass = 'h-3.5 w-3.5 text-[#ff9800]'

export const brandAmberMetricClass = 'font-semibold text-[#ff9800]'

export const brandAmberPanelBorderClass =
  'rounded-[18px] border border-[#ebe8e4] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.03)]'

export const brandAmberFocusRingClass = 'focus-visible:ring-2 focus-visible:ring-[#ff9800]/40'
