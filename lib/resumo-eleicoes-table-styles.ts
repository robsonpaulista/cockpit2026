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

/** Âmbar fixo — substitui `accent-gold` (azul no tema republicanos) na aba Votação por Seção. */
export const resumoAmberChipActiveClass =
  'border-[#C8900A]/50 bg-[#C8900A]/10 text-text-primary'

export const resumoAmberChipActiveStrongClass =
  'border-[#C8900A]/50 bg-[#C8900A]/15 text-text-primary'

export const resumoAmberButtonOutlineClass =
  'border-[#C8900A]/40 bg-[#C8900A]/10 text-text-primary hover:bg-[#C8900A]/15'

export const resumoAmberButtonOutlineHover20Class =
  'border-[#C8900A]/40 bg-[#C8900A]/10 text-text-primary hover:bg-[#C8900A]/20'

export const resumoAmberInfoBoxClass =
  'border-[#C8900A]/30 bg-[#C8900A]/10'

export const resumoAmberPillClass =
  'border-[#C8900A]/35 bg-[#C8900A]/10'

export const resumoAmberBadgeClass =
  'border-[#C8900A]/40 bg-[#C8900A]/10'

export const resumoAmberColHighlightClass = 'bg-[#C8900A]/15'

export const resumoAmberGroupRowClass =
  'border-b border-card/50 bg-[#C8900A]/5 hover:bg-[#C8900A]/10'

export const resumoAmberGroupCellClass = 'sticky left-0 z-10 bg-[#C8900A]/5 px-2 py-2'

export const resumoAmberSimilaridadeAltaClass =
  'border-[#C8900A]/50 bg-[#C8900A]/10'

export const resumoAmberSimilaridadeMediaClass =
  'border-[#C8900A]/30 bg-[#C8900A]/5'

export const resumoAmberBarAltaClass = 'bg-[#C8900A]'

export const resumoAmberBarMediaClass = 'bg-[#C8900A]/70'

export const resumoAmberAtualizarButtonClass =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#C8900A]/40 bg-[#C8900A]/10 px-4 text-sm font-medium text-text-primary hover:bg-[#C8900A]/15 disabled:opacity-50 lg:w-auto'
