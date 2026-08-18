import { TERRITORIO_CAMPO_TAB_PANORAMA, territorioCampoHref } from '@/lib/territorio-campo-route'

export type PermissionTab = {
  id: string
  key: string
  label: string
}

export type PermissionPage = {
  key: string
  label: string
  path: string
  tabs?: PermissionTab[]
}

export type PermissionGroup = {
  id: string
  label: string
  hint?: string
  pages: PermissionPage[]
}

function tabs(pageKey: string, items: Array<{ id: string; label: string }>): PermissionTab[] {
  return items.map((item) => ({
    id: item.id,
    key: `${pageKey}:${item.id}`,
    label: item.label,
  }))
}

/**
 * Catálogo de permissões = páginas e abas atuais do Cockpit.
 * Chave de aba: `pagina:aba` (ex.: territorio:liderancas).
 * Ter a chave da página libera todas as abas.
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'campanha',
    label: 'Campanha',
    hint: 'Atalhos do menu esquerdo. Páginas com abas podem ser liberadas por seção.',
    pages: [
      { key: 'war-room', label: 'War Room', path: '/dashboard/war-room' },
      { key: 'ipt', label: 'Diagnóstico Operacional', path: '/dashboard/territorio/ipt' },
      {
        key: 'territorio',
        label: 'Base Eleitoral',
        path: territorioCampoHref(TERRITORIO_CAMPO_TAB_PANORAMA),
        tabs: tabs('territorio', [
          { id: 'panorama', label: 'Panorama' },
          { id: 'base', label: 'Base' },
          { id: 'visitas', label: 'Visitas' },
          { id: 'liderancas', label: 'Lideranças' },
          { id: 'demandas', label: 'Demandas' },
        ]),
      },
      { key: 'agenda', label: 'Agenda', path: '/dashboard/agenda' },
      {
        key: 'pesquisa',
        label: 'Pesquisas de Opinião',
        path: '/dashboard/pesquisa',
        tabs: tabs('pesquisa', [
          { id: 'panorama', label: 'Panorama' },
          { id: 'tendencia', label: 'Tendência temporal' },
          { id: 'cadastradas', label: 'Pesquisas cadastradas' },
          { id: 'gerar-publico', label: 'Gerar público pesquisa' },
        ]),
      },
      {
        key: 'noticias',
        label: 'Radar Eleitoral',
        path: '/dashboard/noticias/monitoramento',
        tabs: tabs('noticias', [
          { id: 'geral', label: 'Panorama' },
          { id: 'youtube', label: 'YouTube' },
          { id: 'google-news', label: 'Notícias' },
          { id: 'google-videos', label: 'Google Vídeos' },
          { id: 'instagram', label: 'Instagram' },
          { id: 'meta-ads', label: 'Anúncios' },
          { id: 'trends', label: 'Buscas' },
          { id: 'viral', label: 'Viral' },
          { id: 'lideres', label: 'Eng. líderes' },
        ]),
      },
      {
        key: 'resumo-eleicoes',
        label: 'Atendimentos',
        path: '/dashboard/resumo-eleicoes',
        tabs: tabs('resumo-eleicoes', [
          { id: 'atendimento', label: 'Atendimento' },
          { id: 'agenda', label: 'Agenda' },
          { id: 'secao', label: 'Votação por seção' },
          { id: 'chapa-federal', label: 'Chapa Federal' },
          { id: 'chapa-estadual', label: 'Chapa Estadual' },
        ]),
      },
      {
        key: 'conteudo',
        label: 'Redes Sociais / Instagram',
        path: '/dashboard/conteudo/redes',
        tabs: tabs('conteudo', [
          { id: 'posts', label: 'Posts & Insights' },
          { id: 'audience', label: 'Audiência' },
          { id: 'locations', label: 'Por Cidade' },
        ]),
      },
      { key: 'material-campanha', label: 'Gestão de Material', path: '/dashboard/material-campanha' },
    ],
  },
  {
    id: 'operacao',
    label: 'Operação',
    pages: [
      { key: 'resumo-operacional', label: 'Resumo Operacional', path: '/dashboard/resumo-operacional' },
      { key: 'narrativas', label: 'Estratégia', path: '/dashboard/narrativas' },
      { key: 'ficha-atendimento', label: 'Ficha de Atendimento', path: '/dashboard/ficha-atendimento' },
      { key: 'mobilizacao', label: 'Mobilização', path: '/dashboard/mobilizacao/config' },
      { key: 'whatsapp', label: 'WhatsApp', path: '/dashboard/whatsapp' },
      { key: 'operacao', label: 'Operação & Equipe', path: '/dashboard/operacao' },
      { key: 'gestao_pesquisas', label: 'Gestão de Pesquisas (campo)', path: '/dashboard/gestao-pesquisas' },
    ],
  },
  {
    id: 'mandato',
    label: 'Mandato',
    pages: [
      { key: 'juridico', label: 'Jurídico', path: '/dashboard/juridico' },
      { key: 'emendas', label: 'Emendas', path: '/dashboard/emendas' },
      { key: 'obras', label: 'Obras', path: '/dashboard/obras' },
      { key: 'proposicoes', label: 'Proposições', path: '/dashboard/proposicoes' },
    ],
  },
  {
    id: 'ferramentas',
    label: 'Ferramentas',
    pages: [{ key: 'sei-pesquisa', label: 'Pesquisa SEI (teste)', path: '/dashboard/sei-pesquisa' }],
  },
]

export const PERMISSION_PAGES: PermissionPage[] = PERMISSION_GROUPS.flatMap((group) => group.pages)

export const PERMISSION_PAGE_KEY_SET = new Set(PERMISSION_PAGES.map((page) => page.key))

export const PERMISSION_TAB_KEY_SET = new Set(
  PERMISSION_PAGES.flatMap((page) => page.tabs?.map((tab) => tab.key) ?? []),
)

const LEGACY_PAGE_LABELS: Record<string, string> = {
  campo: 'Campo & Agenda',
  fases: 'Fases da Campanha',
  arquivos: 'Arquivos',
  pesquisador_campo: 'Pesquisa de Campo',
  dashboard: 'Visão Geral',
}

const HIDDEN_LEGACY_KEYS = new Set(['usuarios', 'backup', 'log_system', 'dashboard', 'chapas'])

export function permissionPageByKey(key: string): PermissionPage | undefined {
  return PERMISSION_PAGES.find((page) => page.key === key)
}

export function tabPermissionKey(pageKey: string, tabId: string): string {
  return `${pageKey}:${tabId}`
}

export function legacyPermissionLabel(key: string): string {
  return LEGACY_PAGE_LABELS[key] ?? key
}

export function listLegacyPermissionKeys(stored: string[] | undefined | null): string[] {
  return (stored ?? []).filter(
    (key) =>
      !PERMISSION_PAGE_KEY_SET.has(key) &&
      !PERMISSION_TAB_KEY_SET.has(key) &&
      !HIDDEN_LEGACY_KEYS.has(key),
  )
}

/** Chaves que o guard de rota ainda precisa reconhecer (legado + admin). */
export const DASHBOARD_GUARD_PAGE_KEYS = new Set([
  'dashboard',
  ...PERMISSION_PAGE_KEY_SET,
  'campo',
  'fases',
  'arquivos',
  'chapas',
  'usuarios',
  'backup',
  'log_system',
])
