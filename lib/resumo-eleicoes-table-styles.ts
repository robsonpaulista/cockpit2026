import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'

/** Seleção de linha — accent coral (padrão Copiloto / sidebar). */
export function resumoTrSelecionado(): string {
  return 'bg-[#f04b23]/12 ring-1 ring-inset ring-[#f04b23]'
}

/** Destaque forte (ex.: partido filtrado) — linha coral sólida, texto branco. */
export function resumoTrDestaqueForte(): string {
  return cn(
    'border-b border-[#f04b23] !bg-[#f04b23] font-semibold !text-white hover:!bg-[#f04b23]',
    '[&_button]:!text-white [&_button]:decoration-white/50',
    '[&_a]:!text-white',
  )
}

/** Destaque de candidato principal (Federal / Vereador) — mesmo azul da sidebar. */
export function resumoTrDestaquePetrol(): string {
  return cn(
    'resumo-tr-destaque-petrol font-semibold !text-white',
    '[&_button]:!text-white [&_button]:decoration-white/50',
    '[&_a]:!text-white',
  )
}

export function resumoTrZebra(rowIndex: number): string {
  return rowIndex % 2 === 0 ? 'bg-background/45' : 'bg-surface/25'
}

export const RESUMO_TABLE_CLASS = 'w-full text-xs'

export const RESUMO_TH_CLASS = 'bg-background px-1 py-1 text-xs text-text-secondary'

export const RESUMO_TD_CLASS = 'px-1 py-1'

export function resumoSortAccentClass(): string {
  return 'text-[#f04b23]'
}

export function resumoAccentTextClass(): string {
  return 'text-[#f04b23]'
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
    'border-b border-card text-text-primary transition-colors hover:bg-[#f04b23]/6',
    destaqueForte && resumoTrDestaqueForte(),
    !destaqueForte && selecionada && resumoTrSelecionado(),
    !destaqueForte && !selecionada && resumoTrZebra(rowIndex),
  )
}

export function resumoKpiValueClass(): string {
  return 'text-center text-xl font-bold leading-none tracking-tight tabular-nums text-[var(--palette-petrol)]'
}

export function resumoKpiLabelClass(): string {
  return 'text-xs font-semibold leading-none tracking-tight text-[var(--palette-petrol)]'
}

export function resumoKpiMetaClass(): string {
  return 'mt-1 text-center text-[11px] leading-tight text-[var(--palette-aux)]'
}

export function resumoKpiLinkClass(): string {
  return 'text-[11px] font-semibold text-[var(--palette-accent)] hover:underline disabled:cursor-not-allowed disabled:opacity-40'
}

export function resumoKpiCardClass(): string {
  return 'flex min-w-0 flex-col items-center rounded-xl border border-[var(--palette-divider)] bg-[var(--palette-card)] px-2.5 py-2.5 text-center'
}

export function resumoKpiHeaderClass(): string {
  return 'mb-1.5 flex w-full items-center justify-center gap-1.5'
}

export function resumoKpiIconWrapClass(): string {
  return 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--mon-brand-soft)]'
}

export function resumoKpiIconClass(): string {
  return 'h-3 w-3 shrink-0 text-[var(--palette-accent)]'
}

export function resumoKpiBarTrackClass(): string {
  return 'relative mx-auto mt-1.5 h-5 w-[4.75rem] overflow-hidden rounded-full bg-[var(--palette-chart-bg)]'
}

export function resumoKpiBarFillClass(): string {
  return 'absolute inset-y-0 left-0 rounded-full bg-[var(--palette-accent)] transition-[width] duration-500 ease-out'
}

export function resumoKpiBarLabelClass(): string {
  return 'relative z-10 flex h-full items-center justify-center text-[10px] font-bold tabular-nums leading-none text-[var(--palette-petrol)]'
}

/** Coral fixo — substitui `accent-gold` (azul no tema republicanos) na aba Votação por Seção. */
export const resumoAmberChipActiveClass =
  'border-[#f04b23]/50 bg-[#f04b23]/10 text-text-primary'

export const resumoAmberChipActiveStrongClass =
  'border-[#f04b23]/50 bg-[#f04b23]/15 text-text-primary'

export const resumoAmberButtonOutlineClass =
  'border-[#f04b23]/40 bg-[#f04b23]/10 text-text-primary hover:bg-[#f04b23]/15'

export const resumoAmberButtonOutlineHover20Class =
  'border-[#f04b23]/40 bg-[#f04b23]/10 text-text-primary hover:bg-[#f04b23]/20'

export const resumoAmberInfoBoxClass =
  'border-[#f04b23]/30 bg-[#f04b23]/10'

export const resumoAmberPillClass =
  'border-[#f04b23]/35 bg-[#f04b23]/10'

export const resumoAmberBadgeClass =
  'border-[#f04b23]/40 bg-[#f04b23]/10'

export const resumoAmberColHighlightClass = 'bg-[#f04b23]/15'

export const resumoAmberGroupRowClass =
  'border-b border-card/50 bg-[#f04b23]/5 hover:bg-[#f04b23]/10'

export const resumoAmberGroupCellClass = 'sticky left-0 z-10 bg-[#f04b23]/5 px-2 py-2'

export const resumoAmberSimilaridadeAltaClass =
  'border-[#f04b23]/50 bg-[#f04b23]/10'

export const resumoAmberSimilaridadeMediaClass =
  'border-[#f04b23]/30 bg-[#f04b23]/5'

export const resumoAmberBarAltaClass = 'bg-[#f04b23]'

export const resumoAmberBarMediaClass = 'bg-[#f04b23]/70'

export const resumoAmberAtualizarButtonClass =
  'inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#f04b23]/40 bg-[#f04b23]/10 px-4 text-sm font-medium text-text-primary hover:bg-[#f04b23]/15 disabled:opacity-50 lg:w-auto'
