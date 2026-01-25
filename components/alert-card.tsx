'use client'

import { AlertCircle, AlertTriangle, Info, ChevronRight, TrendingUp, AlertCircle as RiskIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert } from '@/types'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface AlertCardProps {
  alert: Alert
}

// Classificar alertas em Risco, Atenção ou Oportunidade
const classifyAlert = (alert: Alert): 'risco' | 'atencao' | 'oportunidade' => {
  const titleLower = alert.title.toLowerCase()
  const descLower = alert.description.toLowerCase()
  
  // Palavras-chave para oportunidade
  if (titleLower.includes('oportunidade') || titleLower.includes('cresceu') || 
      titleLower.includes('positivo') || titleLower.includes('repercussão') ||
      descLower.includes('positivo') || descLower.includes('crescimento')) {
    return 'oportunidade'
  }
  
  // Palavras-chave para risco
  if (titleLower.includes('risco') || titleLower.includes('crítico') || 
      titleLower.includes('crise') || titleLower.includes('problema') ||
      descLower.includes('risco') || descLower.includes('crítico')) {
    return 'risco'
  }
  
  // Padrão: atenção
  return 'atencao'
}

const alertConfig = {
  critical: {
    icon: RiskIcon,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-error',
    titleColor: 'text-primary',
    badge: 'Risco',
    badgeColor: 'bg-status-error/10 text-status-error border-0',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-warning',
    titleColor: 'text-primary',
    badge: 'Atenção',
    badgeColor: 'bg-status-warning/10 text-status-warning border-0',
  },
  info: {
    icon: TrendingUp,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-success',
    titleColor: 'text-primary',
    badge: 'Oportunidade',
    badgeColor: 'bg-status-success/10 text-status-success border-0',
  },
  risco: {
    icon: RiskIcon,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-error',
    titleColor: 'text-primary',
    badge: 'Risco',
    badgeColor: 'bg-status-error/10 text-status-error border-0',
  },
  atencao: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-warning',
    titleColor: 'text-primary',
    badge: 'Atenção',
    badgeColor: 'bg-status-warning/10 text-status-warning border-0',
  },
  oportunidade: {
    icon: TrendingUp,
    bg: 'bg-white',
    border: 'border-border-card',
    iconColor: 'text-status-success',
    titleColor: 'text-primary',
    badge: 'Oportunidade',
    badgeColor: 'bg-status-success/10 text-status-success border-0',
  },
}

export function AlertCard({ alert }: AlertCardProps) {
  const classification = classifyAlert(alert)
  const config = alertConfig[classification] || alertConfig[alert.type]
  const Icon = config.icon

  const content = (
    <div
      className={cn(
        'relative p-4 rounded-[12px] border',
        config.bg,
        config.border,
        'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200',
        'cursor-pointer group',
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:rounded-l-[12px]',
        classification === 'risco' ? 'before:bg-status-error' :
        classification === 'atencao' ? 'before:bg-status-warning' :
        'before:bg-status-success'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-lg bg-white flex-shrink-0'
        )}>
          <Icon className={cn('w-4 h-4', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              config.badgeColor
            )}>
              {config.badge}
            </span>
          </div>
          <h4 className={cn('text-sm font-semibold mb-1', config.titleColor)}>
            {alert.title}
          </h4>
          <p className="text-xs text-secondary mb-2 leading-relaxed">{alert.description}</p>
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




