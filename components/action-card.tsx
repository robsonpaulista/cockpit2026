'use client'

import { MapPin, FileText, MessageSquare, Users, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Action } from '@/types'
import { formatDate } from '@/lib/utils'

interface ActionCardProps {
  action: Action
}

const actionConfig = {
  agenda: { icon: MapPin, label: 'Agenda' },
  narrativa: { icon: FileText, label: 'Narrativa' },
  territorio: { icon: MapPin, label: 'Território' },
  conteudo: { icon: MessageSquare, label: 'Conteúdo' },
  crise: { icon: AlertTriangle, label: 'Crise' },
}

const priorityColors = {
  high: 'border-status-error/50 bg-status-error/5',
  medium: 'border-status-warning/50 bg-status-warning/5',
  low: 'border-primary/30 bg-primary-soft',
}

export function ActionCard({ action }: ActionCardProps) {
  const config = actionConfig[action.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'p-4 rounded-xl border',
        priorityColors[action.priority],
        'hover:shadow-card-hover transition-all duration-200 ease-premium'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-surface">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-muted">{config.label}</span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                action.priority === 'high' && 'bg-status-error/20 text-status-error',
                action.priority === 'medium' && 'bg-status-warning/20 text-status-warning',
                action.priority === 'low' && 'bg-primary/20 text-primary'
              )}
            >
              {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-text-strong mb-1">{action.title}</h4>
          <p className="text-sm text-text-muted mb-2">{action.description}</p>
          {action.deadline && (
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              <span>{formatDate(action.deadline)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

