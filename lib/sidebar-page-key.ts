/** Chave de permissão usada em `canAccess` — espelha a sidebar. */
export function pageKeyForSidebarItem(id: string): string {
  if (id === 'chapas-menu') return 'chapas'
  if (id === 'chapas-estaduais') return 'chapas'
  if (id === 'ficha-atendimento') return 'ficha-atendimento'
  if (
    id === 'mobilizacao-menu' ||
    id === 'mobilizacao-captacao' ||
    id === 'mobilizacao-config' ||
    id === 'mobilizacao-mapa-digital-ig'
  ) {
    return 'mobilizacao'
  }
  if (
    id === 'gestao-pesquisas-menu' ||
    id === 'gestao-pesquisas-inicio' ||
    id === 'gestao-pesquisas-config'
  ) {
    return 'gestao_pesquisas'
  }
  if (
    id === 'resumo-eleicoes-menu' ||
    id === 'resumo-eleicoes-principal' ||
    id === 'resumo-eleicoes-historico' ||
    id === 'resumo-eleicoes-secao'
  ) {
    return 'resumo-eleicoes'
  }
  if (
    id === 'conteudo-menu' ||
    id === 'conteudo-hub' ||
    id === 'conteudo-obras' ||
    id === 'conteudo-agenda' ||
    id === 'conteudo-cards' ||
    id === 'conteudo-referencias' ||
    id === 'conteudo-analise' ||
    id === 'conteudo-redes'
  ) {
    return 'conteudo'
  }
  return id === 'home' ? 'dashboard' : id
}
