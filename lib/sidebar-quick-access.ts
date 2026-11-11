import { canAccessSidebarItem, hrefForAllowedHub, type CanAccessFn } from '@/lib/page-access'
import {
  AGENDA_HREF,
  ATENDIMENTO_HREF,
  CHAPA_ESTADUAL_HREF,
  CHAPA_FEDERAL_HREF,
  RESULTADO_2026_HREF,
} from '@/lib/resumo-eleicoes-hub-route'
import { territorioCampoHref } from '@/lib/territorio-campo-route'

export type SidebarQuickAccessItem = {
  id: string
  label: string
  href: string
  icon:
    | 'Activity'
    | 'Building2'
    | 'Calendar'
    | 'ClipboardList'
    | 'BarChart3'
    | 'FileSpreadsheet'
    | 'Landmark'
    | 'MapPin'
    | 'MessageSquare'
    | 'Radar'
    | 'Scale'
    | 'ScrollText'
    | 'Users'
    | 'Vote'
  pageKey: string
}

/**
 * Ordem do Acesso rápido:
 * 1) Resultado 2026 no topo
 * 2) Fluxo operacional: Agenda → Atendimentos → Lideranças → Emendas → Instagram → Radar → Proposições → Chapas
 * 3) Demais módulos em ordem alfabética (pt-BR)
 */
export const SIDEBAR_QUICK_ACCESS_ITEMS: SidebarQuickAccessItem[] = [
  {
    id: 'quick-resultado-2026',
    label: 'Resultado 2026',
    href: RESULTADO_2026_HREF,
    icon: 'Vote',
    pageKey: 'resultado-2026',
  },
  {
    id: 'quick-agenda',
    label: 'Agenda',
    href: AGENDA_HREF,
    icon: 'Calendar',
    pageKey: 'agenda',
  },
  {
    id: 'quick-atendimentos',
    label: 'Atendimentos',
    href: ATENDIMENTO_HREF,
    icon: 'ClipboardList',
    pageKey: 'resumo-eleicoes',
  },
  {
    id: 'quick-liderancas',
    label: 'Lideranças',
    href: territorioCampoHref(),
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
    id: 'quick-instagram',
    label: 'Instagram',
    href: '/dashboard/conteudo/redes',
    icon: 'MessageSquare',
    pageKey: 'conteudo',
  },
  {
    id: 'quick-midias',
    label: 'Radar',
    href: '/dashboard/noticias/monitoramento',
    icon: 'Radar',
    pageKey: 'noticias',
  },
  {
    id: 'quick-proposicoes',
    label: 'Proposições',
    href: '/dashboard/proposicoes',
    icon: 'ScrollText',
    pageKey: 'proposicoes',
  },
  {
    id: 'quick-chapas',
    label: 'Chapas',
    href: CHAPA_FEDERAL_HREF,
    icon: 'Vote',
    pageKey: 'chapas',
  },
  {
    id: 'quick-arena',
    label: 'Arena',
    href: '/dashboard/mobilizacao',
    icon: 'Users',
    pageKey: 'mobilizacao',
  },
  {
    id: 'quick-ficha-atendimento',
    label: 'Ficha de Atendimento',
    href: '/dashboard/ficha-atendimento',
    icon: 'ClipboardList',
    pageKey: 'ficha-atendimento',
  },
  {
    id: 'quick-juridico',
    label: 'Jurídico',
    href: '/dashboard/juridico',
    icon: 'Scale',
    pageKey: 'juridico',
  },
  {
    id: 'quick-obras',
    label: 'Obras',
    href: '/dashboard/obras',
    icon: 'Building2',
    pageKey: 'obras',
  },
  {
    id: 'quick-oportunidades-federais',
    label: 'Oportunidades federais',
    href: '/dashboard/oportunidades-federais',
    icon: 'Landmark',
    pageKey: 'oportunidades-federais',
  },
  {
    id: 'quick-pesquisas',
    label: 'Pesquisas de Opinião',
    href: '/dashboard/pesquisa',
    icon: 'BarChart3',
    pageKey: 'pesquisa',
  },
  {
    id: 'quick-termometro',
    label: 'Termômetro',
    href: '/dashboard/war-room',
    icon: 'Activity',
    pageKey: 'war-room',
  },
]

const ITENS_HUB = new Set(['quick-instagram', 'quick-liderancas', 'quick-midias', 'quick-pesquisas'])

/** Hubs abrem na primeira aba liberada; quem só tem a chapa estadual cai direto nela. */
export function hrefSidebarQuickAccess(item: SidebarQuickAccessItem, canAccess: CanAccessFn): string {
  if (item.id === 'quick-chapas' && !canAccessSidebarItem(canAccess, 'chapas')) {
    return CHAPA_ESTADUAL_HREF
  }
  if (ITENS_HUB.has(item.id)) return hrefForAllowedHub(canAccess, item.pageKey, item.href)
  return item.href
}

export function isSidebarQuickAccessActive(item: SidebarQuickAccessItem, pathname: string): boolean {
  switch (item.id) {
    case 'quick-agenda':
      return pathname.startsWith(AGENDA_HREF)
    case 'quick-termometro':
      return pathname.startsWith('/dashboard/war-room')
    case 'quick-midias':
      return pathname.startsWith('/dashboard/noticias')
    case 'quick-instagram':
      return pathname.startsWith('/dashboard/conteudo/redes')
    case 'quick-liderancas':
      return (
        pathname.startsWith('/dashboard/territorio') && !pathname.startsWith('/dashboard/territorio/ipt')
      )
    case 'quick-pesquisas':
      return pathname.startsWith('/dashboard/pesquisa')
    case 'quick-chapas':
      return pathname === CHAPA_FEDERAL_HREF || pathname === CHAPA_ESTADUAL_HREF
    case 'quick-arena':
    case 'quick-emendas':
    case 'quick-oportunidades-federais':
    case 'quick-ficha-atendimento':
    case 'quick-juridico':
    case 'quick-obras':
    case 'quick-proposicoes':
      return pathname === item.href || pathname.startsWith(`${item.href}/`)
    default:
      return pathname === item.href
  }
}
