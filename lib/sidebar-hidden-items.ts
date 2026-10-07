/** Itens ocultos na sidebar — acessíveis via bloco superior, Acesso rápido ou URL direta. */
export const SIDEBAR_HIDDEN_MENU_IDS = new Set([
  'home',
  'territorio',
  'pesquisa',
  'resumo-eleicoes-menu',
  'conteudo-menu',
  'agenda',
  'gestao-pesquisas-menu',
  'material-campanha',
  'war-room',
  'resultado-2026',
])

export function isSidebarMenuItemHidden(id: string): boolean {
  return SIDEBAR_HIDDEN_MENU_IDS.has(id)
}

/** Subitens ocultos na sidebar — acessíveis via Acesso rápido ou URL direta. */
export const SIDEBAR_HIDDEN_CHILD_MENU_IDS = new Set(['conteudo-redes'])

export function isSidebarChildMenuItemHidden(id: string): boolean {
  return SIDEBAR_HIDDEN_CHILD_MENU_IDS.has(id)
}
