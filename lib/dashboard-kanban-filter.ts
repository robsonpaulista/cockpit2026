import type { SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'

/** Itens do menu que não aparecem no kanban da home. */
const KANBAN_HIDDEN_ITEM_IDS = new Set([
  'narrativas',
  'juridico',
  'gestao-pesquisas-menu',
])

/** Subpáginas permitidas por menu pai no kanban (demais filhos ficam ocultos). */
const KANBAN_ALLOWED_CHILDREN: Record<string, readonly string[]> = {
  'resumo-eleicoes-menu': ['resumo-eleicoes-principal', 'resumo-eleicoes-secao'],
  'conteudo-menu': ['conteudo-redes'],
  'mobilizacao-menu': ['mobilizacao-mapa-digital-ig'],
}

/** Menus cujo filho permitido vira card avulso (um ou mais). */
const KANBAN_FLATTEN_PARENT_IDS = new Set(['resumo-eleicoes-menu', 'chapas-menu'])

/** Quando só resta um filho, vira card direto (sem submenu). */
function flattenSingleChild(
  parent: SidebarMenuItemConfig,
  child: NonNullable<SidebarMenuItemConfig['children']>[number]
): SidebarMenuItemConfig {
  return {
    id: child.id,
    label: child.label,
    icon: child.icon,
    href: child.href,
  }
}

export function filterItemsForDashboardKanban(
  items: SidebarMenuItemConfig[]
): SidebarMenuItemConfig[] {
  return items
    .filter((item) => !KANBAN_HIDDEN_ITEM_IDS.has(item.id))
    .flatMap((item) => {
      if (!item.children?.length) return [item]

      const allowedIds = KANBAN_ALLOWED_CHILDREN[item.id]
      const children = allowedIds
        ? item.children.filter((child) => allowedIds.includes(child.id))
        : item.children

      if (allowedIds && KANBAN_FLATTEN_PARENT_IDS.has(item.id)) {
        return children.map((child) => flattenSingleChild(item, child))
      }

      if (KANBAN_FLATTEN_PARENT_IDS.has(item.id)) {
        return item.children.map((child) => flattenSingleChild(item, child))
      }

      if (allowedIds && children.length === 1) {
        return [flattenSingleChild(item, children[0])]
      }

      if (allowedIds && children.length === 0) {
        return []
      }

      return [{ ...item, children }]
    })
    .filter((item) => {
      if (item.children) return item.children.length > 0
      return true
    })
}
