import { cn } from '@/lib/utils'
import { SIDEBAR_BRAND_AMBER } from '@/lib/sidebar-brand-styles'
import {
  cargoChipClass,
  ghostButtonClass,
  pillFilterIdleClass,
  pillInputClass,
} from '@/lib/premium-ui-classes'

export const TERRITORIO_BASE_AMBER = SIDEBAR_BRAND_AMBER

/** Texto preto em toda a aba Base (evita cinza/azul do tema). */
export const territorioBaseTextClass = 'text-black'

export const territorioBaseGhostButtonClass = cn(ghostButtonClass, territorioBaseTextClass)

export const territorioBasePillInputClass = cn(
  pillInputClass,
  territorioBaseTextClass,
  'placeholder:text-black/45 focus:ring-[#C8900A]/25',
)

export const territorioBasePillFilterIdleClass = cn(pillFilterIdleClass, territorioBaseTextClass)

export const territorioBasePillFilterActiveClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#C8900A] bg-[#C8900A]/10 px-2.5 py-1 text-[13px] font-medium text-black'

export const territorioBaseCargoChipClass = cn(cargoChipClass, territorioBaseTextClass)

export const territorioBaseKpiGridClass = 'grid grid-cols-2 gap-2 sm:grid-cols-4'
