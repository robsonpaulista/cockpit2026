/** Sem zebrado — fundo uniforme (evita visual de planilha). */
export function resumoTrZebra(_rowIndex: number): string {
  return 'bg-transparent'
}

export function resumoAccentTextClass(): string {
  return 'text-[#e8a825]'
}

/** Coral fixo — substitui `accent-gold` (azul no tema republicanos) na aba Votação por Seção. */
export const resumoAmberChipActiveClass =
  'border-[#f04b23]/50 bg-[#f04b23]/10 text-text-primary'

export const resumoAmberChipActiveStrongClass =
  'border-[#f04b23]/50 bg-[#f04b23]/15 text-text-primary'

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
