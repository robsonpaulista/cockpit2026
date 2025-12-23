import { KPI, Alert, Action, NewsItem, CampaignPhase } from '@/types'

export const mockKPIs: KPI[] = [
  {
    id: 'ife',
    label: 'Índice de Força Eleitoral',
    value: 72,
    variation: 3.2,
    status: 'success',
    sparkline: [65, 68, 70, 71, 70, 72, 72],
  },
  {
    id: 'presenca',
    label: 'Presença Territorial',
    value: '45/120',
    variation: 5,
    status: 'success',
  },
  {
    id: 'base',
    label: 'Capilaridade da Base',
    value: 1280,
    variation: 12,
    status: 'success',
  },
  {
    id: 'engajamento',
    label: 'Engajamento Útil',
    value: '12.4K',
    variation: -2.1,
    status: 'warning',
  },
  {
    id: 'sentimento',
    label: 'Sentimento Público',
    value: '68%',
    variation: 4.5,
    status: 'success',
  },
  {
    id: 'risco',
    label: 'Risco de Crise',
    value: 2,
    variation: -1,
    status: 'success',
  },
]

export const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'Notícia crítica em portal local',
    description: 'Matéria sobre saúde pública em destaque',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    actionUrl: '/noticias',
  },
  {
    id: '2',
    type: 'warning',
    title: 'Pendência jurídica',
    description: 'Peça aguardando aprovação há 3 dias',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    actionUrl: '/juridico',
  },
  {
    id: '3',
    type: 'info',
    title: 'Agenda confirmada',
    description: 'Visita a São Paulo confirmada para amanhã',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
    actionUrl: '/campo',
  },
]

export const mockActions: Action[] = [
  {
    id: '1',
    type: 'territorio',
    title: 'Ir a cidade X',
    description: 'Alta demanda e baixa presença',
    priority: 'high',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    type: 'narrativa',
    title: 'Responder tema Y',
    description: 'Tema emergente nas redes sociais',
    priority: 'medium',
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'agenda',
    title: 'Ativar liderança Z',
    description: 'Liderança com alto potencial de multiplicação',
    priority: 'medium',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
]

export const mockNews: NewsItem[] = [
  {
    id: '1',
    title: 'Candidato anuncia plano de saúde para periferia',
    source: 'Portal Local',
    sentiment: 'positive',
    risk: 'low',
    theme: 'Saúde',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    url: '#',
  },
  {
    id: '2',
    title: 'Adversário critica proposta de educação',
    source: 'Jornal Regional',
    sentiment: 'negative',
    risk: 'medium',
    theme: 'Educação',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    url: '#',
  },
  {
    id: '3',
    title: 'Pesquisa mostra crescimento nas intenções de voto',
    source: 'Agência de Notícias',
    sentiment: 'positive',
    risk: 'low',
    theme: 'Pesquisa',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    url: '#',
  },
]

export const mockPhases: CampaignPhase[] = [
  {
    id: 'pre',
    name: 'Pré-campanha',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-07-15'),
    active: false,
    indicators: ['Base de apoio', 'Presença territorial'],
    restrictions: ['Sem conteúdo eleitoral explícito'],
    automations: ['Cadastro de voluntários'],
  },
  {
    id: 'convencao',
    name: 'Convenção',
    startDate: new Date('2024-07-16'),
    endDate: new Date('2024-08-15'),
    active: false,
    indicators: ['Tendência de intenção', 'Crescimento de base'],
    restrictions: ['Conteúdo institucional limitado'],
    automations: ['WhatsApp básico'],
  },
  {
    id: 'oficial',
    name: 'Campanha Oficial',
    startDate: new Date('2024-08-16'),
    endDate: new Date('2024-10-02'),
    active: true,
    indicators: ['IFE', 'Sentimento', 'Presença'],
    restrictions: ['Conteúdo eleitoral permitido'],
    automations: ['WhatsApp completo', 'Mobilização', 'Radar'],
  },
  {
    id: 'reta-final',
    name: 'Reta Final',
    startDate: new Date('2024-10-03'),
    endDate: new Date('2024-10-30'),
    active: false,
    indicators: ['IFE', 'Presença', 'Mobilização'],
    restrictions: ['Conteúdo institucional reduzido'],
    automations: ['WhatsApp máximo', 'Alertas jurídicos'],
  },
]




