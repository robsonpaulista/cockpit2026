'use client'

import {
  Bell,
  Instagram,
  LayoutGrid,
  LineChart,
  Megaphone,
  Newspaper,
  Radar,
  Users,
  Youtube,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type MonitoramentoTab =
  | 'geral'
  | 'google-alerts'
  | 'youtube'
  | 'trends'
  | 'google-news'
  | 'meta-ads'
  | 'instagram'
  | 'lideres'

const TABS: { id: MonitoramentoTab; label: string; icon: typeof Youtube }[] = [
  { id: 'geral', label: 'Panorama', icon: LayoutGrid },
  { id: 'google-alerts', label: 'Google Alerts', icon: Bell },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'google-news', label: 'Google News', icon: Newspaper },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'meta-ads', label: 'Meta Ads', icon: Megaphone },
  { id: 'trends', label: 'Google Trends', icon: LineChart },
  { id: 'lideres', label: 'Eng. líderes', icon: Users },
]

export type MonitoramentoPanoramaMeta = {
  lastUpdated: string | null
  windowLabel: string
  isLive: boolean
}

interface MonitoramentoShellProps {
  activeTab: MonitoramentoTab
  onTabChange: (tab: MonitoramentoTab) => void
  panoramaMeta?: MonitoramentoPanoramaMeta | null
  tabActions?: React.ReactNode
  children: React.ReactNode
}

function formatPanoramaDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MonitoramentoShell({
  activeTab,
  onTabChange,
  panoramaMeta,
  tabActions,
  children,
}: MonitoramentoShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <div>
        <div className="flex items-center gap-2 text-[rgb(var(--color-primary))]">
          <Radar className="h-5 w-5" aria-hidden />
          <span className="text-xs font-medium uppercase tracking-wide">Radar eleitoral</span>
        </div>
        {panoramaMeta ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-text-muted">
              {formatPanoramaDateTime(panoramaMeta.lastUpdated)} · {panoramaMeta.windowLabel}
            </p>
            {panoramaMeta.isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5E0] px-2 py-0.5 text-[10px] font-medium text-[#2D5A1E]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#3B6D11]" aria-hidden />
                dados recentes
              </span>
            ) : null}
          </div>
        ) : null}
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
