import type { SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'
import type { SidebarMenuSection } from '@/lib/sidebar-menu-sections'

/** Colunas do kanban da home — ordem de exibição. */
export const DASHBOARD_KANBAN_SECTIONS: ReadonlyArray<{
  id: string
  label: string
  itemIds: readonly string[]
}> = [
  {
    id: 'comunicacao',
    label: 'Comunicação',
    itemIds: ['conteudo-redes', 'noticias', 'mobilizacao-mapa-digital-ig', 'whatsapp'],
  },
  {
    id: 'eleicoes',
    label: 'Eleições',
    itemIds: ['chapas', 'chapas-estaduais', 'pesquisa', 'resumo-eleicoes-secao'],
  },
  {
    id: 'atendimentos',
    label: 'Atendimentos',
    itemIds: ['agenda', 'campo', 'territorio', 'resumo-eleicoes-principal'],
  },
  {
    id: 'administracao',
    label: 'Administração',
    itemIds: ['log-system', 'usuarios'],
  },
]

export interface KanbanSectionAccent {
  shell: string
  title: string
}

/** Estilo unificado dos headers — mesmo padrão ciano da coluna Comunicação. */
const KANBAN_SECTION_HEADER_ACCENT: KanbanSectionAccent = {
  shell:
    'border-[rgba(0,212,255,0.28)] bg-[rgba(0,212,255,0.08)] shadow-[0_0_14px_rgba(0,102,255,0.15)]',
  title: 'text-[#00D4FF]',
}

export function getKanbanSectionAccent(_sectionId: string): KanbanSectionAccent {
  return KANBAN_SECTION_HEADER_ACCENT
}

function indexKanbanItems(items: SidebarMenuItemConfig[]): Map<string, SidebarMenuItemConfig> {
  return new Map(items.map((item) => [item.id, item]))
}

export function groupDashboardKanbanSections(
  items: SidebarMenuItemConfig[]
): SidebarMenuSection[] {
  const byId = indexKanbanItems(items)

  return DASHBOARD_KANBAN_SECTIONS.map((def) => ({
    id: def.id,
    label: def.label,
    items: def.itemIds
      .map((id) => byId.get(id))
      .filter((item): item is SidebarMenuItemConfig => Boolean(item)),
  })).filter((section) => section.items.length > 0)
}
