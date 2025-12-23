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
  url?: string
  content?: string
  sentiment: 'positive' | 'negative' | 'neutral'
  risk_level: 'high' | 'medium' | 'low'
  theme?: string
  actor?: string
  published_at?: Date | string
  collected_at?: Date | string
  processed?: boolean
  crisis_id?: string
  adversary_id?: string // ID do adversário cujo feed RSS coletou esta notícia (null para notícias gerais)
  timestamp?: Date
  risk?: 'high' | 'medium' | 'low' // Para compatibilidade com código existente
}

export interface Crisis {
  id: string
  title: string
  description?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'monitoring' | 'resolved' | 'archived'
  detected_at: Date | string
  resolved_at?: Date | string
  response_time?: number // em minutos
  narrative_id?: string
  created_at?: Date | string
  updated_at?: Date | string
}

export interface Adversary {
  id: string
  name: string
  type?: 'candidate' | 'party' | 'media' | 'influencer' | 'other'
  themes?: string[]
  presence_score?: number // Share of Voice (0-100)
  last_updated?: Date | string
  created_at?: Date | string
  updated_at?: Date | string
}

export interface AdversaryAttack {
  id: string
  adversary_id: string
  news_id: string
  attack_type: 'direct' | 'indirect' | 'false_claim' | 'omission'
  detected_at: Date | string
  created_at?: Date | string
  adversary?: Adversary
  news?: NewsItem
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

export interface Territory {
  id: string
  name: string
  description?: string
  vocations?: string[]
  created_at?: string
  updated_at?: string
}

export interface TerritoryLeader {
  id: string
  territory_id: string
  name: string
  phone?: string
  email?: string
  role?: string
  status: 'ativo' | 'inativo'
  notes?: string
  user_id?: string
  created_at?: string
  updated_at?: string
  territory?: Territory
}

export interface Task {
  id: string
  territory_id: string
  leader_id?: string
  title: string
  description?: string
  status: 'backlog' | 'em-andamento' | 'em-revisao' | 'concluido' | 'cancelado'
  priority: 'baixa' | 'media' | 'alta' | 'urgente'
  due_date?: string
  completed_at?: string
  created_by?: string
  assigned_to?: string
  created_at?: string
  updated_at?: string
  territory?: Territory
  leader?: TerritoryLeader
  assigned_leader?: TerritoryLeader
}

