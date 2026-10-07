import { cn } from '@/lib/utils'
import { ghostButtonClass } from '@/lib/premium-ui-classes'

/** Texto principal da aba Base. */
export const territorioBaseTextClass = 'text-[#2b2d31]'

export const territorioBaseGhostButtonClass = cn(
  'territorio-cx-btn-ghost',
  ghostButtonClass,
  territorioBaseTextClass,
  'border-[#e8e8e6] bg-white hover:bg-[#f7f7f6]',
)
