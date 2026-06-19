'use client'

import Link from 'next/link'
import { LineChart, Radar, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MonitoramentoTab = 'youtube' | 'trends'

const TABS: { id: MonitoramentoTab; label: string; icon: typeof Youtube }[] = [
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'trends', label: 'Google Trends', icon: LineChart },
]

interface MonitoramentoShellProps {
  activeTab: MonitoramentoTab
  onTabChange: (tab: MonitoramentoTab) => void
  children: React.ReactNode
}

export function MonitoramentoShell({ activeTab, onTabChange, children }: MonitoramentoShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[rgb(var(--color-primary))]">
            <Radar className="h-5 w-5" aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wide">Radar eleitoral</span>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Central de monitoramento</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Compare menções no YouTube, interesse de busca no Google Trends e, em breve, outras fontes
            públicas — tudo a partir dos mesmos candidatos monitorados.
          </p>
        </div>
        <Link
          href="/dashboard/noticias"
          className="text-sm text-[rgb(var(--color-primary))] hover:underline"
        >
          ← Voltar ao Radar de notícias
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-1">
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

      {children}
    </div>
  )
}
