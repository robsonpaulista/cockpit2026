import { cn } from '@/lib/utils'

/** Espaçamento vertical uniforme entre blocos da página (12px). */
export const exercitoPageStackClass = 'flex flex-col gap-3'

/** Card de seção padrão — padding 14px 16px, borda e radius iguais em todos os blocos. */
export const exercitoSectionCardClass =
  'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3.5'

export const exercitoSectionTitleClass = 'text-[13px] font-medium text-text-primary'
export const exercitoSectionSubtitleClass = 'mt-0.5 text-[11px] text-text-muted'

/** Altura fixa dos dois painéis lado a lado (ranking + municípios). */
export const exercitoDualPanelGridClass =
  'grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2 lg:h-[440px]'

export const exercitoDualPanelItemClass = 'flex h-full min-h-[360px] flex-col overflow-hidden lg:min-h-0'

/** KPI: 4 colunas iguais na mesma linha, compactos. */
export const exercitoKpiGridClass = 'grid grid-cols-4 items-stretch gap-2'

export function exercitoKpiCardClass(extra?: string) {
  return cn(
    'rounded-[10px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-2.5',
    'flex min-w-0 flex-col',
    extra
  )
}

export const exercitoKpiValueClass =
  'text-[22px] font-medium leading-none tabular-nums text-text-primary'

export const exercitoKpiHeroValueClass =
  'text-[22px] font-medium leading-none tabular-nums text-[rgb(var(--color-primary))]'

/** Grid de alertas com linhas de altura igual. */
export const exercitoAlertGridClass = 'grid grid-cols-1 gap-3 md:grid-cols-2 md:auto-rows-fr'

export function exercitoAlertCardClass(extra?: string) {
  return cn(
    'rounded-[10px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app',
    'flex h-full min-h-[96px] flex-col transition-colors hover:border-[rgb(var(--color-border-secondary)/0.9)]',
    extra
  )
}
