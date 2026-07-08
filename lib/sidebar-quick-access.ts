import {
  resumoEleicoesHubHref,
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
} from '@/lib/resumo-eleicoes-hub-route'
import { TERRITORIO_CAMPO_TAB_BASE, territorioCampoHref } from '@/lib/territorio-campo-route'

export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon:
    | 'Radar'
    | 'ClipboardList'
    | 'MapPin'
    | 'BarChart3'
    | 'MessageSquare'
    | 'FolderOpen'
    | 'FileSpreadsheet'
    | 'ScrollText'
  pageKey: string
}

/** Ordem alfabética por rótulo (pt-BR). */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-arquivos',
    label: 'Arquivos',
    href: '/dashboard/arquivos',
    icon: 'FolderOpen',
    pageKey: 'arquivos',
  },
  {
    id: 'quick-atendimentos',
    label: 'Atendimentos',
    href: resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_ATENDIMENTO),
    icon: 'ClipboardList',
    pageKey: 'resumo-eleicoes',
  },
  {
    id: 'quick-base-eleitoral',
    label: 'Base Eleitoral',
    href: territorioCampoHref(TERRITORIO_CAMPO_TAB_BASE),
    icon: 'MapPin',
    pageKey: 'territorio',
  },
  {
    id: 'quick-emendas',
    label: 'Emendas',
    href: '/dashboard/emendas',
    icon: 'FileSpreadsheet',
    pageKey: 'emendas',
  },
  {
    id: 'quick-instagram-pessoal',
    label: 'Instagram Pessoal',
    href: '/dashboard/conteudo/redes',
    icon: 'MessageSquare',
    pageKey: 'conteudo',
  },
  {
    id: 'quick-ipt',
    label: 'Mapa Campanha',
    href: '/dashboard/territorio/ipt',
    icon: 'MapPin',
    pageKey: 'territorio',
  },
  {
    id: 'quick-pesquisas-opiniao',
    label: 'Pesquisas de Opinião',
    href: '/dashboard/pesquisa',
    icon: 'BarChart3',
    pageKey: 'pesquisa',
  },
  {
    id: 'quick-proposicoes',
    label: 'Proposições',
    href: '/dashboard/proposicoes',
    icon: 'ScrollText',
    pageKey: 'proposicoes',
  },
  {
    id: 'quick-radar-eleitoral',
    label: 'Radar Eleitoral',
    href: '/dashboard/noticias/monitoramento',
    icon: 'Radar',
    pageKey: 'noticias',
  },
]

export function isSidebarQuickAccessActive(
  item: SidebarQuickAccessItem,
  pathname: string,
  search: string,
): boolean {
  const params = new URLSearchParams(search)

  switch (item.id) {
    case 'quick-radar-eleitoral':
      return pathname.startsWith('/dashboard/noticias')
    case 'quick-atendimentos': {
      if (!pathname.startsWith('/dashboard/resumo-eleicoes')) return false
      const tab = params.get('tab')
      return !tab || tab === RESUMO_ELEICOES_TAB_ATENDIMENTO
    }
    case 'quick-ipt':
      return pathname.startsWith('/dashboard/territorio/ipt')
    case 'quick-base-eleitoral':
      return pathname.startsWith('/dashboard/territorio') && params.get('tab') === TERRITORIO_CAMPO_TAB_BASE
    case 'quick-pesquisas-opiniao':
      return pathname.startsWith('/dashboard/pesquisa')
    case 'quick-instagram-pessoal':
      return pathname.startsWith('/dashboard/conteudo/redes')
    case 'quick-arquivos':
      return pathname.startsWith('/dashboard/arquivos')
    case 'quick-emendas':
      return pathname.startsWith('/dashboard/emendas')
    case 'quick-proposicoes':
      return pathname.startsWith('/dashboard/proposicoes')
    default:
      return pathname === item.href
  }
}
