'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, ClipboardList, MapPin, MessageSquare, Radar, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  isSidebarQuickAccessActive,
  SIDEBAR_QUICK_ACCESS_ITEMS,
  type SidebarQuickAccessItem,
} from '@/lib/sidebar-quick-access'
import {
  sidebarNavIconClass,
  sidebarNavItemClass,
  sidebarSectionLabelClass,
} from '@/lib/premium-ui-classes'
import { sidebarItemIconOnlyClass } from '@/lib/sidebar-layout'
import { sidebarApifyDividerClass, sidebarApifyTooltipClass } from '@/lib/sidebar-apify-styles'
import { JARVIS_SIDEBAR_DIVIDER, JARVIS_SIDEBAR_SECTION } from '@/lib/jarvis-sidebar-styles'
import { usePermissions } from '@/hooks/use-permissions'

const ICON_MAP: Record<SidebarQuickAccessItem['icon'], LucideIcon> = {
  Radar,
  ClipboardList,
  MapPin,
  BarChart3,
  MessageSquare,
}

type Props = {
  collapsed: boolean
  mobileOpen: boolean
  isGradientHome: boolean
  searchKey: string
  onNavigate: (href: string) => void
}

export function SidebarQuickAccess({
  collapsed,
  mobileOpen,
  isGradientHome,
  searchKey,
  onNavigate,
}: Props) {
  const pathname = usePathname() ?? ''
  const { canAccess, loading } = usePermissions()

  const items = loading
    ? SIDEBAR_QUICK_ACCESS_ITEMS
    : SIDEBAR_QUICK_ACCESS_ITEMS.filter((item) => {
        if (item.id === 'quick-base-eleitoral') {
          return canAccess('territorio') || canAccess('campo') || canAccess('agenda')
        }
        return canAccess(item.pageKey)
      })

  if (items.length === 0) return null

  const iconOnly = collapsed && !mobileOpen

  return (
    <div
      className={cn(
        'border-b border-[rgb(var(--color-border-secondary)/0.35)]',
        iconOnly ? 'px-1.5 py-1' : 'px-2.5 pb-2 pt-1',
      )}
    >
      {!iconOnly ? (
        <div className="mb-1 px-0.5">
          <span className={cn(sidebarSectionLabelClass, isGradientHome && JARVIS_SIDEBAR_SECTION)}>
            Acesso rápido
          </span>
        </div>
      ) : (
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
      )}

      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon]
          const active = isSidebarQuickAccessActive(item, pathname, searchKey)

          return (
            <li key={item.id} className="group relative">
              <Link
                href={item.href}
                onClick={() => onNavigate(item.href)}
                title={iconOnly ? item.label : undefined}
                className={cn(
                  sidebarNavItemClass(active),
                  sidebarItemIconOnlyClass(collapsed, mobileOpen),
                  iconOnly && 'justify-center px-1.5',
                )}
              >
                <Icon className={sidebarNavIconClass(active)} strokeWidth={1.5} aria-hidden />
                {!iconOnly ? <span className="truncate">{item.label}</span> : null}
              </Link>
              {iconOnly ? (
                <span
                  className={cn(
                    sidebarApifyTooltipClass,
                    'pointer-events-none absolute left-full top-1/2 z-[200] ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100',
                  )}
                  role="tooltip"
                >
                  {item.label}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
