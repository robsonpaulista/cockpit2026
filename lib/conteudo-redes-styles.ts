import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'
import { ghostButtonClass, pillFilterIdleClass, pillInputClass } from '@/lib/premium-ui-classes'

export const CONTEUDO_REDES_AMBER = SIDEBAR_BRAND_AMBER

export const conteudoRedesTextClass = 'text-black'

export const conteudoRedesAmberTextClass = 'text-[#f04b23]'

export const conteudoRedesGhostButtonClass = cn(ghostButtonClass, conteudoRedesTextClass)

export const conteudoRedesPillInputClass = cn(
  pillInputClass,
  conteudoRedesTextClass,
  'placeholder:text-black/45 focus:ring-[#f04b23]/25',
)

export const conteudoRedesPillFilterIdleClass = cn(pillFilterIdleClass, conteudoRedesTextClass)

export const conteudoRedesPillFilterActiveClass =
  'inline-flex shrink-0 items-center gap-1 rounded-[99px] border border-[#f04b23] bg-[#f04b23]/10 px-2.5 py-1 text-[13px] font-medium text-black'

export const conteudoRedesSubTabBarClass =
  '-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]'

export const conteudoRedesAmberTintBgClass = 'bg-[#f04b23]/12'

export const conteudoRedesAmberBorderTintClass = 'border-[#f04b23] bg-[#f04b23]/10'

export const conteudoRedesAmberRingClass = 'ring-2 ring-[#f04b23]/25'

export const conteudoRedesFocusRingClass = 'focus:ring-2 focus:ring-[#f04b23]/30'
