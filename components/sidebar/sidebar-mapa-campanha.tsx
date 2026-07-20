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

const CAMPANHA_LINKS = [
  {
    href: '/dashboard/territorio/ipt',
    label: 'Diagnóstico Operacional',
    icon: 'MapPin' as const,
  },
  {
    href: '/dashboard/fluxo-digital',
    label: 'Fluxo Digital',
    icon: 'Target' as const,
  },
]

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  isGradientHome: boolean
  onNavigate: (href: string) => void
}

/** Bloco exclusivo Diagnóstico + Fluxo Digital, acima de Acesso rápido. */
export function SidebarMapaCampanhaBlock({
  collapsed,
  mobileOpen,
  isGradientHome,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? ''
  const { canAccess, loading } = usePermissions()

  const allowed =
    loading ||
    canAccess('ipt') ||
    canAccess('fluxo-digital') ||
    canAccess('cobertura') ||
    canAccess('territorio') ||
    canAccess('campo') ||
    canAccess('agenda') ||
    canAccess('conteudo')
  if (!allowed) return null

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
        {CAMPANHA_LINKS.map((link) => {
          const active = pathname.startsWith(link.href)
          const Icon = resolveSidebarTablerIcon(link.icon, false)
          return (
            <div key={link.href} className="group relative">
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
