export interface MenuItem {
  id: string
  label: string
  icon: string
  href: string
  badge?: number
}

export interface KPI {
  id: string
  label: string
  value: string | number
  variation?: number
  status?: 'success' | 'warning' | 'error' | 'neutral'
  sparkline?: number[]
}

export interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  description: string
  timestamp: Date
  actionUrl?: string
}

export interface Action {
  id: string
  type: 'agenda' | 'narrativa' | 'territorio' | 'conteudo' | 'crise'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  deadline?: Date
}

export interface NewsItem {
  id: string
  title: string
  source: string
  sentiment: 'positive' | 'negative' | 'neutral'
  risk: 'high' | 'medium' | 'low'
  theme: string
  timestamp: Date
  url: string
}

export interface CampaignPhase {
  id: string
  name: string
  startDate: Date
  endDate: Date
  active: boolean
  indicators: string[]
  restrictions: string[]
  automations: string[]
}

