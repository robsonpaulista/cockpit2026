'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
  Trophy,
  Image,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuItem } from '@/types'
import { useSidebar } from '@/contexts/sidebar-context'
import { useNavigationLoading } from '@/contexts/navigation-loading-context'
import { usePermissions } from '@/hooks/use-permissions'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { useTheme } from '@/contexts/theme-context'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import {
  COCKPIT_PAGE_ACTIVE_CHILD_PILL,
  COCKPIT_PAGE_ACTIVE_MENU_ITEM,
} from '@/lib/sidebar-menu-active-style'

/** Rótulos mais curtos no tema Cockpit Vivo (navegação minimalista). */
const COCKPIT_MENU_LABEL: Record<string, string> = {
  home: 'Visão',
  narrativas: 'Estratégia',
  campo: 'Campo',
  agenda: 'Agenda',
  territorio: 'Território',
  'territorio-mapa-tds': 'Mapa TDs',
  'chapas-menu': 'Chapas',
  'resumo-eleicoes-menu': 'Eleições',
  conteudo: 'Presença',
  'conteudo-menu': 'Presença',
  'conteudo-hub': 'Visão',
  'conteudo-obras': 'Obras',
  'conteudo-agenda': 'Agenda',
  'conteudo-cards': 'Cards',
  'conteudo-referencias': 'Referências',
  'conteudo-analise': 'Análise',
  'conteudo-redes': 'Instagram',
  noticias: 'Radar',
  'mobilizacao-menu': 'Mobilização',
  'mobilizacao-captacao': 'Captação',
  'mobilizacao-config': 'Config',
  whatsapp: 'WhatsApp',
  pesquisa: 'Pesquisa',
  operacao: 'Operação',
  juridico: 'Jurídico',
  obras: 'Obras',
  proposicoes: 'Proposições',
  'sei-pesquisa': 'SEI',
  'gestao-pesquisas-menu': 'Gestão pesq.',
  usuarios: 'Usuários',
  chapas: 'Federal',
  'chapas-estaduais': 'Estadual',
  'resumo-eleicoes-principal': 'Por cidade',
  'resumo-eleicoes-historico': 'Hist. federal',
  'gestao-pesquisas-inicio': 'Início',
  'gestao-pesquisas-config': 'Config',
}

interface SidebarMenuItem extends MenuItem {
  children?: MenuItem[]
}

const menuItems: SidebarMenuItem[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/dashboard' },
  { id: 'narrativas', label: 'Estratégia', icon: 'Target', href: '/dashboard/narrativas' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/dashboard/campo' },
  { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/dashboard/agenda' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/dashboard/territorio' },
  {
    id: 'territorio-mapa-tds',
    label: 'Mapa dos TDs',
    icon: 'MapPinned',
    href: '/dashboard/territorio/mapa-tds',
  },
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
    ],
  },
  {
    id: 'conteudo-menu',
    label: 'Presença & Conteúdo',
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
      { id: 'mobilizacao-config', label: 'Config', icon: 'Settings', href: '/dashboard/mobilizacao/config' },
    ],
  },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', href: '/dashboard/whatsapp' },
  { id: 'pesquisa', label: 'Pesquisa & Relato', icon: 'BarChart3', href: '/dashboard/pesquisa' },
  { id: 'operacao', label: 'Operação & Equipe', icon: 'Settings', href: '/dashboard/operacao' },
  { id: 'juridico', label: 'Jurídico', icon: 'Scale', href: '/dashboard/juridico' },
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
  Trophy,
  Image,
}

/** Ícones mais leves / mesma linguagem dos KPIs Cockpit (stroke fino + cor accent). */
const cockpitIconMap: Record<string, LucideIcon> = {
  ...iconMap,
  MapPin: MapPinned,
  Users: UsersRound,
  BarChart3: BarChart2,
  Vote: BadgeCheck,
}

const MENU_PIPE = (
  <span className="shrink-0 select-none px-2 text-border-card/80" aria-hidden>
    |
  </span>
)

/** Item ativo Cockpit / submenu pill: `@/lib/sidebar-menu-active-style`. */
const COCKPIT_PAGE_ACTIVE_ITEM = COCKPIT_PAGE_ACTIVE_MENU_ITEM

function resolveMenuIcon(iconName: string, cockpit: boolean): LucideIcon {
  const map = cockpit ? cockpitIconMap : iconMap
  return map[iconName] ?? iconMap[iconName] ?? LayoutDashboard
}

function pageKeyForItem(id: string): string {
  if (id === 'chapas-menu') return 'chapas'
  if (id === 'chapas-estaduais') return 'chapas'
  if (id === 'territorio-mapa-tds') return 'territorio'
  if (id === 'mobilizacao-menu' || id === 'mobilizacao-captacao' || id === 'mobilizacao-config') {
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
    id === 'resumo-eleicoes-historico'
  ) {
    return 'resumo-eleicoes'
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
  return id === 'home' ? 'dashboard' : id
}

/** Ativa item filho; evita que `/resumo-eleicoes/historico` marque o link só `/resumo-eleicoes`. */
function isChildLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  if (href === '/dashboard/resumo-eleicoes') return false
  if (href === '/dashboard/conteudo') {
    return pathname === '/dashboard/conteudo' || pathname === '/dashboard/conteudo/'
  }
  return pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const { setNavigating } = useNavigationLoading()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()
  const { theme } = useTheme()

  const isCockpit = theme === 'cockpit'
  const showTopbar = useDashboardTopbarVisible()

  const cockpitActiveItemClass = COCKPIT_PAGE_ACTIVE_ITEM
  const cockpitActiveChildClass = COCKPIT_PAGE_ACTIVE_CHILD_PILL

  const menuLabel = (id: string, fallback: string) =>
    isCockpit ? (COCKPIT_MENU_LABEL[id] ?? fallback) : fallback

  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null)

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

  const visibleItems = permLoading
    ? menuItems
    : menuItems
        .map((item) => {
          if (!item.children) return item
          const children = item.children.filter((child) => canAccess(pageKeyForItem(child.id)))
          return { ...item, children }
        })
        .filter((item) => {
          if (item.id === 'home') return true
          if (item.id === 'usuarios') return isAdmin
          if (item.id === 'territorio-mapa-tds') {
            return canAccess('territorio') || canAccess('conteudo')
          }
          if (item.children) return item.children.length > 0
          return canAccess(pageKeyForItem(item.id))
        })

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
        data-sidebar-mobile-toggle={isCockpit ? 'true' : undefined}
        onClick={toggleMobile}
        className={cn(
          'fixed left-4 top-4 z-[110] rounded-full p-2 transition-premium lg:hidden',
          isCockpit
            ? 'cockpit-glass shadow-[0_4px_20px_rgba(15,70,120,0.08)]'
            : 'rounded-lg border border-border-card bg-bg-surface shadow-card hover:shadow-card-hover'
        )}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X
            className={cn('text-accent-gold', isCockpit ? 'h-4 w-4' : 'h-5 w-5')}
            strokeWidth={isCockpit ? 1.35 : 2}
          />
        ) : (
          <Menu
            className={cn('text-accent-gold', isCockpit ? 'h-4 w-4' : 'h-5 w-5')}
            strokeWidth={isCockpit ? 1.35 : 2}
          />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 overflow-visible transition-all duration-300 ease-out',
          'border-r border-card bg-[rgb(var(--bg-sidebar))]',
          isCockpit && 'sidebar-cockpit-shell',
          'max-lg:z-[100] max-lg:shadow-2xl lg:z-40',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64'
        )}
        style={{ isolation: 'isolate' }}
      >
        <div
          className={cn(
            'flex h-full min-h-0 flex-col bg-[rgb(var(--bg-sidebar))]',
            isCockpit && 'bg-transparent',
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm',
                    isCockpit
                      ? 'bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8]'
                      : 'bg-accent-gold',
                  )}
                >
                  <span>C</span>
                </div>
                <span
                  className="text-sm font-semibold text-text-primary"
                >
                  Cockpit 2026
                </span>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent-gold-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft
                  className="w-4 h-4 text-accent-gold"
                  strokeWidth={isCockpit ? 1.35 : 2}
                />
              </button>
            )}
            {collapsed && !mobileOpen && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent-gold-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft
                  className="w-4 h-4 text-accent-gold rotate-180"
                  strokeWidth={isCockpit ? 1.35 : 2}
                />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav
            className="flex-1 overflow-x-visible overflow-y-auto px-2 py-4 scrollbar-hide"
          >
            <ul className="space-y-1">
              {visibleItems.map((item: SidebarMenuItem) => {
                const Icon = resolveMenuIcon(item.icon, isCockpit)
                const hasSubmenu = Boolean(item.children?.length)
                const submenuOpen = openSubmenuId === item.id
                const isActive = hasSubmenu
                  ? Boolean(item.children?.some((c) => isChildLinkActive(pathname, c.href)))
                  : item.id === 'territorio-mapa-tds'
                    ? pathname.startsWith('/dashboard/territorio/mapa-tds')
                    : pathname === item.href
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
                  <li key={item.id} className="relative group" ref={itemRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    {hasSubmenu ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSubmenuId((prev) => (prev === item.id ? null : item.id))
                          }
                          className={cn(
                            'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px]',
                            'transition-all duration-200 ease-out',
                            !(isCockpit && isActive) && 'hover:bg-accent-gold-soft hover:text-text-primary',
                            isActive && !isCockpit && 'bg-accent-gold-soft text-text-primary shadow-sm',
                            isCockpit && isActive && cockpitActiveItemClass
                          )}
                        >
                          {isActive && !isCockpit && (
                            <div
                              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-gold"
                              aria-hidden
                            />
                          )}
                          <div
                            className={cn(
                              'flex-shrink-0 transition-all duration-200',
                              !isCockpit && 'w-5 h-5 group-hover:scale-110',
                              isCockpit && 'flex items-center justify-center',
                              isActive
                                ? cn(
                                    'text-accent-gold',
                                    isCockpit && '!text-white'
                                  )
                                : 'text-text-secondary group-hover:text-accent-gold'
                            )}
                          >
                            <Icon
                              className={cn(
                                isCockpit ? 'h-4 w-4' : 'h-full w-full',
                                isCockpit && isActive && '!text-white'
                              )}
                              strokeWidth={isCockpit ? 1.35 : 2}
                            />
                          </div>
                          {(!collapsed || mobileOpen) && (
                            <>
                              <span className={cn(
                                'text-sm transition-all duration-200',
                                'group-hover:translate-x-0.5',
                                isActive
                                  ? cn(
                                      'font-semibold text-text-primary',
                                      isCockpit && '!text-white'
                                    )
                                  : 'text-text-secondary group-hover:text-text-primary'
                              )}>
                                {menuLabel(item.id, item.label)}
                              </span>
                              <ChevronDown
                                className={cn(
                                  'ml-auto h-4 w-4 text-text-secondary transition-transform',
                                  submenuOpen && 'rotate-180',
                                  isCockpit && isActive && '!text-white/90'
                                )}
                                strokeWidth={isCockpit ? 1.35 : 2}
                              />
                            </>
                          )}
                        </button>

                        {(!collapsed || mobileOpen) && submenuOpen && item.children && (
                          isCockpit ? (
                            <div
                              className={cn(
                                'cockpit-glass mt-2 flex flex-wrap items-center px-3 py-2',
                                'rounded-full text-[11px] text-text-secondary',
                                'shadow-[0_4px_20px_rgba(15,70,120,0.08)] !border-0',
                              )}
                            >
                              {item.children.map((child, idx) => {
                                const childActive = isChildLinkActive(pathname, child.href)
                                return (
                                  <span key={child.id} className="inline-flex items-center">
                                    {idx > 0 ? MENU_PIPE : null}
                                    <Link
                                      href={child.href}
                                      onClick={() => {
                                        if (child.href !== pathname) setNavigating(true)
                                        setMobileOpen(false)
                                      }}
                                      className={cn(
                                        'whitespace-nowrap rounded-md transition-all duration-200',
                                        childActive
                                          ? cn(
                                              'px-0.5 py-0.5 font-semibold',
                                              isCockpit
                                                ? cn(
                                                    'rounded-lg px-2 py-1 transition-all',
                                                    cockpitActiveChildClass
                                                  )
                                                : 'text-[rgb(15,45,74)]'
                                            )
                                          : 'px-0.5 py-0.5 text-text-secondary transition-colors hover:text-text-primary'
                                      )}
                                    >
                                      {menuLabel(child.id, child.label)}
                                    </Link>
                                  </span>
                                )
                              })}
                            </div>
                          ) : (
                            <ul className="mt-1 ml-8 space-y-1">
                              {item.children.map((child) => {
                                const childActive = isChildLinkActive(pathname, child.href)
                                return (
                                  <li key={child.id}>
                                    <Link
                                      href={child.href}
                                      onClick={() => {
                                        if (child.href !== pathname) setNavigating(true)
                                        setMobileOpen(false)
                                      }}
                                      className={cn(
                                        'flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm transition-all',
                                        childActive
                                          ? 'bg-accent-gold-soft text-text-primary font-semibold'
                                          : 'text-text-secondary hover:bg-accent-gold-soft hover:text-text-primary'
                                      )}
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
                        onClick={() => {
                          if (item.href !== pathname) setNavigating(true)
                          setMobileOpen(false)
                        }}
                        className={cn(
                          'relative flex items-center gap-3 px-3 py-2.5 rounded-[10px]',
                          'transition-all duration-200 ease-out',
                          !(isCockpit && isActive) && 'hover:bg-accent-gold-soft hover:text-text-primary',
                          isActive && !isCockpit && 'bg-accent-gold-soft text-text-primary shadow-sm',
                          isCockpit && isActive && cockpitActiveItemClass
                        )}
                      >
                        {isActive && !isCockpit && (
                          <div
                            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-gold"
                            aria-hidden
                          />
                        )}

                        <div
                          className={cn(
                            'flex-shrink-0 transition-all duration-200',
                            !isCockpit && 'w-5 h-5 group-hover:scale-110',
                            isCockpit && 'flex items-center justify-center',
                            isActive
                              ? cn(
                                  'text-accent-gold',
                                  isCockpit && '!text-white'
                                )
                              : 'text-text-secondary group-hover:text-accent-gold'
                          )}
                        >
                          <Icon
                            className={cn(
                              isCockpit ? 'h-4 w-4' : 'h-full w-full',
                              isCockpit && isActive && '!text-white'
                            )}
                            strokeWidth={isCockpit ? 1.35 : 2}
                          />
                        </div>
                        {(!collapsed || mobileOpen) && (
                          <span className={cn(
                            'text-sm transition-all duration-200',
                            'group-hover:translate-x-0.5',
                            isActive
                              ? cn(
                                  'font-semibold text-text-primary',
                                  isCockpit && '!text-white'
                                )
                              : 'text-text-secondary group-hover:text-text-primary'
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
                        className="fixed left-24 z-[200] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold shadow-lg"
                        style={{
                          top: `${tooltipPos.top}px`,
                          transform: 'translateY(-50%)',
                          animation: 'fadeIn 0.2s ease-out',
                          backgroundColor: 'rgb(var(--text-primary))',
                          color: 'rgb(var(--bg-surface))',
                        }}
                      >
                        {menuLabel(item.id, item.label)}
                        <div
                          className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                          style={{ borderRightColor: 'rgb(var(--text-primary))' }}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Ações rápidas: Splash + Tema */}
          <div
            className="space-y-1 border-t border-border-card px-2 py-3"
          >
            <button
              onClick={() => {
                window.dispatchEvent(new Event('activateSplash'))
                setMobileOpen(false)
              }}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] w-full',
                'transition-all duration-200 ease-out group',
                'hover:bg-accent-gold-soft'
              )}
              title="Ativar tela de descanso"
            >
              <Monitor
                className={cn(
                  'flex-shrink-0 text-text-secondary group-hover:text-accent-gold transition-colors',
                  isCockpit ? 'h-4 w-4' : 'h-5 w-5'
                )}
                strokeWidth={isCockpit ? 1.35 : 2}
              />
              {(!collapsed || mobileOpen) && (
                <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                  Tela de descanso
                </span>
              )}
            </button>
            {!showTopbar ? (
              <div className="flex w-full min-w-0 justify-start px-1">
                <UserMenu />
              </div>
            ) : null}
            <ThemeToggle collapsed={collapsed} mobileOpen={mobileOpen} />
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}

