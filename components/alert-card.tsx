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
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-error',
    iconBg: 'bg-status-error/10',
    titleColor: 'text-primary',
    badge: 'Risco',
    badgeColor: 'bg-status-error/10 text-status-error border-0',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-warning',
    iconBg: 'bg-status-warning/10',
    titleColor: 'text-primary',
    badge: 'Atenção',
    badgeColor: 'bg-status-warning/10 text-status-warning border-0',
  },
  info: {
    icon: TrendingUp,
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-success',
    iconBg: 'bg-status-success/10',
    titleColor: 'text-primary',
    badge: 'Oportunidade',
    badgeColor: 'bg-status-success/10 text-status-success border-0',
  },
  risco: {
    icon: RiskIcon,
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-error',
    iconBg: 'bg-status-error/10',
    titleColor: 'text-primary',
    badge: 'Risco',
    badgeColor: 'bg-status-error/10 text-status-error border-0',
  },
  atencao: {
    icon: AlertTriangle,
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-warning',
    iconBg: 'bg-status-warning/10',
    titleColor: 'text-primary',
    badge: 'Atenção',
    badgeColor: 'bg-status-warning/10 text-status-warning border-0',
  },
  oportunidade: {
    icon: TrendingUp,
    bg: 'bg-background',
    border: 'border-transparent',
    iconColor: 'text-status-success',
    iconBg: 'bg-status-success/10',
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
        'relative p-3 rounded-lg',
        config.bg,
        'hover:bg-beige/50 transition-all duration-200',
        'cursor-pointer group'
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'p-1.5 rounded-md flex-shrink-0',
          config.iconBg
        )}>
          <Icon className={cn('w-3 h-3', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={cn(
              'px-1.5 py-0.5 text-[10px] font-medium rounded',
              config.badgeColor
            )}>
              {config.badge}
            </span>
          </div>
          <h4 className={cn('text-xs font-semibold mb-0.5 line-clamp-2', config.titleColor)}>
            {alert.title}
          </h4>
          <p className="text-[10px] text-secondary line-clamp-1">{alert.description}</p>
          <p className="text-[10px] text-text-muted mt-1">
            {formatDate(alert.timestamp)}
          </p>
        </div>
        <ChevronRight className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </div>
  )

  if (alert.actionUrl) {
    return <Link href={alert.actionUrl}>{content}</Link>
  }

  return content
}




