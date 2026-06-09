import { cn } from '@/lib/utils'

/**
 * Item ativo do menu lateral no tema Cockpit (mesmo gradiente dos KPIs hero / KPI EXPECTATIVA).
 * Mantido alinhado a `components/sidebar.tsx`.
 */
export const COCKPIT_PAGE_ACTIVE_MENU_ITEM =
  'border border-white/20 bg-[linear-gradient(135deg,#243443_0%,#2f4353_52%,#3b5466_100%)] !text-white shadow-[0_12px_40px_rgba(10,22,34,0.34)] hover:shadow-[0_12px_40px_rgba(10,22,34,0.42)]'

export const COCKPIT_PAGE_ACTIVE_CHILD_PILL =
  'border border-white/20 bg-[linear-gradient(135deg,#243443_0%,#2f4353_52%,#3b5466_100%)] !text-white shadow-[0_8px_24px_rgba(10,22,34,0.28)] hover:shadow-[0_10px_28px_rgba(10,22,34,0.36)]'

/** Item ativo no menu quando o tema não é Cockpit (borda esquerda + tint azul). */
export const DEFAULT_THEME_ACTIVE_MENU_ITEM =
  'border-l-2 border-l-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] text-text-primary font-medium shadow-none'

export const DEFAULT_THEME_ACTIVE_CHILD_PILL =
  'border-l-2 border-l-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] text-text-primary font-medium'

/**
 * Botão primário com a mesma linguagem visual do item ativo da sidebar (Cockpit = gradiente; demais = gold soft).
 */
export function sidebarPrimaryCTAButtonClass(isCockpit: boolean, className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-[12px] font-medium transition-colors duration-200 ease-out',
    isCockpit
      ? COCKPIT_PAGE_ACTIVE_MENU_ITEM
      : 'bg-[rgb(var(--color-primary))] text-white hover:bg-[rgb(var(--color-primary-hover))]',
    'disabled:opacity-50 disabled:pointer-events-none',
    className
  )
}
