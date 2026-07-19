/** Chave de permissão usada em `canAccess` — espelha a sidebar. */
export function pageKeyForSidebarItem(id: string): string {
  if (id === 'chapas-menu') return 'chapas'
  if (id === 'chapas-estaduais') return 'chapas'
  if (id === 'ficha-atendimento') return 'ficha-atendimento'
  if (
    id === 'mobilizacao-menu' ||
    id === 'mobilizacao-captacao' ||
    id === 'mobilizacao-config'
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
  if (id === 'resumo-eleicoes-chapa-federal' || id === 'resumo-eleicoes-chapa-estadual') {
    return 'chapas'
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
  if (id === 'noticias-menu') return 'noticias'
  if (id === 'noticias-monitoramento' || id === 'radar-224') return 'noticias'
  if (id === 'territorio-ipt') return 'ipt'
  if (id === 'log-system') return 'log_system'
  return id === 'home' ? 'dashboard' : id
}
