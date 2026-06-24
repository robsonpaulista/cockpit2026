import { cn } from '@/lib/utils'
import { typographySectionLabelClass } from '@/lib/typography-chrome'

/** Hover discreto em cards — profundidade sem exagero. */
export const premiumCardHoverClass =
  'transition-[transform,box-shadow,border-color] duration-200 ease-premium hover:-translate-y-0.5 hover:border-[rgb(var(--color-border-secondary)/0.72)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]'

/** Stagger de entrada (índice 0-based, até 8). */
export function premiumStaggerClass(index: number): string {
  const slot = Math.min(index + 1, 8)
  return cn('animate-reveal-premium', `animate-reveal-premium-${slot}`)
}

/** Número principal de KPI — hierarquia forte. */
export const typographyKpiValueClass =
  'text-2xl font-semibold tabular-nums leading-none tracking-tight text-text-primary'

export const typographyKpiLabelClass = typographySectionLabelClass

/** Bloco skeleton com shimmer discreto. */
export const premiumSkeletonBlockClass =
  'rounded-md bg-[linear-gradient(90deg,rgb(var(--color-border-secondary)/0.22)_0%,rgb(var(--color-border-secondary)/0.38)_50%,rgb(var(--color-border-secondary)/0.22)_100%)] bg-[length:200%_100%] animate-premium-shimmer'
