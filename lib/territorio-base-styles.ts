import { cn } from '@/lib/utils'
import {
  cargoChipClass,
  ghostButtonClass,
  pillFilterIdleClass,
  pillInputClass,
} from '@/lib/premium-ui-classes'

/** Accent da aba Base — alinhado à paleta IPT (#ff9800). */
export const TERRITORIO_BASE_AMBER = '#ff9800'

/** Texto preto em toda a aba Base (evita cinza/azul do tema). */
export const territorioBaseTextClass = 'text-black'

export const territorioBaseGhostButtonClass = cn(ghostButtonClass, territorioBaseTextClass)

export const territorioBasePillInputClass = cn(
  pillInputClass,
  territorioBaseTextClass,
  'placeholder:text-black/45 focus:ring-[#ff9800]/25',
)

export const territorioBasePillFilterIdleClass = cn(pillFilterIdleClass, territorioBaseTextClass)

export const territorioBasePillFilterActiveClass =
  'inline-flex items-center gap-1 rounded-[99px] border border-[#ff9800] bg-[#ff9800]/10 px-2.5 py-1 text-[13px] font-medium text-black'

export const territorioBaseCargoChipClass = cn(cargoChipClass, territorioBaseTextClass)

export const territorioBaseKpiGridClass = 'grid grid-cols-2 gap-2 sm:grid-cols-4'
