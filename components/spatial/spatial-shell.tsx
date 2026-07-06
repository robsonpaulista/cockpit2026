'use client'

import type { ReactNode } from 'react'
import { Building2, Landmark, MapPin, Sparkles, Wallet } from 'lucide-react'

type SpatialShellProps = {
  children: ReactNode
  badge?: string
}

const FLOATING_ICONS = [
  { Icon: MapPin, className: 'spatial-float spatial-float--1', size: 28 },
  { Icon: Building2, className: 'spatial-float spatial-float--2', size: 34 },
  { Icon: Wallet, className: 'spatial-float spatial-float--3', size: 26 },
  { Icon: Landmark, className: 'spatial-float spatial-float--4', size: 32 },
  { Icon: Sparkles, className: 'spatial-float spatial-float--5', size: 22 },
] as const

export function SpatialShell({ children, badge }: SpatialShellProps) {
  return (
    <div className="spatial-shell">
      <div className="spatial-shell__gradient" aria-hidden />
      <div className="spatial-shell__grid" aria-hidden />
      <div className="spatial-shell__orbs" aria-hidden>
        <span className="spatial-shell__orb spatial-shell__orb--a" />
        <span className="spatial-shell__orb spatial-shell__orb--b" />
        <span className="spatial-shell__orb spatial-shell__orb--c" />
      </div>
      <div className="spatial-shell__floats" aria-hidden>
        {FLOATING_ICONS.map(({ Icon, className, size }) => (
          <Icon key={className} className={className} size={size} strokeWidth={1.5} />
        ))}
      </div>
      {badge ? <span className="spatial-shell__badge">{badge}</span> : null}
      <div className="spatial-shell__content">{children}</div>
    </div>
  )
}
