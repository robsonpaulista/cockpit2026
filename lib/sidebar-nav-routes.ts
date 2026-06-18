import type { MenuItem } from '@/types'

export interface SidebarMenuItemConfig extends MenuItem {
  children?: MenuItem[]
}

/** Mesma árvore da sidebar — fonte única para navegação do Jarvis. */
export const SIDEBAR_MENU_ITEMS: SidebarMenuItemConfig[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/dashboard' },
  {
    id: 'resumo-operacional',
    label: 'Resumo Operacional',
    icon: 'Activity',
    href: '/dashboard/resumo-operacional',
  },
  { id: 'narrativas', label: 'Estratégia', icon: 'Target', href: '/dashboard/narrativas' },
  { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/dashboard/agenda' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/dashboard/campo' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/dashboard/territorio' },
  {
    id: 'ficha-atendimento',
    label: 'Ficha de Atendimento',
    icon: 'ClipboardList',
    href: '/dashboard/ficha-atendimento',
  },
  { id: 'pesquisa', label: 'Pesquisa & Relato', icon: 'BarChart3', href: '/dashboard/pesquisa' },
  {
    id: 'chapas-menu',
    label: 'Chapas',
    icon: 'Vote',
    href: '/dashboard/chapas',
    children: [
      { id: 'chapas', label: 'Federal', icon: 'Vote', href: '/dashboard/chapas' },
      { id: 'chapas-estaduais', label: 'Estadual', icon: 'Vote', href: '/dashboard/chapas-estaduais' },
    ],
  },
  {
    id: 'resumo-eleicoes-menu',
    label: 'Resumo Eleições',
    icon: 'BarChart3',
    href: '/dashboard/resumo-eleicoes',
    children: [
      {
        id: 'resumo-eleicoes-principal',
        label: 'Resumo por cidade',
        icon: 'BarChart3',
        href: '/dashboard/resumo-eleicoes',
      },
      {
        id: 'resumo-eleicoes-historico',
        label: 'Histórico federal',
        icon: 'History',
        href: '/dashboard/resumo-eleicoes/historico',
      },
      {
        id: 'resumo-eleicoes-secao',
        label: 'Por seção',
        icon: 'MapPinned',
        href: '/dashboard/resumo-eleicoes/secao',
      },
    ],
  },
  {
    id: 'conteudo-menu',
    label: 'Redes Sociais',
    icon: 'MessageSquare',
    href: '/dashboard/conteudo',
    children: [
      { id: 'conteudo-hub', label: 'Visão geral', icon: 'LayoutDashboard', href: '/dashboard/conteudo' },
      { id: 'conteudo-obras', label: 'Obras (cards)', icon: 'Building2', href: '/dashboard/conteudo/obras' },
      { id: 'conteudo-agenda', label: 'Agenda campo', icon: 'Calendar', href: '/dashboard/conteudo/agenda' },
      { id: 'conteudo-cards', label: 'Cards', icon: 'FileText', href: '/dashboard/conteudo/cards' },
      { id: 'conteudo-referencias', label: 'Banco referências', icon: 'Image', href: '/dashboard/conteudo/referencias' },
      { id: 'conteudo-analise', label: 'Análise', icon: 'BarChart3', href: '/dashboard/conteudo/analise' },
      { id: 'conteudo-redes', label: 'Redes & Instagram', icon: 'MessageSquare', href: '/dashboard/conteudo/redes' },
    ],
  },
  { id: 'noticias', label: 'Notícias & Crises', icon: 'Newspaper', href: '/dashboard/noticias' },
  {
    id: 'mobilizacao-menu',
    label: 'Mobilização',
    icon: 'Users',
    href: '/dashboard/mobilizacao/config',
    children: [
      { id: 'mobilizacao-captacao', label: 'Captação', icon: 'Users', href: '/mobilizacao/detalhe' },
      {
        id: 'mobilizacao-mapa-digital-ig',
        label: 'Mapa Exército Digital',
        icon: 'AtSign',
        href: '/dashboard/mobilizacao/mapa-digital-ig',
      },
      { id: 'mobilizacao-config', label: 'Config', icon: 'Settings', href: '/dashboard/mobilizacao/config' },
    ],
  },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', href: '/dashboard/whatsapp' },
  { id: 'operacao', label: 'Operação & Equipe', icon: 'Settings', href: '/dashboard/operacao' },
  { id: 'juridico', label: 'Jurídico', icon: 'Scale', href: '/dashboard/juridico' },
  { id: 'emendas', label: 'Emendas', icon: 'FileSpreadsheet', href: '/dashboard/emendas' },
  { id: 'obras', label: 'Obras', icon: 'Building2', href: '/dashboard/obras' },
  { id: 'proposicoes', label: 'Proposições', icon: 'ScrollText', href: '/dashboard/proposicoes' },
  { id: 'sei-pesquisa', label: 'Pesquisa SEI (teste)', icon: 'Search', href: '/dashboard/sei-pesquisa' },
  {
    id: 'gestao-pesquisas-menu',
    label: 'Gestão de Pesquisas',
    icon: 'ClipboardList',
    href: '/dashboard/gestao-pesquisas',
    children: [
      {
        id: 'gestao-pesquisas-inicio',
        label: 'Visão geral',
        icon: 'ClipboardList',
        href: '/dashboard/gestao-pesquisas',
      },
      {
        id: 'gestao-pesquisas-config',
        label: 'Configurações',
        icon: 'Settings',
        href: '/dashboard/gestao-pesquisas/configuracoes',
      },
    ],
  },
  { id: 'usuarios', label: 'Gestão de Usuários', icon: 'Shield', href: '/dashboard/usuarios' },
]

export interface SidebarNavTarget {
  id: string
  label: string
  href: string
  aliases: string[]
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s&/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelAliases(label: string): string[] {
  const n = norm(label)
  const parts = [n]
  if (n.includes('&')) {
    parts.push(n.split('&').map((p) => p.trim()).join(' '))
    parts.push(...n.split('&').map((p) => p.trim()))
  }
  if (n.includes('(')) {
    parts.push(n.replace(/\([^)]*\)/g, '').trim())
  }
  return parts.filter(Boolean)
}

const EXTRA_ALIASES: Record<string, string[]> = {
  home: ['inicio', 'home', 'cockpit', 'painel', 'visao geral', 'dashboard', 'tela inicial'],
  'resumo-operacional': ['resumo operacional', 'resumo ops', 'briefing operacional'],
  narrativas: ['estrategia', 'narrativas'],
  agenda: ['agenda google', 'compromissos', 'calendario'],
  campo: ['campo', 'campo e agenda', 'visitas de campo', 'viagens'],
  territorio: ['territorio', 'territorio e base', 'base', 'liderancas territorio'],
  'ficha-atendimento': ['ficha', 'ficha de atendimento', 'atendimento'],
  pesquisa: ['pesquisa e relato', 'pesquisas', 'relato'],
  chapas: ['chapa federal', 'chapas federal', 'federal'],
  'chapas-estaduais': ['chapa estadual', 'chapas estadual', 'estadual'],
  'chapas-menu': ['chapas'],
  'resumo-eleicoes-principal': ['resumo eleicoes', 'resumo por cidade', 'eleicoes por cidade'],
  'resumo-eleicoes-historico': ['historico federal', 'historico eleicoes'],
  'resumo-eleicoes-secao': ['por secao', 'secao eleitoral', 'resumo secao'],
  'resumo-eleicoes-menu': ['resumo eleicoes', 'eleicoes'],
  'conteudo-hub': ['redes sociais', 'presenca e conteudo', 'presenca conteudo', 'conteudo hub'],
  'conteudo-menu': ['redes sociais', 'redes', 'presenca', 'conteudo', 'presenca e conteudo'],
  'conteudo-obras': ['obras cards', 'conteudo obras'],
  'conteudo-agenda': ['agenda campo', 'agenda de conteudo'],
  'conteudo-cards': ['cards conteudo'],
  'conteudo-referencias': ['banco referencias', 'referencias'],
  'conteudo-analise': ['analise conteudo'],
  'conteudo-redes': ['instagram', 'redes sociais', 'redes instagram'],
  noticias: ['noticias', 'crises', 'noticias e crises', 'radar'],
  'mobilizacao-captacao': ['captacao', 'mobilizacao captacao'],
  'mobilizacao-mapa-digital-ig': ['mapa digital', 'exercito digital', 'mapa ig', 'mapa instagram'],
  'mobilizacao-config': ['config mobilizacao', 'mobilizacao config'],
  'mobilizacao-menu': ['mobilizacao'],
  whatsapp: ['zap', 'whats'],
  operacao: ['operacao equipe', 'operacao e equipe', 'equipe'],
  juridico: ['juridico', 'legal'],
  emendas: ['emendas parlamentares'],
  obras: ['obras modulo'],
  proposicoes: ['proposicoes camara', 'projetos de lei'],
  'sei-pesquisa': ['sei', 'pesquisa sei'],
  'gestao-pesquisas-inicio': ['gestao pesquisas', 'gestao de pesquisas'],
  'gestao-pesquisas-config': ['config gestao pesquisas', 'configuracoes pesquisas'],
  'gestao-pesquisas-menu': ['gestao pesquisas'],
  usuarios: ['usuarios', 'gestao usuarios', 'gestao de usuarios', 'permissoes'],
}

function buildTarget(item: MenuItem): SidebarNavTarget {
  const aliases = new Set<string>([
    ...labelAliases(item.label),
    norm(item.id).replace(/-/g, ' '),
    ...(EXTRA_ALIASES[item.id] ?? []),
  ])
  return {
    id: item.id,
    label: item.label,
    href: item.href,
    aliases: [...aliases].filter(Boolean),
  }
}

function flattenMenu(items: SidebarMenuItemConfig[]): SidebarNavTarget[] {
  const out: SidebarNavTarget[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const target = buildTarget(item)
    if (!seen.has(target.href)) {
      seen.add(target.href)
      out.push(target)
    }
    for (const child of item.children ?? []) {
      const childTarget = buildTarget(child)
      if (!seen.has(childTarget.href)) {
        seen.add(childTarget.href)
        out.push(childTarget)
      }
    }
  }

  return out
}

export const SIDEBAR_NAV_TARGETS: SidebarNavTarget[] = flattenMenu(SIDEBAR_MENU_ITEMS)

export function findSidebarNavTargetByHref(href: string): SidebarNavTarget | undefined {
  return SIDEBAR_NAV_TARGETS.find((t) => t.href === href)
}

export function findSidebarNavTargetById(id: string): SidebarNavTarget | undefined {
  return SIDEBAR_NAV_TARGETS.find((t) => t.id === id)
}

export function sidebarNavTargetListForPrompt(max = 24): string {
  return SIDEBAR_NAV_TARGETS.slice(0, max)
    .map((t) => `${t.label} → ${t.href}`)
    .join('; ')
}

export { norm as normalizeSidebarNavText }
