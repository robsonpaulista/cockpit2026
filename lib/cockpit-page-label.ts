/**
 * Nome curto da página no tema Cockpit (alinhado à sidebar).
 */
export function getCockpitPageLabel(pathname: string): string {
  const p = (pathname || '/dashboard').replace(/\/$/, '') || '/dashboard'

  if (p.startsWith('/dashboard/resumo-eleicoes/historico')) return 'Hist. federal'
  if (p.startsWith('/dashboard/territorio/mapa-tds')) return 'Mapa TDs'

  const exact: Record<string, string> = {
    '/dashboard': 'Visão',
    '/dashboard/narrativas': 'Estratégia',
    '/dashboard/campo': 'Campo',
    '/dashboard/agenda': 'Agenda',
    '/dashboard/territorio': 'Território',
    '/dashboard/chapas': 'Federal',
    '/dashboard/chapas-estaduais': 'Estadual',
    '/dashboard/resumo-eleicoes': 'Eleições',
    '/dashboard/conteudo': 'Conteúdo',
    '/dashboard/noticias': 'Radar',
    '/dashboard/mobilizacao': 'Mobilização',
    '/dashboard/mobilizacao/config': 'Mob. config',
    '/dashboard/whatsapp': 'WhatsApp',
    '/dashboard/pesquisa': 'Pesquisa',
    '/dashboard/operacao': 'Operação',
    '/dashboard/juridico': 'Jurídico',
    '/dashboard/obras': 'Obras',
    '/dashboard/proposicoes': 'Proposições',
    '/dashboard/sei-pesquisa': 'SEI',
    '/dashboard/gestao-pesquisas': 'Gestão pesq.',
    '/dashboard/gestao-pesquisas/configuracoes': 'Config',
    '/dashboard/usuarios': 'Usuários',
  }

  if (exact[p]) return exact[p]
  if (p.startsWith('/dashboard/gestao-pesquisas/configuracoes')) return 'Config'
  if (p.startsWith('/dashboard/gestao-pesquisas')) return 'Gestão pesq.'

  const tail = p.replace(/^\/dashboard\/?/, '') || 'dashboard'
  return tail
    .split('/')[0]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
