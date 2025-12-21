'use client'

import { AlertCircle, AlertTriangle, Info, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert } from '@/types'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface AlertCardProps {
  alert: Alert
}

const alertConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-status-error/10',
    border: 'border-status-error/30',
    iconColor: 'text-status-error',
    titleColor: 'text-status-error',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-status-warning/10',
    border: 'border-status-warning/30',
    iconColor: 'text-status-warning',
    titleColor: 'text-status-warning',
  },
  info: {
    icon: Info,
    bg: 'bg-primary-soft',
    border: 'border-primary/30',
    iconColor: 'text-primary',
    titleColor: 'text-primary',
  },
}

export function AlertCard({ alert }: AlertCardProps) {
  const config = alertConfig[alert.type]
  const Icon = config.icon

  const content = (
    <div
      className={cn(
        'p-4 rounded-xl border',
        config.bg,
        config.border,
        'hover:shadow-card-hover transition-all duration-200 ease-premium',
        'cursor-pointer group'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg bg-surface', config.bg)}>
          <Icon className={cn('w-4 h-4', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-semibold mb-1', config.titleColor)}>
            {alert.title}
          </h4>
          <p className="text-sm text-text-muted mb-2">{alert.description}</p>
          <p className="text-xs text-text-muted">
            {formatDate(alert.timestamp)}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </div>
  )

  if (alert.actionUrl) {
    return <Link href={alert.actionUrl}>{content}</Link>
  }

  return content
}

