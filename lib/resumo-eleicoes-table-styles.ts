import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'

/** Seleção de linha — âmbar (padrão Central de Comunicação / sidebar). */
export function resumoTrSelecionado(): string {
  return 'bg-[#C8900A]/12 ring-1 ring-inset ring-[#C8900A]/35'
}

/** Destaque forte (ex.: candidato principal, partido filtrado). */
export function resumoTrDestaqueForte(): string {
  return 'border-b border-card bg-[#C8900A]/14 font-semibold text-[#C8900A] ring-1 ring-inset ring-[#C8900A]/28'
}

export function resumoTrZebra(rowIndex: number): string {
  return rowIndex % 2 === 0 ? 'bg-background/45' : 'bg-surface/25'
}

export const RESUMO_TABLE_CLASS = 'w-full text-xs'

export const RESUMO_TH_CLASS = 'bg-background px-1 py-1 text-xs text-text-secondary'

export const RESUMO_TD_CLASS = 'px-1 py-1'

export function resumoSortAccentClass(): string {
  return 'text-[#C8900A]'
}

export function resumoAccentTextClass(): string {
  return 'text-[#C8900A]'
}

export const RESUMO_ACCENT_AMBER = SIDEBAR_BRAND_AMBER

export function resumoPanelTitleClass(): string {
  return 'mb-2 text-center text-xs font-semibold text-text-primary'
}

export function resumoTableFooterClass(): string {
  return 'mt-2 flex items-center justify-between text-xs text-text-secondary'
}

export function resumoLinhaTabela(
  rowIndex: number,
  opts: { selecionada?: boolean; destaqueForte?: boolean } = {},
): string {
  const { selecionada = false, destaqueForte = false } = opts
  return cn(
    'border-b border-card text-text-primary transition-colors hover:bg-[#C8900A]/6',
    destaqueForte && resumoTrDestaqueForte(),
    !destaqueForte && selecionada && resumoTrSelecionado(),
    !destaqueForte && !selecionada && resumoTrZebra(rowIndex),
  )
}

export function resumoKpiValueClass(): string {
  return 'text-lg font-bold leading-none tabular-nums text-text-primary'
}

export function resumoKpiLabelClass(): string {
  return 'text-xs font-medium leading-tight text-text-muted'
}

export function resumoKpiMetaClass(): string {
  return 'mt-0.5 text-xs leading-tight text-text-secondary'
}

export function resumoKpiLinkClass(): string {
  return 'text-xs font-medium text-[#C8900A] hover:underline disabled:cursor-not-allowed disabled:opacity-40'
}
