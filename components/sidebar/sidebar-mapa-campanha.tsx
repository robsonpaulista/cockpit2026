'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/use-permissions'
import {
  sidebarNavIconClass,
  sidebarNavItemClass,
} from '@/lib/premium-ui-classes'
import { sidebarItemIconOnlyClass } from '@/lib/sidebar-layout'
import { sidebarApifyDividerClass, sidebarApifyTooltipClass } from '@/lib/sidebar-apify-styles'
import { JARVIS_SIDEBAR_DIVIDER } from '@/lib/jarvis-sidebar-styles'
import { resolveSidebarTablerIcon, SidebarTablerIcon } from '@/lib/sidebar-tabler-icons'
import {
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  resumoEleicoesHubHref,
} from '@/lib/resumo-eleicoes-hub-route'

type CampanhaLink = {
  id: string
  href: string
  label: string
  icon: 'MapPin' | 'Target' | 'Radar' | 'ClipboardList' | 'MessageSquare' | 'Package'
  pageKeys: string[]
}

const CAMPANHA_LINKS: CampanhaLink[] = [
  {
    id: 'diagnostico',
    href: '/dashboard/territorio/ipt',
    label: 'Diagnóstico Operacional',
    icon: 'MapPin',
    pageKeys: ['ipt', 'territorio', 'campo', 'agenda'],
  },
  {
    id: 'fluxo-digital',
    href: '/dashboard/fluxo-digital',
    label: 'Fluxo Digital',
    icon: 'Target',
    pageKeys: ['fluxo-digital', 'cobertura', 'conteudo'],
  },
  {
    id: 'radar-eleitoral',
    href: '/dashboard/noticias/monitoramento',
    label: 'Radar Eleitoral',
    icon: 'Radar',
    pageKeys: ['noticias'],
  },
  {
    id: 'atendimentos',
    href: resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_ATENDIMENTO),
    label: 'Atendimentos',
    icon: 'ClipboardList',
    pageKeys: ['resumo-eleicoes'],
  },
  {
    id: 'instagram-pessoal',
    href: '/dashboard/conteudo/redes',
    label: 'Instagram Pessoal',
    icon: 'MessageSquare',
    pageKeys: ['conteudo'],
  },
  {
    id: 'gestao-material',
    href: '/dashboard/material-campanha',
    label: 'Gestão de Material',
    icon: 'Package',
    pageKeys: ['material-campanha'],
  },
]

function isCampanhaLinkActive(link: CampanhaLink, pathname: string, search: string): boolean {
  if (link.id === 'radar-eleitoral') {
    return pathname.startsWith('/dashboard/noticias')
  }
  if (link.id === 'atendimentos') {
    if (!pathname.startsWith('/dashboard/resumo-eleicoes')) return false
    const tab = new URLSearchParams(search).get('tab')
    return !tab || tab === RESUMO_ELEICOES_TAB_ATENDIMENTO
  }
  if (link.id === 'instagram-pessoal') {
    return pathname.startsWith('/dashboard/conteudo/redes')
  }
  if (link.id === 'gestao-material') {
    return pathname.startsWith('/dashboard/material-campanha')
  }
  return pathname.startsWith(link.href)
}

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  isGradientHome: boolean
  searchKey: string
  onNavigate: (href: string) => void
}

/** Bloco superior: atalhos principais da campanha — acima de Acesso rápido. */
export function SidebarMapaCampanhaBlock({
  collapsed,
  mobileOpen,
  isGradientHome,
  searchKey,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? ''
  const { canAccess, loading } = usePermissions()

  const links = loading
    ? CAMPANHA_LINKS
    : CAMPANHA_LINKS.filter((link) => link.pageKeys.some((key) => canAccess(key)))

  if (links.length === 0) return null

  const iconOnly = collapsed && !mobileOpen

  return (
    <div
      className={cn(
        'sidebar-mapa-campanha',
        isGradientHome
          ? 'border-b border-[rgba(0,212,255,0.08)]'
          : 'border-b border-white/10',
        iconOnly ? 'px-1.5 py-1.5' : 'px-2.5 py-2',
      )}
    >
      {iconOnly ? (
        <div className="mb-1">
          <span
            className={cn(
              'mx-auto block',
              isGradientHome
                ? cn('h-px w-6 rounded-full', JARVIS_SIDEBAR_DIVIDER)
                : sidebarApifyDividerClass,
            )}
            aria-hidden
          />
        </div>
      ) : null}

      <div className={cn('flex flex-col', iconOnly ? 'gap-1' : 'gap-0.5')}>
        {links.map((link) => {
          const active = isCampanhaLinkActive(link, pathname, searchKey)
          const Icon = resolveSidebarTablerIcon(link.icon, false)
          return (
            <div key={link.id} className="group relative">
              <Link
                href={link.href}
                onClick={() => onNavigate(link.href)}
                title={iconOnly ? link.label : undefined}
                aria-label={link.label}
                className={cn(
                  sidebarNavItemClass(active),
                  sidebarItemIconOnlyClass(collapsed, mobileOpen),
                  iconOnly && 'justify-center px-1.5',
                )}
              >
                <SidebarTablerIcon icon={Icon} className={sidebarNavIconClass(active)} />
                {!iconOnly ? (
                  <span className="truncate text-[13px] leading-[17px] font-medium">
                    {link.label}
                  </span>
                ) : null}
              </Link>
              {iconOnly ? (
                <span
                  className={cn(
                    sidebarApifyTooltipClass,
                    'pointer-events-none absolute left-full top-1/2 z-[200] ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100',
                  )}
                  role="tooltip"
                >
                  {link.label}
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
