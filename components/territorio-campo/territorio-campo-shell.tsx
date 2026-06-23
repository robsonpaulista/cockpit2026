'use client'

import { CalendarDays, LayoutGrid, MapPin, Route } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerritorioCampoTab } from '@/lib/territorio-campo-route'

const TABS: { id: TerritorioCampoTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'panorama', label: 'Panorama', icon: LayoutGrid },
  { id: 'base', label: 'Base', icon: MapPin },
  { id: 'visitas', label: 'Visitas', icon: Route },
]

interface TerritorioCampoShellProps {
  activeTab: TerritorioCampoTab
  onTabChange: (tab: TerritorioCampoTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function TerritorioCampoShell({
  activeTab,
  onTabChange,
  tabActions,
  children,
}: TerritorioCampoShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2 text-[rgb(var(--color-primary))]">
          <CalendarDays className="h-5 w-5" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">Território &amp; Campo</span>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-secondary">
          Base de lideranças, expectativa territorial e visitas de campo (Campo &amp; Agenda).
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-1">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                    : 'text-text-secondary hover:bg-bg-app hover:text-text-primary'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </div>
        {tabActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 px-1 py-0.5">
            {tabActions}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  )
}

export type { TerritorioCampoTab }
