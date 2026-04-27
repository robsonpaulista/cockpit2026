import { cn } from '@/lib/utils'

/**
 * Item ativo do menu lateral no tema Cockpit (mesmo gradiente dos KPIs hero / KPI EXPECTATIVA).
 * Mantido alinhado a `components/sidebar.tsx`.
 */
export const COCKPIT_PAGE_ACTIVE_MENU_ITEM =
  'border border-white/20 bg-[linear-gradient(135deg,#062e52_0%,#0b4a7a_52%,#1368a8_100%)] !text-white shadow-[0_12px_40px_rgba(6,46,82,0.35)] hover:shadow-[0_12px_40px_rgba(6,46,82,0.42)]'

export const COCKPIT_PAGE_ACTIVE_CHILD_PILL =
  'border border-white/20 bg-[linear-gradient(135deg,#062e52_0%,#0b4a7a_52%,#1368a8_100%)] !text-white shadow-[0_8px_24px_rgba(6,46,82,0.28)] hover:shadow-[0_10px_28px_rgba(6,46,82,0.38)]'

/** Item ativo no menu quando o tema não é Cockpit (gold soft + texto primário). */
export const DEFAULT_THEME_ACTIVE_MENU_ITEM =
  'bg-accent-gold-soft text-text-primary shadow-sm'

/**
 * Botão primário com a mesma linguagem visual do item ativo da sidebar (Cockpit = gradiente; demais = gold soft).
 */
export function sidebarPrimaryCTAButtonClass(isCockpit: boolean, className?: string): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-200 ease-out',
    isCockpit ? COCKPIT_PAGE_ACTIVE_MENU_ITEM : DEFAULT_THEME_ACTIVE_MENU_ITEM,
    'disabled:opacity-50 disabled:pointer-events-none',
    className
  )
}
