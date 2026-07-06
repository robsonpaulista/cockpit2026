'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import {
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquare,
  Newspaper,
  MapPin,
  MapPinned,
  Users,
  UsersRound,
  MessageCircle,
  BarChart3,
  BarChart2,
  Settings,
  Scale,
  Menu,
  X,
  ChevronLeft,
  Vote,
  BadgeCheck,
  Building2,
  Shield,
  Search,
  Monitor,
  ScrollText,
  Target,
  ChevronDown,
  ClipboardList,
  History,
  Radar,
  Megaphone,
  AtSign,
  ShieldCheck,
  UserCog,
  Landmark,
  FileBadge2,
  LineChart,
  Image,
  FileSpreadsheet,
  Activity,
  Youtube,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuItem } from '@/types'
import { useSidebar } from '@/contexts/sidebar-context'
import { useIdleSplash } from '@/contexts/idle-splash-context'
import { useNavigationLoading } from '@/contexts/navigation-loading-context'
import { usePermissions } from '@/hooks/use-permissions'
import { UserMenu } from '@/components/user-menu'
import {
  COCKPIT_PAGE_ACTIVE_CHILD_PILL,
  COCKPIT_PAGE_ACTIVE_MENU_ITEM,
} from '@/lib/sidebar-menu-active-style'
import {
  sidebarChildItemClass,
  sidebarNavIconClass,
  sidebarNavItemClass,
  sidebarSectionLabelClass,
} from '@/lib/premium-ui-classes'
import { AppBrandHeader, SidebarBrandMark } from '@/components/app-brand-title'
import { SidebarQuickAccess } from '@/components/sidebar/sidebar-quick-access'
import { SIDEBAR_MENU_ITEMS, type SidebarMenuItemConfig } from '@/lib/sidebar-nav-routes'
import {
  TERRITORIO_CAMPO_TAB_PANORAMA,
  territorioCampoHref,
} from '@/lib/territorio-campo-route'
import { isSidebarMenuItemHidden, isSidebarChildMenuItemHidden } from '@/lib/sidebar-hidden-items'
import {
  SIDEBAR_WIDTH_COLLAPSED_CLASS,
  SIDEBAR_WIDTH_EXPANDED_CLASS,
  sidebarItemIconOnlyClass,
  sidebarShellFooterClass,
  sidebarShellHeaderClass,
  sidebarShellNavClass,
} from '@/lib/sidebar-layout'
import { useDashboardFixedChromeActive } from '@/contexts/dashboard-page-chrome-context'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import {
  JARVIS_SIDEBAR_ACTIVE_CHILD,
  JARVIS_SIDEBAR_ACTIVE_ITEM,
  JARVIS_SIDEBAR_DIVIDER,
  JARVIS_SIDEBAR_FOCUS,
  JARVIS_SIDEBAR_HOVER,
  JARVIS_SIDEBAR_ICON,
  JARVIS_SIDEBAR_ICON_ACTIVE,
  JARVIS_SIDEBAR_IDLE_ITEM,
  JARVIS_SIDEBAR_SECTION,
  JARVIS_SIDEBAR_SUBMENU_LINK,
  JARVIS_SIDEBAR_TEXT,
  JARVIS_SIDEBAR_TEXT_ACTIVE,
} from '@/lib/jarvis-sidebar-styles'

import {
  dashboardPageHeaderZoneSidebarClass,
  dashboardSubnavStripSidebarClass,
  dashboardSubnavStripSidebarInnerClass,
  dashboardSidebarCollapsedPageHeaderSpacerClassFor,
  dashboardSidebarCollapsedSubnavSpacerClass,
  dashboardSidebarCollapsedTopbarZoneClass,
} from '@/lib/dashboard-chrome-layout'
import { COCKPIT_MENU_LABEL } from '@/lib/sidebar-cockpit-labels'
import {
  SIDEBAR_APIFY_SHELL_CLASS,
  sidebarApifyDividerClass,
  sidebarApifyFooterActionClass,
  sidebarApifyIconButtonClass,
  sidebarApifyMobileToggleClass,
  sidebarApifySearchInputClass,
  sidebarApifySearchKbdClass,
  sidebarApifyTooltipClass,
} from '@/lib/sidebar-apify-styles'

interface SidebarMenuItem extends SidebarMenuItemConfig {}

const menuItems: SidebarMenuItem[] = SIDEBAR_MENU_ITEMS

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Calendar,
  FileText,
  MessageSquare,
  Newspaper,
  MapPin,
  Users,
  MessageCircle,
  BarChart3,
  Settings,
  Scale,
  Vote,
  Building2,
  Shield,
  Search,
  ScrollText,
  Target,
  ClipboardList,
  History,
  MapPinned,
  Image,
  AtSign,
  FileSpreadsheet,
  Activity,
  Youtube,
}

/** Ícones mais leves / mesma linguagem dos KPIs Cockpit (stroke fino + cor accent). */
const cockpitIconMap: Record<string, LucideIcon> = {
  ...iconMap,
  MapPin: MapPinned,
  Users: UsersRound,
  BarChart3: LineChart,
  MessageSquare: Megaphone,
  Newspaper: Radar,
  Vote: BadgeCheck,
  Scale: Landmark,
  Settings: UserCog,
  Shield: ShieldCheck,
  ClipboardList: FileBadge2,
  MessageCircle,
}

/** Início de seção para melhorar escaneabilidade da navegação. */
const SIDEBAR_SECTION_START_LABEL: Record<string, string> = {
  home: 'Painel',
  campo: 'Território',
  'mobilizacao-menu': 'Operação',
  juridico: 'Institucional',
  'gestao-pesquisas-menu': 'Administração',
}

/** Item ativo Cockpit / submenu pill: `@/lib/sidebar-menu-active-style`. */
const COCKPIT_PAGE_ACTIVE_ITEM = COCKPIT_PAGE_ACTIVE_MENU_ITEM

function resolveMenuIcon(iconName: string, cockpit: boolean): LucideIcon {
  const map = cockpit ? cockpitIconMap : iconMap
  return map[iconName] ?? iconMap[iconName] ?? LayoutDashboard
}

function pageKeyForItem(id: string): string {
  if (id === 'chapas-menu') return 'chapas'
  if (id === 'chapas-estaduais') return 'chapas'
  if (id === 'ficha-atendimento') return 'ficha-atendimento'
  if (
    id === 'mobilizacao-menu' ||
    id === 'mobilizacao-captacao' ||
    id === 'mobilizacao-config'
  ) {
    return 'mobilizacao'
  }
  if (
    id === 'gestao-pesquisas-menu' ||
    id === 'gestao-pesquisas-inicio' ||
    id === 'gestao-pesquisas-config'
  ) {
    return 'gestao_pesquisas'
  }
  if (
    id === 'resumo-eleicoes-menu' ||
    id === 'resumo-eleicoes-principal' ||
    id === 'resumo-eleicoes-historico' ||
    id === 'resumo-eleicoes-secao' ||
    id === 'resumo-eleicoes-chapa-federal' ||
    id === 'resumo-eleicoes-chapa-estadual'
  ) {
    return id === 'resumo-eleicoes-chapa-federal' || id === 'resumo-eleicoes-chapa-estadual'
      ? 'chapas'
      : 'resumo-eleicoes'
  }
  if (
    id === 'conteudo-menu' ||
    id === 'conteudo-hub' ||
    id === 'conteudo-obras' ||
    id === 'conteudo-agenda' ||
    id === 'conteudo-cards' ||
    id === 'conteudo-referencias' ||
    id === 'conteudo-analise' ||
    id === 'conteudo-redes'
  ) {
    return 'conteudo'
  }
  if (id === 'noticias-menu') {
    return 'noticias'
  }
  if (id === 'territorio-ipt') return 'territorio'
  return id === 'home' ? 'dashboard' : id
}

/** Ativa item filho; considera `?tab=` no hub Resumo Eleições. */
function isChildLinkActive(pathname: string, href: string, search: string): boolean {
  const [hrefPath, hrefQuery = ''] = href.split('?')
  if (pathname !== hrefPath) {
    if (hrefPath === '/dashboard/resumo-eleicoes') return false
    if (href === '/dashboard/conteudo') {
      return pathname === '/dashboard/conteudo' || pathname === '/dashboard/conteudo/'
    }
    return pathname.startsWith(`${href}/`)
  }

  const currentParams = new URLSearchParams(search)
  if (hrefQuery) {
    const hrefParams = new URLSearchParams(hrefQuery)
    for (const [key, value] of hrefParams.entries()) {
      if (currentParams.get(key) !== value) return false
    }
    return true
  }

  if (hrefPath === '/dashboard/resumo-eleicoes') {
    const tab = currentParams.get('tab')
    return !tab || tab === 'atendimento'
  }

  return true
}

interface SidebarNavItemProps {
  item: SidebarMenuItem
  sectionLabel: string | undefined
  Icon: LucideIcon
  hasSubmenu: boolean
  submenuOpen: boolean
  isActive: boolean
  pathname: string
  searchKey: string
  collapsed: boolean
  mobileOpen: boolean
  filmNav: boolean
  isGradientHome: boolean
  isCockpit: boolean
  cockpitActiveItemClass: string
  cockpitActiveChildClass: string
  setOpenSubmenuId: Dispatch<SetStateAction<string | null>>
  setNavigating: (loading: boolean) => void
  setMobileOpen: (open: boolean) => void
  menuLabel: (id: string, fallback: string) => string
}

/**
 * Linha de menu da Sidebar.
 *
 * Extraído para um subcomponente próprio porque cada item precisa do seu
 * próprio `useRef` (para medir o `<li>` e posicionar o tooltip) e do seu
 * próprio `useState` (posição do tooltip). Chamar hooks dentro de `.map()`
 * causaria a quantidade de hooks mudar entre renders (quando `visibleItems`
 * muda de tamanho), gerando o erro
 * "Rendered fewer hooks than expected".
 */
function SidebarNavItem({
  item,
  sectionLabel,
  Icon,
  hasSubmenu,
  submenuOpen,
  isActive,
  pathname,
  searchKey,
  collapsed,
  mobileOpen,
  filmNav,
  isGradientHome,
  isCockpit,
  cockpitActiveItemClass,
  cockpitActiveChildClass,
  setOpenSubmenuId,
  setNavigating,
  setMobileOpen,
  menuLabel,
}: SidebarNavItemProps) {
  const router = useRouter()
  const itemRef = useRef<HTMLLIElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number } | null>(null)

  const handleMouseEnter = () => {
    if (itemRef.current && collapsed && !mobileOpen) {
      const rect = itemRef.current.getBoundingClientRect()
      setTooltipPos({ top: rect.top + rect.height / 2 })
    }
  }

  const handleMouseLeave = () => {
    setTooltipPos(null)
  }

  return (
    <li
      className="relative group"
      ref={itemRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {sectionLabel && (!collapsed || mobileOpen) && (
        <div className={cn('mb-1 mt-4', item.id === 'home' && 'mt-1')}>
          <span className={cn(sidebarSectionLabelClass, isGradientHome && JARVIS_SIDEBAR_SECTION)}>
            {sectionLabel}
          </span>
        </div>
      )}
      {sectionLabel && collapsed && !mobileOpen && (
        <div className={cn('my-2', item.id === 'home' && 'mt-0')}>
          <span
            className={cn(
              'block',
              isGradientHome ? cn('mx-auto h-px w-6 rounded-full', JARVIS_SIDEBAR_DIVIDER) : sidebarApifyDividerClass
            )}
            aria-hidden
          />
        </div>
      )}

      {hasSubmenu ? (
        <>
          <button
            type="button"
            onClick={() =>
              setOpenSubmenuId((prev) => (prev === item.id ? null : item.id))
            }
            className={cn(
              filmNav
                ? cn(
                    'relative flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5',
                    sidebarItemIconOnlyClass(collapsed, mobileOpen),
                    'transition-all duration-200 ease-out',
                    isGradientHome ? JARVIS_SIDEBAR_FOCUS : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
                    !(filmNav && isActive) &&
                      (isGradientHome
                        ? JARVIS_SIDEBAR_HOVER
                        : 'hover:bg-accent-gold-soft/70 hover:text-text-primary'),
                    isActive && !filmNav && 'bg-accent-gold-soft text-text-primary shadow-sm',
                    !isActive &&
                      (isGradientHome
                        ? JARVIS_SIDEBAR_IDLE_ITEM
                        : 'border border-white/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)]'),
                    isActive && cockpitActiveItemClass
                  )
                : cn(sidebarNavItemClass(isActive), sidebarItemIconOnlyClass(collapsed, mobileOpen))
            )}
          >
            <Icon
              className={cn(
                filmNav
                  ? cn(
                      'h-4 w-4 shrink-0',
                      isActive
                        ? isGradientHome
                          ? JARVIS_SIDEBAR_ICON_ACTIVE
                          : '!text-white'
                        : isGradientHome
                          ? JARVIS_SIDEBAR_ICON
                          : ''
                    )
                  : sidebarNavIconClass(isActive)
              )}
              strokeWidth={filmNav ? 1.35 : 1.5}
            />
            {(!collapsed || mobileOpen) && (
              <>
                <span className={cn(
                  filmNav
                    ? cn(
                        'text-[0.95rem] font-medium leading-none tracking-[0.01em] transition-all duration-200',
                        'group-hover:translate-x-0.5',
                        isActive
                          ? cn(
                              'font-semibold text-text-primary',
                              filmNav && (isGradientHome ? JARVIS_SIDEBAR_TEXT_ACTIVE : '!text-white')
                            )
                          : isGradientHome
                            ? JARVIS_SIDEBAR_TEXT
                            : isCockpit
                              ? 'text-text-primary/90 group-hover:text-text-primary'
                              : 'text-text-secondary group-hover:text-text-primary'
                      )
                    : 'flex-1 truncate text-left'
                )}>
                  {menuLabel(item.id, item.label)}
                </span>
                <ChevronDown
                  className={cn(
                  'ml-auto h-4 w-4 text-text-secondary/85 transition-transform',
                    submenuOpen && 'rotate-180',
                    isGradientHome && 'text-[rgba(148,195,220,0.55)]',
                    filmNav && isActive && (isGradientHome ? JARVIS_SIDEBAR_ICON_ACTIVE : '!text-white/90')
                  )}
                  strokeWidth={filmNav ? 1.35 : 2}
                />
              </>
            )}
          </button>

          {(!collapsed || mobileOpen) && submenuOpen && item.children && (
            filmNav ? (
              <ul className="mt-1 space-y-1">
                {item.children.map((child) => {
                  const childActive = isChildLinkActive(pathname, child.href, searchKey)
                  return (
                    <li key={child.id}>
                      <Link
                        href={child.href}
                        onClick={() => {
                          if (child.href !== pathname) setNavigating(true)
                          setMobileOpen(false)
                        }}
                        className={cn(
                          'flex w-full min-w-0 items-center rounded-[12px] px-2.5 py-[7px] text-[0.82rem] font-medium leading-none transition-all duration-200',
                          isGradientHome
                            ? JARVIS_SIDEBAR_FOCUS
                            : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
                          childActive
                            ? cn('truncate font-semibold transition-all', cockpitActiveChildClass)
                            : cn(
                                'truncate',
                                isGradientHome
                                  ? JARVIS_SIDEBAR_SUBMENU_LINK
                                  : 'text-text-primary/85 hover:bg-white/10 hover:text-text-primary'
                              )
                        )}
                      >
                        {menuLabel(child.id, child.label)}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {item.children.map((child) => {
                  const childActive = isChildLinkActive(pathname, child.href, searchKey)
                  return (
                    <li key={child.id}>
                      <Link
                        href={child.href}
                        onClick={() => {
                          if (child.href !== pathname) setNavigating(true)
                          setMobileOpen(false)
                        }}
                        className={sidebarChildItemClass(childActive)}
                      >
                        {menuLabel(child.id, child.label)}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )
          )}
        </>
      ) : (
        <Link
          href={item.href}
          onClick={(e) => {
            if (item.id === 'territorio') {
              const panoramaHref = territorioCampoHref(TERRITORIO_CAMPO_TAB_PANORAMA)
              if (pathname.startsWith('/dashboard/territorio') && searchKey) {
                e.preventDefault()
                router.replace(panoramaHref)
              } else if (item.href !== pathname) {
                setNavigating(true)
              }
              setMobileOpen(false)
              return
            }
            if (item.href !== pathname) setNavigating(true)
            setMobileOpen(false)
          }}
          className={cn(
            filmNav
              ? cn(
                  'relative flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5',
                  sidebarItemIconOnlyClass(collapsed, mobileOpen),
                  'transition-all duration-200 ease-out',
                  isGradientHome ? JARVIS_SIDEBAR_FOCUS : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
                  !(filmNav && isActive) &&
                    (isGradientHome
                      ? JARVIS_SIDEBAR_HOVER
                      : 'hover:bg-accent-gold-soft/70 hover:text-text-primary'),
                  isActive && !filmNav && 'bg-accent-gold-soft text-text-primary shadow-sm',
                  !isActive &&
                    (isGradientHome
                      ? JARVIS_SIDEBAR_IDLE_ITEM
                      : 'border border-white/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)]'),
                  isActive && cockpitActiveItemClass
                )
              : cn(sidebarNavItemClass(isActive), sidebarItemIconOnlyClass(collapsed, mobileOpen))
          )}
        >
          <Icon
            className={cn(
              filmNav
                ? cn(
                    'h-4 w-4 shrink-0',
                    isActive
                      ? isGradientHome
                        ? JARVIS_SIDEBAR_ICON_ACTIVE
                        : '!text-white'
                      : isGradientHome
                        ? JARVIS_SIDEBAR_ICON
                        : ''
                  )
                : sidebarNavIconClass(isActive)
            )}
            strokeWidth={filmNav ? 1.35 : 1.5}
          />
          {(!collapsed || mobileOpen) && (
            <span className={cn(
              filmNav
                ? cn(
                    'text-[0.95rem] font-medium leading-none tracking-[0.01em] transition-all duration-200',
                    'group-hover:translate-x-0.5',
                    isActive
                      ? cn(
                          'font-semibold text-text-primary',
                          filmNav && (isGradientHome ? JARVIS_SIDEBAR_TEXT_ACTIVE : '!text-white')
                        )
                      : isGradientHome
                        ? JARVIS_SIDEBAR_TEXT
                        : isCockpit
                          ? 'text-text-primary/90 group-hover:text-text-primary'
                          : 'text-text-secondary group-hover:text-text-primary'
                  )
                : 'truncate'
            )}>
              {menuLabel(item.id, item.label)}
            </span>
          )}
          {item.badge && (!collapsed || mobileOpen) && (
            <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-status-danger text-white rounded-full transition-transform duration-200 group-hover:scale-110">
              {item.badge}
            </span>
          )}
        </Link>
      )}

      {/* Tooltip quando sidebar está recolhida - usando fixed para sair do overflow */}
      {collapsed && !mobileOpen && tooltipPos && (
        <div
          className={cn(
            filmNav
              ? cn(
                  'fixed left-24 z-[200] whitespace-nowrap rounded-xl px-3 py-2 text-[0.78rem] font-semibold shadow-lg backdrop-blur',
                  isGradientHome
                    ? 'border border-[rgba(0,212,255,0.25)] shadow-[0_0_16px_rgba(0,102,255,0.15)]'
                    : 'border border-white/10'
                )
              : sidebarApifyTooltipClass
          )}
          style={{
            top: `${tooltipPos.top}px`,
            transform: 'translateY(-50%)',
            animation: 'fadeIn 0.2s ease-out',
            ...(filmNav
              ? {
                  left: '6rem',
                  backgroundColor: isGradientHome ? '#051525' : 'rgba(19, 28, 35, 0.92)',
                  color: isGradientHome ? '#00D4FF' : 'rgba(255,255,255,0.95)',
                }
              : {
                  left: '4.75rem',
                }),
          }}
        >
          {menuLabel(item.id, item.label)}
          {filmNav ? (
            <div
              className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
              style={{
                borderRightColor: isGradientHome ? '#051525' : 'rgba(19, 28, 35, 0.92)',
              }}
            />
          ) : (
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-bg-surface" />
          )}
        </div>
      )}
    </li>
  )
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const { setNavigating } = useNavigationLoading()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchKey = searchParams.toString()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()
  const { ativo: idleSplashAtivo } = useIdleSplash()
  const asideRef = useRef<HTMLElement | null>(null)

  /** Na tela de descanso, manter sidebar colapsada (só ícones) e bloquear cliques. */
  const navCollapsed = collapsed
  const navMobileOpen = idleSplashAtivo ? false : mobileOpen
  const collapsedIconOnly = navCollapsed && !navMobileOpen
  const idleCollapsedChrome = idleSplashAtivo && collapsedIconOnly

  useEffect(() => {
    const el = asideRef.current
    if (!el) return
    if (idleSplashAtivo) {
      el.setAttribute('inert', '')
    } else {
      el.removeAttribute('inert')
    }
  }, [idleSplashAtivo])

  const isCockpit = false
  /** Shell lateral branco padrão — inclusive na home com gradiente âmbar. */
  const isGradientHome = false
  const hasFixedPageChrome = useDashboardFixedChromeActive()
  const topbarVisible = useDashboardTopbarVisible()
  const collapsedPageHeaderSpacerClass = dashboardSidebarCollapsedPageHeaderSpacerClassFor(topbarVisible)
  const filmNav = isCockpit

  const cockpitActiveItemClass = COCKPIT_PAGE_ACTIVE_ITEM
  const cockpitActiveChildClass = COCKPIT_PAGE_ACTIVE_CHILD_PILL

  const menuLabel = (id: string, fallback: string) =>
    isCockpit ? (COCKPIT_MENU_LABEL[id] ?? fallback) : fallback

  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)
  const [menuSearch, setMenuSearch] = useState('')

  useEffect(() => {
    if (pathname.startsWith('/dashboard/gestao-pesquisas')) {
      setOpenSubmenuId('gestao-pesquisas-menu')
    } else if (pathname.startsWith('/dashboard/chapas')) {
      setOpenSubmenuId('chapas-menu')
    } else if (pathname.startsWith('/dashboard/resumo-eleicoes')) {
      setOpenSubmenuId('resumo-eleicoes-menu')
    } else if (pathname.startsWith('/dashboard/mobilizacao')) {
      setOpenSubmenuId('mobilizacao-menu')
    } else if (pathname.startsWith('/dashboard/conteudo')) {
      setOpenSubmenuId('conteudo-menu')
    }
  }, [pathname])

  useEffect(() => {
    if (idleSplashAtivo && mobileOpen) {
      setMobileOpen(false)
    }
  }, [idleSplashAtivo, mobileOpen, setMobileOpen])

  const visibleItems = useMemo(() => {
    const base = permLoading
      ? menuItems
      : menuItems
          .map((item) => {
            if (!item.children) return item
            const children = item.children.filter(
              (child) =>
                canAccess(pageKeyForItem(child.id)) && !isSidebarChildMenuItemHidden(child.id),
            )
            return { ...item, children }
          })
          .filter((item) => {
            if (item.id === 'usuarios') return isAdmin
            if (item.id === 'log-system') return isAdmin
            if (item.id === 'ficha-atendimento') {
              return canAccess('ficha-atendimento') || canAccess('territorio')
            }
            if (item.id === 'territorio') {
              return canAccess('territorio') || canAccess('campo') || canAccess('agenda')
            }
            if (item.id === 'territorio-ipt') {
              return canAccess('territorio') || canAccess('campo') || canAccess('agenda')
            }
            if (item.id === 'resumo-operacional') {
              return (
                canAccess('resumo-operacional') ||
                canAccess('campo') ||
                canAccess('operacao') ||
                canAccess('mobilizacao') ||
                canAccess('conteudo')
              )
            }
            if (item.children) return item.children.length > 0
            return canAccess(pageKeyForItem(item.id))
          })

    return base.filter((item) => !isSidebarMenuItemHidden(item.id))
  }, [canAccess, isAdmin, permLoading])

  const filteredItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    if (!q) return visibleItems
    return visibleItems.filter((item) => {
      const label = menuLabel(item.id, item.label).toLowerCase()
      if (label.includes(q)) return true
      return item.children?.some((child) => menuLabel(child.id, child.label).toLowerCase().includes(q))
    })
  }, [visibleItems, menuSearch, menuLabel])

  const toggleCollapse = () => {
    setCollapsed(!collapsed)
  }

  const toggleMobile = () => {
    setMobileOpen(!mobileOpen)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        data-sidebar-shell
        data-sidebar-mobile-toggle={filmNav ? 'true' : undefined}
        onMouseDown={(e) => {
          if (idleSplashAtivo) e.stopPropagation()
        }}
        onClick={(e) => {
          if (idleSplashAtivo) {
            e.stopPropagation()
            return
          }
          toggleMobile()
        }}
        className={cn(
          'fixed left-4 top-4 z-[110] transition-premium lg:hidden',
          filmNav
            ? cn(
                'rounded-full p-2',
                isGradientHome
                  ? 'border border-[rgba(0,212,255,0.15)] bg-[#020B14] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                  : 'cockpit-glass border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.12)]'
              )
            : sidebarApifyMobileToggleClass
        )}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X
            className={cn(
              isGradientHome ? 'text-[#00D4FF]' : filmNav ? 'text-accent-gold' : 'text-text-secondary',
              filmNav ? 'h-4 w-4' : 'h-5 w-5'
            )}
            strokeWidth={filmNav ? 1.35 : 1.5}
          />
        ) : (
          <Menu
            className={cn(
              isGradientHome ? 'text-[#00D4FF]' : filmNav ? 'text-accent-gold' : 'text-text-secondary',
              filmNav ? 'h-4 w-4' : 'h-5 w-5'
            )}
            strokeWidth={filmNav ? 1.35 : 1.5}
          />
        )}
      </button>

      {/* Sidebar */}
      <aside
        ref={asideRef}
        data-sidebar-shell
        className={cn(
          'fixed left-0 top-0 h-full overflow-visible transition-all duration-300 ease-out',
          SIDEBAR_WIDTH_EXPANDED_CLASS,
          isGradientHome && 'border-r border-[rgba(0,212,255,0.08)]',
          !isGradientHome && cn('border-r border-[rgb(var(--color-border-secondary)/0.45)]', SIDEBAR_APIFY_SHELL_CLASS),
          isCockpit && !isGradientHome && 'sidebar-cockpit-shell',
          idleSplashAtivo ? 'z-[100]' : 'max-lg:z-[100] max-lg:shadow-2xl lg:z-40',
          'max-lg:shadow-2xl',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? SIDEBAR_WIDTH_COLLAPSED_CLASS : undefined,
          idleSplashAtivo && 'cursor-not-allowed',
        )}
        style={{ isolation: 'isolate' }}
      >
        <div
          className={cn(
            'relative z-0 flex h-full min-h-0 flex-col bg-bg-surface',
          )}
        >
          {/* Logo (zona do título) + busca (faixa das abas) */}
          <div
            className={cn(
              filmNav
                ? sidebarShellHeaderClass(navCollapsed, navMobileOpen)
                : navCollapsed && !navMobileOpen
                  ? 'shrink-0'
                  : dashboardPageHeaderZoneSidebarClass,
              filmNav && !isGradientHome && 'border-b border-[rgb(var(--color-border-secondary)/0.35)]'
            )}
          >
            {(!navCollapsed || navMobileOpen) && (
              <div className="flex h-full min-h-0 w-full flex-col justify-center overflow-visible">
                <div className="flex w-full items-center justify-between gap-1.5">
                  <AppBrandHeader
                    isCockpit={isCockpit}
                    lightOnGradient={isGradientHome}
                    variant={filmNav ? 'page' : 'sidebar'}
                    className="min-w-0 w-full flex-1"
                  />
                  {!collapsed && (
                    <button
                      onClick={toggleCollapse}
                      className={cn(
                        'hidden lg:flex shrink-0',
                        isGradientHome
                          ? cn('h-8 w-8 items-center justify-center rounded-lg', JARVIS_SIDEBAR_HOVER, JARVIS_SIDEBAR_FOCUS)
                          : sidebarApifyIconButtonClass
                      )}
                      aria-label="Toggle sidebar"
                    >
                      <ChevronLeft
                        className={cn('h-4 w-4', isGradientHome ? 'text-[#00D4FF]' : 'text-text-primary')}
                        strokeWidth={filmNav ? 1.35 : 1.5}
                      />
                    </button>
                  )}
                </div>
              </div>
            )}
            {navCollapsed && !navMobileOpen && (
              filmNav ? (
                <div className="flex w-full flex-col items-center gap-2">
                  <button
                    onClick={toggleCollapse}
                    className={cn(
                      'hidden lg:flex',
                      isGradientHome
                        ? cn('h-8 w-8 items-center justify-center rounded-lg', JARVIS_SIDEBAR_HOVER, JARVIS_SIDEBAR_FOCUS)
                        : sidebarApifyIconButtonClass
                    )}
                    aria-label="Toggle sidebar"
                  >
                    <ChevronLeft
                      className={cn('h-4 w-4 rotate-180', isGradientHome ? 'text-[#00D4FF]' : 'text-text-primary')}
                      strokeWidth={filmNav ? 1.35 : 1.5}
                    />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className={cn(
                      dashboardSidebarCollapsedTopbarZoneClass,
                      !hasFixedPageChrome && 'flex-col justify-center gap-0.5 py-1',
                      idleCollapsedChrome && hasFixedPageChrome && 'flex-col justify-center gap-0.5 py-1',
                    )}
                  >
                    <SidebarBrandMark lightOnGradient={isGradientHome} />
                    {!hasFixedPageChrome || idleCollapsedChrome ? (
                      <button
                        onClick={toggleCollapse}
                        className={cn('hidden lg:flex', sidebarApifyIconButtonClass)}
                        aria-label="Expandir sidebar"
                      >
                        <ChevronLeft className="h-4 w-4 rotate-180" strokeWidth={1.5} />
                      </button>
                    ) : null}
                  </div>
                  {hasFixedPageChrome && !idleSplashAtivo ? (
                    <div
                      className={cn(
                        collapsedPageHeaderSpacerClass,
                        'flex items-center justify-center',
                      )}
                    >
                      <button
                        onClick={toggleCollapse}
                        className={cn('hidden lg:flex', sidebarApifyIconButtonClass)}
                        aria-label="Expandir sidebar"
                      >
                        <ChevronLeft className="h-4 w-4 rotate-180" strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : null}
                </>
              )
            )}
          </div>

          {navCollapsed && !navMobileOpen && !filmNav && hasFixedPageChrome && !idleSplashAtivo ? (
            <div className={dashboardSidebarCollapsedSubnavSpacerClass} aria-hidden />
          ) : null}

          {(!navCollapsed || navMobileOpen) && !filmNav ? (
            <div className={dashboardSubnavStripSidebarClass}>
              <div className={dashboardSubnavStripSidebarInnerClass}>
                <label className="relative block w-full">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Buscar no menu"
                    className={sidebarApifySearchInputClass}
                  />
                  <kbd className={sidebarApifySearchKbdClass} aria-hidden>
                    ⌘K
                  </kbd>
                </label>
              </div>
            </div>
          ) : null}

          <SidebarQuickAccess
            collapsed={navCollapsed}
            mobileOpen={navMobileOpen}
            isGradientHome={isGradientHome}
            searchKey={searchKey}
            onNavigate={(href) => {
              if (href !== pathname) setNavigating(true)
              setMobileOpen(false)
            }}
          />

          {/* Menu Items */}
          <nav className={cn('flex-1 overflow-x-visible overflow-y-auto scrollbar-hide', sidebarShellNavClass(navCollapsed, navMobileOpen))}>
            <ul className="space-y-0.5">
              {filteredItems.map((item: SidebarMenuItem) => {
                const juridicoInMenu = filteredItems.some((i) => i.id === 'juridico')
                const sectionLabel: string | undefined =
                  SIDEBAR_SECTION_START_LABEL[item.id] ??
                  (item.id === 'emendas' && !juridicoInMenu ? 'Institucional' : undefined)
                const Icon = resolveMenuIcon(item.icon, isCockpit)
                const hasSubmenu = Boolean(item.children?.length)
                const submenuOpen = openSubmenuId === item.id
                const isActive = hasSubmenu
                  ? Boolean(item.children?.some((c) => isChildLinkActive(pathname, c.href, searchKey)))
                  : item.id === 'ficha-atendimento'
                      ? pathname.startsWith('/dashboard/ficha-atendimento')
                      : item.id === 'territorio-ipt'
                        ? pathname.startsWith('/dashboard/territorio/ipt')
                      : item.id === 'noticias-menu'
                        ? pathname.startsWith('/dashboard/noticias')
                        : pathname === item.href

                return (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    sectionLabel={sectionLabel}
                    Icon={Icon}
                    hasSubmenu={hasSubmenu}
                    submenuOpen={submenuOpen}
                    isActive={isActive}
                    pathname={pathname}
                    searchKey={searchKey}
                    collapsed={navCollapsed}
                    mobileOpen={navMobileOpen}
                    filmNav={filmNav}
                    isGradientHome={isGradientHome}
                    isCockpit={isCockpit}
                    cockpitActiveItemClass={cockpitActiveItemClass}
                    cockpitActiveChildClass={cockpitActiveChildClass}
                    setOpenSubmenuId={setOpenSubmenuId}
                    setNavigating={setNavigating}
                    setMobileOpen={setMobileOpen}
                    menuLabel={menuLabel}
                  />
                )
              })}
            </ul>
          </nav>

          {/* Ações rápidas: tela de descanso */}
          <div
            className={cn(
              'space-y-0.5 border-t',
              sidebarShellFooterClass(navCollapsed, navMobileOpen),
              isGradientHome ? 'border-[rgba(0,212,255,0.08)]' : 'border-[rgb(var(--color-border-secondary)/0.35)]'
            )}
          >
            <UserMenu
              variant="sidebar"
              collapsed={navCollapsed && !navMobileOpen}
              className={sidebarItemIconOnlyClass(navCollapsed, navMobileOpen)}
            />
            <button
              onClick={() => {
                window.dispatchEvent(new Event('activateSplash'))
                setMobileOpen(false)
              }}
              className={cn(
                sidebarItemIconOnlyClass(navCollapsed, navMobileOpen),
                isGradientHome
                  ? cn(
                      'flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 transition-all duration-200 ease-out group',
                      JARVIS_SIDEBAR_HOVER,
                      JARVIS_SIDEBAR_FOCUS
                    )
                  : cn(sidebarApifyFooterActionClass, 'group')
              )}
              title="Ativar tela de descanso"
            >
              <Monitor
                  className={cn(
                  'flex-shrink-0 transition-colors',
                  isGradientHome
                    ? cn(JARVIS_SIDEBAR_ICON, 'group-hover:!text-[#00D4FF]')
                    : 'h-4 w-4 text-text-primary',
                  filmNav && !isGradientHome && 'h-4 w-4 text-text-secondary group-hover:text-accent-gold'
                )}
                strokeWidth={filmNav ? 1.35 : 1.5}
              />
              {(!navCollapsed || navMobileOpen) && (
                <span
                  className={cn(
                    isGradientHome
                      ? cn('text-[0.92rem] font-medium transition-colors', JARVIS_SIDEBAR_TEXT)
                      : 'text-[13px] font-medium text-text-primary'
                  )}
                >
                  Tela de descanso
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && !idleSplashAtivo && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}

