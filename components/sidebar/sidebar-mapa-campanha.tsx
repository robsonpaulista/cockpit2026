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

const MAPA_CAMPANHA_HREF = '/dashboard/territorio/ipt'
const MAPA_CAMPANHA_LABEL = 'Diagnóstico Operacional'

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  isGradientHome: boolean
  onNavigate: (href: string) => void
}

/** Bloco exclusivo do Mapa Campanha, acima de Acesso rápido. */
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
    canAccess('territorio') ||
    canAccess('campo') ||
    canAccess('agenda')
  if (!allowed) return null

  const active = pathname.startsWith(MAPA_CAMPANHA_HREF)
  const iconOnly = collapsed && !mobileOpen
  const Icon = resolveSidebarTablerIcon('MapPin', false)

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

      <div className="group relative">
        <Link
          href={MAPA_CAMPANHA_HREF}
          onClick={() => onNavigate(MAPA_CAMPANHA_HREF)}
          title={iconOnly ? MAPA_CAMPANHA_LABEL : undefined}
          aria-label={MAPA_CAMPANHA_LABEL}
          className={cn(
            sidebarNavItemClass(active),
            sidebarItemIconOnlyClass(collapsed, mobileOpen),
            iconOnly && 'justify-center px-1.5',
          )}
        >
          <SidebarTablerIcon icon={Icon} className={sidebarNavIconClass(active)} />
          {!iconOnly ? (
            <span className="truncate text-[13px] leading-[17px] font-medium">{MAPA_CAMPANHA_LABEL}</span>
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
            {MAPA_CAMPANHA_LABEL}
          </span>
        ) : null}
      </div>
    </div>
  )
}
