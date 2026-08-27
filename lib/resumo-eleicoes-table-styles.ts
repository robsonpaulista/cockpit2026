import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'

/** Shell de card War Room (Comparativo / Elenco) — borda suave + sombra leve. */
export function resumoWrCardClass(...extra: Array<string | false | null | undefined>): string {
  return cn('resumo-wr-card', ...extra)
}

/** Shell glass (filtros / blocos maiores). */
export function resumoWrCardGlassClass(...extra: Array<string | false | null | undefined>): string {
  return cn('resumo-wr-card--glass', ...extra)
}

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

/** Sem zebrado — fundo uniforme (evita visual de planilha). */
export function resumoTrZebra(_rowIndex: number): string {
  return 'bg-transparent'
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
  return 'text-center text-xl font-bold leading-none tracking-tight tabular-nums text-[var(--wr-text-primary,#2b2d31)]'
}

export function resumoKpiLabelClass(): string {
  return 'text-xs font-semibold leading-none tracking-tight text-[var(--wr-text-primary,#2b2d31)]'
}

export function resumoKpiMetaClass(): string {
  return 'mt-1 text-center text-[11px] leading-tight text-[var(--wr-text-secondary,#686865)]'
}

export function resumoKpiLinkClass(): string {
  return 'text-[11px] font-semibold text-[var(--wr-text-primary,#2b2d31)] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40'
}

export function resumoKpiCardClass(): string {
  return 'resumo-wr-card--kpi flex min-w-0 flex-col items-center px-2.5 py-2.5 text-center'
}

export function resumoKpiHeaderClass(): string {
  return 'mb-1.5 flex w-full items-center justify-center gap-1.5'
}

export function resumoKpiIconWrapClass(): string {
  return 'resumo-wr-card__icon-wrap'
}

export function resumoKpiIconClass(): string {
  return 'resumo-wr-card__icon'
}

export function resumoKpiBarTrackClass(): string {
  return 'resumo-wr-kpi-bar-track'
}

export function resumoKpiBarFillClass(): string {
  return 'resumo-wr-kpi-bar-fill'
}

export function resumoKpiBarLabelClass(): string {
  return 'relative z-10 flex h-full items-center justify-center text-[10px] font-bold tabular-nums leading-none text-[var(--wr-text-primary,#2b2d31)]'
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
