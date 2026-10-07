'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isWarRoomCleanRoute } from '@/lib/war-room-clean-route'
import { usePermissions } from '@/hooks/use-permissions'
import { canAccessPage, hrefForAllowedHub } from '@/lib/page-access'
import {
  sidebarNavIconClass,
  sidebarNavItemClass,
} from '@/lib/premium-ui-classes'
import { sidebarItemIconOnlyClass } from '@/lib/sidebar-layout'
import { sidebarApifyDividerClass, sidebarApifyTooltipClass } from '@/lib/sidebar-apify-styles'
import { JARVIS_SIDEBAR_DIVIDER } from '@/lib/jarvis-sidebar-styles'
import { resolveSidebarTablerIcon, SidebarTablerIcon } from '@/lib/sidebar-tabler-icons'
import { resolveSidebarLucideIcon, SidebarLucideIcon } from '@/lib/sidebar-lucide-icons'
import { territorioCampoHref } from '@/lib/territorio-campo-route'

type CampanhaLink = {
  id: string
  href: string
  label: string
  icon: 'MapPin' | 'Radar' | 'MessageSquare' | 'BarChart3'
  pageKey: string
}

/** Atalhos de campanha (sem os do Acesso rápido) — ordem alfabética. */
const CAMPANHA_LINKS: CampanhaLink[] = [
  {
    id: 'instagram-pessoal',
    href: '/dashboard/conteudo/redes',
    label: 'Instagram',
    icon: 'MessageSquare',
    pageKey: 'conteudo',
  },
  {
    id: 'base-eleitoral',
    href: territorioCampoHref(),
    label: 'Lideranças',
    icon: 'MapPin',
    pageKey: 'territorio',
  },
  {
    id: 'radar-eleitoral',
    href: '/dashboard/noticias/monitoramento',
    label: 'Mídias',
    icon: 'Radar',
    pageKey: 'noticias',
  },
  {
    id: 'pesquisas-opiniao',
    href: '/dashboard/pesquisa',
    label: 'Pesquisas de Opinião',
    icon: 'BarChart3',
    pageKey: 'pesquisa',
  },
]

function isCampanhaLinkActive(link: CampanhaLink, pathname: string, _search: string): boolean {
  if (link.id === 'base-eleitoral') {
    return (
      pathname.startsWith('/dashboard/territorio') &&
      !pathname.startsWith('/dashboard/territorio/ipt')
    )
  }
  if (link.id === 'pesquisas-opiniao') {
    return pathname.startsWith('/dashboard/pesquisa')
  }
  if (link.id === 'radar-eleitoral') {
    return pathname.startsWith('/dashboard/noticias')
  }
  if (link.id === 'instagram-pessoal') {
    return pathname.startsWith('/dashboard/conteudo/redes')
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

/** Atalhos de campanha — abaixo do Acesso rápido. */
export function SidebarMapaCampanhaBlock({
  collapsed,
  mobileOpen,
  isGradientHome,
  searchKey,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? ''
  const isWarRoom = isWarRoomCleanRoute(pathname)
  const { canAccess, loading } = usePermissions()

  const links = loading
    ? []
    : CAMPANHA_LINKS.filter((link) => canAccessPage(canAccess, link.pageKey))

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
          const href = hrefForAllowedHub(canAccess, link.pageKey, link.href)
          const active = isCampanhaLinkActive(link, pathname, searchKey)
          const iconClass = sidebarNavIconClass(active)
          return (
            <div key={link.id} className="group relative">
              <Link
                href={href}
                onClick={() => onNavigate(href)}
                aria-label={link.label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  sidebarNavItemClass(active),
                  sidebarItemIconOnlyClass(collapsed, mobileOpen),
                  iconOnly && 'justify-center px-1.5',
                )}
              >
                {isWarRoom ? (
                  <SidebarLucideIcon
                    icon={resolveSidebarLucideIcon(link.icon)}
                    className={iconClass}
                  />
                ) : (
                  <SidebarTablerIcon
                    icon={resolveSidebarTablerIcon(link.icon, false)}
                    className={iconClass}
                  />
                )}
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
