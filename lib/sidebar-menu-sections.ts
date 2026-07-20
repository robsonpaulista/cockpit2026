import type { SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'

/** Primeiro item de cada seção na sidebar (rótulo da coluna kanban). */
export const SIDEBAR_SECTION_START_ID: Record<string, string> = {
  home: 'Painel',
  territorio: 'Território',
  agenda: 'Território',
  'mobilizacao-menu': 'Operação',
  juridico: 'Institucional',
  'gestao-pesquisas-menu': 'Administração',
}

/** Descrição curta nos cards da home (opcional por id). */
export const DASHBOARD_KANBAN_CARD_HINTS: Record<string, string> = {
  home: 'Resumo do dia, alertas e status da campanha',
  'resumo-operacional': 'Briefing operacional e prioridades de visita',
  narrativas: 'Cenários, metas e diretrizes',
  agenda: 'Compromissos e cronograma',
  campo: 'Visitas e ações presenciais',
  territorio: 'Lideranças, expectativa territorial e visitas de campo',
  'ficha-atendimento': 'Tetos MAC/PAP e emendas por município',
  pesquisa: 'Intenção de voto, relatórios e tendências',
  chapas: 'Simulador de chapa federal — projeção de vagas',
  'chapas-estaduais': 'Simulador de chapa estadual — projeção de vagas',
  'resumo-eleicoes-principal': 'Resumo por cidade — expectativa, lideranças e pesquisas',
  'resumo-eleicoes-secao': 'Votação por seção eleitoral e histórico local',
  'conteudo-redes': 'Métricas, posts e performance no Instagram',
  'noticias-menu': 'Monitoramento de mídia e Radar 224 (cobertura municipal)',
  'noticias-monitoramento': 'Panorama, Google Alerts, YouTube, Trends e Instagram',
  'radar-224': 'Top 50 municípios e catálogo de fontes noticiosas',
  'fluxo-digital': 'Fluxo do conteúdo — planejamento à pós-visita',
  cobertura: 'Fluxo do conteúdo — planejamento à pós-visita',
  noticias: 'Mídia, crises e notícias em destaque',
  'mobilizacao-menu': 'Ativação de base e coordenação',
  whatsapp: 'Disparos e comunicação direta',
  operacao: 'Coordenadores e operação interna',
  juridico: 'Processos, prazos e comunicações',
  emendas: 'Emendas parlamentares',
  obras: 'Obras com status SEI',
  proposicoes: 'Proposições na Câmara',
  'sei-pesquisa': 'Busca no SEI-PI',
  'gestao-pesquisas-menu': 'App pesquisador de campo',
  usuarios: 'Permissões e contas',
  'log-system': 'Histórico de perguntas da IA Cockpit',
  'jarvis-assistant': 'Assistente de voz e briefing da campanha',
}

export interface SidebarMenuSection {
  id: string
  label: string
  items: SidebarMenuItemConfig[]
}

export function groupSidebarItemsBySection(items: SidebarMenuItemConfig[]): SidebarMenuSection[] {
  const sections: SidebarMenuSection[] = []
  let current: SidebarMenuSection | null = null

  for (const item of items) {
    const sectionLabel = SIDEBAR_SECTION_START_ID[item.id]
    if (sectionLabel) {
      current = { id: item.id, label: sectionLabel, items: [] }
      sections.push(current)
    }
    if (!current) {
      current = { id: 'outros', label: 'Cockpit', items: [] }
      sections.push(current)
    }
    current.items.push(item)
  }

  return sections.filter((s) => s.items.length > 0)
}
