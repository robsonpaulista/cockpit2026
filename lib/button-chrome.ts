import { cn } from '@/lib/utils'
import { typographyBodyMediumClass } from '@/lib/typography-chrome'

/** Botão padrão — texto preto, hover cinza (mesma linguagem da sidebar). */
export const chromeButtonClass = cn(
  'inline-flex items-center justify-center gap-2 rounded-md border border-[rgb(var(--color-border-secondary)/0.65)] bg-bg-surface px-3 py-1.5 transition-colors hover:bg-bg-app disabled:pointer-events-none disabled:opacity-50',
  typographyBodyMediumClass
)

/** Chip de filtro / janela temporal. */
export function chromeFilterChipClass(active: boolean) {
  return cn(
    'rounded-md border px-2.5 py-1 transition-colors',
    typographyBodyMediumClass,
    active
      ? 'border-[rgb(var(--color-border-secondary)/0.8)] bg-bg-app text-text-primary'
      : 'border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-surface text-text-primary hover:bg-bg-app'
  )
}

/** Barra de ferramentas interna de painel (janela, filtros locais). */
export const chromePanelToolbarClass =
  'flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-surface px-4 py-2.5'
