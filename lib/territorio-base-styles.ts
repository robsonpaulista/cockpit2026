import { cn } from '@/lib/utils'
import {
  cargoChipClass,
  ghostButtonClass,
  pillFilterIdleClass,
  pillInputClass,
} from '@/lib/premium-ui-classes'

/** Accent Cockpit X — âmbar da cena home/login. */
export const TERRITORIO_BASE_AMBER = '#e8a825'
export const TERRITORIO_CX_INK = '#14161a'

/** Texto principal da aba Base. */
export const territorioBaseTextClass = 'text-[#2b2d31]'

export const territorioBaseGhostButtonClass = cn(
  'territorio-cx-btn-ghost',
  ghostButtonClass,
  territorioBaseTextClass,
  'border-[#e8e8e6] bg-white hover:bg-[#f7f7f6]',
)

export const territorioBasePillInputClass = cn(
  pillInputClass,
  territorioBaseTextClass,
  'rounded-[10px] border-[#e8e8e6] bg-white placeholder:text-black/45 focus:ring-[#e8a825]/25',
)

export const territorioBasePillFilterIdleClass = cn(
  pillFilterIdleClass,
  territorioBaseTextClass,
  'rounded-[10px] border-[#e8e8e6] bg-white',
)

export const territorioBasePillFilterActiveClass =
  'inline-flex items-center gap-1 rounded-[10px] border border-[#e8a825] bg-[rgba(232,168,37,0.14)] px-2.5 py-1 text-[13px] font-medium text-[#2b2d31]'

export const territorioBaseCargoChipClass = cn(cargoChipClass, territorioBaseTextClass)

export const territorioBaseKpiGridClass = 'grid grid-cols-2 gap-2 sm:grid-cols-4'

export const territorioCxBtnPrimaryClass =
  'territorio-cx-btn-primary inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[#14161a] bg-[#14161a] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0a0a0c] disabled:opacity-50'

export const territorioCxBtnGhostClass =
  'territorio-cx-btn-ghost inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[#e8e8e6] bg-white px-3 text-xs font-medium text-[#52524f] transition-colors hover:bg-[#f7f7f6] hover:text-[#2b2d31] disabled:opacity-50'
