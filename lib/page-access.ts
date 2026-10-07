import {
  PERMISSION_PAGES,
  permissionPageByKey,
  tabPermissionKey,
  type PermissionPage,
} from '@/lib/page-permissions-catalog'
import {
  isResumoEleicoesHubTab,
  RESUMO_ELEICOES_TAB_AGENDA,
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  RESUMO_ELEICOES_TAB_SECAO,
  resumoEleicoesHref,
  VOTACAO_SECAO_HREF,
} from '@/lib/resumo-eleicoes-hub-route'
import {
  type TerritorioCampoTab,
  territorioCampoHref,
} from '@/lib/territorio-campo-route'
import { pageKeyForSidebarItem } from '@/lib/sidebar-page-key'

export type CanAccessFn = (pageKey: string) => boolean

function grantsChapaTabs(canAccess: CanAccessFn): boolean {
  return canAccess('chapas')
}

export function canAccessTab(canAccess: CanAccessFn, pageKey: string, tabId: string): boolean {
  if (canAccess(pageKey)) return true
  if (
    pageKey === 'resumo-eleicoes' &&
    (tabId === 'chapa-federal' || tabId === 'chapa-estadual') &&
    grantsChapaTabs(canAccess)
  ) {
    return true
  }
  return canAccess(tabPermissionKey(pageKey, tabId))
}

/** Qualquer aba (ou a página inteira) já entra no módulo. */
export function canAccessPage(canAccess: CanAccessFn, pageKey: string): boolean {
  if (canAccess(pageKey)) return true
  if (pageKey === 'chapas') {
    return (
      canAccessTab(canAccess, 'resumo-eleicoes', 'chapa-federal') ||
      canAccessTab(canAccess, 'resumo-eleicoes', 'chapa-estadual')
    )
  }
  if (pageKey === 'agenda') {
    return canAccessTab(canAccess, 'resumo-eleicoes', RESUMO_ELEICOES_TAB_AGENDA)
  }
  const page = permissionPageByKey(pageKey)
  if (!page?.tabs?.length) return false
  return page.tabs.some((tab) => canAccessTab(canAccess, pageKey, tab.id))
}

/**
 * Hub de Redes: abas do Instagram aceitam chave da página ou da aba.
 * As demais rotas de conteúdo (hub, cards, obras…) exigem a página inteira.
 */
export function canAccessDashboardPage(
  canAccess: CanAccessFn,
  pageKey: string,
  pathname: string,
): boolean {
  if (pageKey === 'conteudo') {
    if (pathname.startsWith('/dashboard/conteudo/redes') || pathname.startsWith('/dashboard/cobertura')) {
      return canAccessPage(canAccess, 'conteudo')
    }
    return canAccess('conteudo')
  }
  if (pageKey === 'chapas') {
    return canAccessPage(canAccess, 'chapas')
  }
  if (pageKey === 'resumo-eleicoes') {
    if (pathname === '/dashboard/resumo-eleicoes' || pathname === '/dashboard/resumo-eleicoes/') {
      return canAccessTab(canAccess, pageKey, RESUMO_ELEICOES_TAB_ATENDIMENTO)
    }
    if (pathname.startsWith(VOTACAO_SECAO_HREF)) {
      return canAccessTab(canAccess, pageKey, RESUMO_ELEICOES_TAB_SECAO)
    }
  }
  return canAccessPage(canAccess, pageKey)
}

export function firstAllowedTabId(canAccess: CanAccessFn, pageKey: string): string | null {
  const page = permissionPageByKey(pageKey)
  if (!page?.tabs?.length) return null
  if (canAccess(pageKey)) return page.tabs[0]?.id ?? null
  const allowed = page.tabs.find((tab) => canAccessTab(canAccess, pageKey, tab.id))
  return allowed?.id ?? null
}

export function hrefForAllowedHub(canAccess: CanAccessFn, pageKey: string, fallback: string): string {
  const tabId = firstAllowedTabId(canAccess, pageKey)
  if (!tabId) return fallback
  if (pageKey === 'territorio') {
    return territorioCampoHref(tabId as TerritorioCampoTab)
  }
  if (pageKey === 'resumo-eleicoes' && isResumoEleicoesHubTab(tabId)) {
    return resumoEleicoesHref(tabId)
  }
  if (pageKey === 'noticias') {
    if (tabId === 'geral') return '/dashboard/noticias/monitoramento'
    return `/dashboard/noticias/monitoramento?tab=${tabId}`
  }
  if (pageKey === 'pesquisa') {
    if (tabId === 'tendencia') return '/dashboard/pesquisa'
    return `/dashboard/pesquisa?tab=${tabId}`
  }
  if (pageKey === 'conteudo') {
    return '/dashboard/conteudo/redes'
  }
  return fallback
}

export function expandStoredPermissions(stored: string[] | undefined | null): Set<string> {
  const next = new Set(stored ?? [])
  if (next.has('chapas')) {
    next.add(tabPermissionKey('resumo-eleicoes', 'chapa-federal'))
    next.add(tabPermissionKey('resumo-eleicoes', 'chapa-estadual'))
    next.delete('chapas')
  }
  const panoramaPesquisa = tabPermissionKey('pesquisa', 'panorama')
  if (next.has(panoramaPesquisa)) {
    next.add(tabPermissionKey('pesquisa', 'tendencia'))
    next.delete(panoramaPesquisa)
  }
  return next
}

export function compactPermissions(selected: Set<string>): string[] {
  const out = new Set(selected)
  out.delete('chapas')
  for (const page of PERMISSION_PAGES) {
    if (!page.tabs?.length) continue
    const allTabsOn = page.tabs.every((tab) => out.has(tab.key) || out.has(page.key))
    if (out.has(page.key) || allTabsOn) {
      out.add(page.key)
      for (const tab of page.tabs) out.delete(tab.key)
    } else {
      out.delete(page.key)
    }
  }
  return [...out]
}

export function isPageFullySelected(selected: Set<string>, page: PermissionPage): boolean {
  if (selected.has(page.key)) return true
  if (!page.tabs?.length) return false
  return page.tabs.every((tab) => selected.has(tab.key))
}

export function isPagePartiallySelected(selected: Set<string>, page: PermissionPage): boolean {
  if (!page.tabs?.length || selected.has(page.key)) return false
  const count = page.tabs.filter((tab) => selected.has(tab.key)).length
  return count > 0 && count < page.tabs.length
}

export function isTabSelected(selected: Set<string>, page: PermissionPage, tabKey: string): boolean {
  return selected.has(page.key) || selected.has(tabKey)
}

export function togglePagePermission(selected: Set<string>, page: PermissionPage): Set<string> {
  const next = new Set(selected)
  if (isPageFullySelected(next, page)) {
    next.delete(page.key)
    for (const tab of page.tabs ?? []) next.delete(tab.key)
    return next
  }
  next.add(page.key)
  for (const tab of page.tabs ?? []) next.delete(tab.key)
  return next
}

export function toggleTabPermission(selected: Set<string>, page: PermissionPage, tabKey: string): Set<string> {
  const next = new Set(selected)
  if (!page.tabs?.length) return next

  if (next.has(page.key)) {
    next.delete(page.key)
    for (const tab of page.tabs) {
      if (tab.key !== tabKey) next.add(tab.key)
    }
    return next
  }

  if (next.has(tabKey)) next.delete(tabKey)
  else next.add(tabKey)

  if (page.tabs.every((tab) => next.has(tab.key))) {
    next.add(page.key)
    for (const tab of page.tabs) next.delete(tab.key)
  }
  return next
}

export function canAccessSidebarItem(canAccess: CanAccessFn, itemId: string): boolean {
  if (itemId === 'conteudo-redes') return canAccessPage(canAccess, 'conteudo')
  if (itemId === 'chapas') {
    return canAccessTab(canAccess, 'resumo-eleicoes', 'chapa-federal')
  }
  if (itemId === 'chapas-estaduais') {
    return canAccessTab(canAccess, 'resumo-eleicoes', 'chapa-estadual')
  }
  if (itemId === 'resumo-eleicoes-principal') {
    return canAccessTab(canAccess, 'resumo-eleicoes', 'atendimento')
  }
  if (itemId === 'resumo-eleicoes-secao') {
    return canAccessTab(canAccess, 'resumo-eleicoes', 'secao')
  }
  if (
    itemId === 'resumo-eleicoes-menu' ||
    itemId === 'resumo-eleicoes-historico' ||
    itemId === 'resultado-2026'
  ) {
    return canAccessPage(canAccess, 'resumo-eleicoes')
  }
  const key = pageKeyForSidebarItem(itemId)
  return canAccessPage(canAccess, key)
}
