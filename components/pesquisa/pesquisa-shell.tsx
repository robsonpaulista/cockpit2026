'use client'

import { BarChart3, ClipboardList, LayoutGrid, LineChart } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PesquisaTab = 'panorama' | 'tendencia' | 'cadastradas'

const MAIN_TABS: { id: PesquisaTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'panorama', label: 'Panorama', icon: LayoutGrid },
  { id: 'tendencia', label: 'Tendência temporal', icon: LineChart },
  { id: 'cadastradas', label: 'Pesquisas cadastradas', icon: ClipboardList },
]

interface PesquisaShellProps {
  activeTab: PesquisaTab
  onTabChange: (tab: PesquisaTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function PesquisaShell({
  activeTab,
  onTabChange,
  tabActions,
  children,
}: PesquisaShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 text-[rgb(var(--color-primary))]">
          <BarChart3 className="h-5 w-5" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">Pesquisa &amp; Relato</span>
        </div>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-secondary">
          Competitividade eleitoral por município. Os rankings mostram os candidatos mais bem posicionados em cada cidade
          e são consolidados pelo eleitorado local para formar uma visão territorial da disputa.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-1">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {MAIN_TABS.map((tab) => {
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
