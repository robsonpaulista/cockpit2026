'use client'

import {
  IconBell,
  IconCheck,
  IconPlus,
} from '@tabler/icons-react'
import { stripHtml } from '@/lib/strip-html'
import { ghostButtonClass } from '@/lib/premium-ui-classes'
import { cn } from '@/lib/utils'

export interface ActiveFeed {
  id: string
  name: string
  type: string
  active?: boolean
}

interface ActiveAlertsStripProps {
  feeds: ActiveFeed[]
  onManageAlerts: () => void
}

export function ActiveAlertsStrip({ feeds, onManageAlerts }: ActiveAlertsStripProps) {
  const activeFeeds = feeds.filter((f) => f.active !== false)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-5 py-2">
      <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
        <IconBell className="h-[11px] w-[11px] opacity-70" stroke={1.75} aria-hidden />
        Alertas ativos:
      </span>
      {activeFeeds.length === 0 ? (
        <span className="text-[11px] text-text-muted">Nenhum alerta configurado</span>
      ) : (
        activeFeeds.map((feed) => (
          <span
            key={`${feed.type}-${feed.id}`}
            className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] px-2.5 py-0.5 text-[11px] font-medium text-[rgb(var(--color-primary))]"
          >
            <IconCheck className="h-3 w-3 shrink-0" stroke={2} aria-hidden />
            {stripHtml(feed.name)}
          </span>
        ))
      )}
      <button type="button" onClick={onManageAlerts} className={cn(ghostButtonClass, 'rounded-full px-2.5 py-0.5 text-[11px]')}>
        <IconPlus className="h-3 w-3 opacity-70" stroke={2} aria-hidden />
        Gerenciar alertas
      </button>
    </div>
  )
}
