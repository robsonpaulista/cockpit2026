'use client'

import type { LucideIcon, LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

export const COCKPIT_ICON_CLASS = 'cockpit-icon'
export const COCKPIT_ICON_SM_CLASS = 'cockpit-icon cockpit-icon--sm'

type CockpitIconProps = LucideProps & {
  icon: LucideIcon
  size?: 'md' | 'sm'
}

/** Ícone outline normalizado — 17px / stroke 1.6 (sidebar, botões IPT). */
export function CockpitIcon({
  icon: Icon,
  size = 'md',
  className,
  strokeWidth = 1.6,
  ...props
}: CockpitIconProps) {
  return (
    <Icon
      className={cn(size === 'sm' ? COCKPIT_ICON_SM_CLASS : COCKPIT_ICON_CLASS, className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  )
}
