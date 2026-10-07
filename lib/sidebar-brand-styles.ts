import { cn } from '@/lib/utils'

/**
 * Marca Cockpit X — tipografia Michroma + âmbar da cena home/login.
 * UI recorrente continua com azul institucional onde aplicável.
 */
export const SIDEBAR_BRAND_AMBER = '#e8a825'
export const SIDEBAR_BRAND_INST = '#005b8f'
export const SIDEBAR_BRAND_PETROL = '#0a0a0c'

/** Slogan institucional — igual splash / login. */
export const APP_BRAND_TAGLINE = 'Comando Dep Fed Jadyel Alencar'

/** Wordmark tipográfico COCKPIT X — Michroma, alinhado à home. */
export const brandWordmarkClass =
  'font-[family-name:var(--font-michroma)] uppercase leading-none tracking-[0.04em]'

export const brandWordmarkTaglineClass =
  'font-sans text-[length:var(--text-2xs)] font-medium uppercase leading-snug tracking-[0.14em] text-white/50'

export const sidebarBrandLogoMarkClass =
  'flex h-6 w-6 shrink-0 items-center justify-center font-[family-name:var(--font-michroma)] text-[11px] leading-none tracking-tighter'

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

/** Borda e foco do item ativo na sidebar — âmbar Cockpit X */
export const sidebarActiveBorderClass = 'border-l-[#e8a825]'

export const sidebarActiveFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a825]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[#070709]'

/** Divider entre seções */
export const sidebarBrandDividerClass = 'mx-[14px] h-px bg-white/10'

/** Abas horizontais — Cockpit X (underline âmbar). */
export const dashboardHubTabBaseClass =
  'inline-flex items-center gap-1.5 rounded-none border-b-2 px-0.5 pb-3 pt-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a825]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-app'

export const dashboardHubTabActiveClass = 'border-[#e8a825] font-semibold text-[#2b2d31]'

export const dashboardHubTabIdleClass =
  'border-transparent text-[#969692] hover:text-[#2b2d31]'

/** Ícone / destaque — accent oficial. */
export const brandAmberIconClass = 'text-[#f04b23]'

export const brandAmberIconWrapClass =
  'rounded-lg bg-[#f04b23]/10 p-2 text-[#f04b23] shrink-0'

export const brandAmberButtonClass =
  'inline-flex items-center gap-2 rounded-lg bg-[#005b8f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004870] disabled:opacity-50'

export const brandAmberChipClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#005b8f] bg-[#ddeaf3] px-2.5 py-1 text-[11.5px] font-medium text-[#005b8f]'

export const brandAmberCompactButtonClass =
  'inline-flex items-center gap-1.5 rounded-[10px] border-none bg-[#005b8f] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#004870]'

export const brandAmberBadgeClass =
  'inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border border-[#cdd5df] bg-[#ddeaf3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#005b8f]'

export const brandAmberMetricClass = 'font-semibold text-[#005b8f]'

export const brandAmberPanelBorderClass =
  'rounded-[18px] border border-[#e5e7eb] bg-white p-4 shadow-[0_1px_2px_rgba(2,43,58,0.03)]'
