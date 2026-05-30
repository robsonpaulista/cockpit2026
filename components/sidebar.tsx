'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
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
import { AppBrandTitle } from '@/components/app-brand-title'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'

/** Rótulos mais curtos no tema Cockpit Vivo (navegação minimalista). */
const COCKPIT_MENU_LABEL: Record<string, string> = {
  home: 'Visão',
  narrativas: 'Estratégia',
  campo: 'Campo',
  agenda: 'Agenda',
  territorio: 'Território',
  'territorio-mapa-tds': 'Mapa TDs',
  'ficha-atendimento': 'Ficha',
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
  'mobilizacao-mapa-digital-ig': 'Mapa IG',
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
  emendas: 'Emendas',
}

interface SidebarMenuItem extends MenuItem {
  children?: MenuItem[]
}

const menuItems: SidebarMenuItem[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/dashboard' },
  { id: 'narrativas', label: 'Estratégia', icon: 'Target', href: '/dashboard/narrativas' },
  { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/dashboard/agenda' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/dashboard/campo' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/dashboard/territorio' },
  {
    id: 'territorio-mapa-tds',
    label: 'Mapa dos TDs',
    icon: 'MapPinned',
    href: '/dashboard/territorio/mapa-tds',
  },
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
  'conteudo-menu': 'Comunicação',
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
  if (id === 'territorio-mapa-tds') return 'territorio'
  if (id === 'ficha-atendimento') return 'ficha-atendimento'
  if (
    id === 'mobilizacao-menu' ||
    id === 'mobilizacao-captacao' ||
    id === 'mobilizacao-config' ||
    id === 'mobilizacao-mapa-digital-ig'
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
    id === 'resumo-eleicoes-secao'
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

interface SidebarNavItemProps {
  item: SidebarMenuItem
  sectionLabel: string | undefined
  Icon: LucideIcon
  hasSubmenu: boolean
  submenuOpen: boolean
  isActive: boolean
  pathname: string
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
        <div className={cn(
          'mb-1.5 mt-3 px-2',
          item.id === 'home' && 'mt-0'
        )}>
          <span className={cn(
            'text-[0.68rem] font-semibold uppercase tracking-[0.14em]',
            isGradientHome && 'text-white/45',
            !isGradientHome && isCockpit && 'text-text-muted/90',
            !isGradientHome && !isCockpit && 'text-text-muted'
          )}>
            {sectionLabel}
          </span>
        </div>
      )}
      {sectionLabel && collapsed && !mobileOpen && (
        <div className={cn(
          'my-2 flex justify-center',
          item.id === 'home' && 'mt-0'
        )}>
          <span
            className={cn(
              'h-[1px] w-8 rounded-full',
              isGradientHome ? 'bg-white/25' : 'bg-border-card/60'
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
              'relative w-full flex items-center gap-3 px-3 py-3 rounded-[12px]',
              'transition-all duration-200 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
              !(filmNav && isActive) &&
                (isGradientHome
                  ? 'hover:bg-white/10 hover:text-white'
                  : 'hover:bg-accent-gold-soft/70 hover:text-text-primary'),
              isActive && !filmNav && 'bg-accent-gold-soft text-text-primary shadow-sm',
              filmNav &&
                !isActive &&
                'border border-white/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)]',
              filmNav && isActive && cockpitActiveItemClass,
            )}
          >
            {isActive && !filmNav && (
              <div
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-gold"
                aria-hidden
              />
            )}
            <div
              className={cn(
                'flex-shrink-0 transition-all duration-200',
                !filmNav && 'w-5 h-5 group-hover:scale-110',
                filmNav &&
                  'flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.03)_100%)]',
                isActive
                  ? cn(
                      'text-accent-gold',
                      filmNav && '!border-white/25 !bg-white/10 !text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
                    )
                  : isGradientHome
                    ? 'text-white/75 group-hover:text-white'
                    : 'text-text-secondary group-hover:text-accent-gold'
              )}
            >
              <Icon
                className={cn(
                  filmNav ? 'h-4 w-4' : 'h-full w-full',
                  filmNav && isActive && '!text-white'
                )}
                strokeWidth={filmNav ? 1.35 : 2}
              />
            </div>
            {(!collapsed || mobileOpen) && (
              <>
                <span className={cn(
                  'text-[0.95rem] font-medium leading-none tracking-[0.01em] transition-all duration-200',
                  'group-hover:translate-x-0.5',
                  isActive
                    ? cn(
                        'font-semibold text-text-primary',
                        filmNav && '!text-white'
                      )
                    : isGradientHome
                      ? 'text-white/80 group-hover:text-white'
                      : isCockpit
                        ? 'text-text-primary/90 group-hover:text-text-primary'
                        : 'text-text-secondary group-hover:text-text-primary'
                )}>
                  {menuLabel(item.id, item.label)}
                </span>
                <ChevronDown
                  className={cn(
                  'ml-auto h-4 w-4 text-text-secondary/85 transition-transform',
                    submenuOpen && 'rotate-180',
                    isGradientHome && 'text-white/70',
                    filmNav && isActive && '!text-white/90'
                  )}
                  strokeWidth={filmNav ? 1.35 : 2}
                />
              </>
            )}
          </button>

          {(!collapsed || mobileOpen) && submenuOpen && item.children && (
            filmNav ? (
              <div
                className={cn(
                  'mt-2 space-y-1.5 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] p-2',
                  'text-[0.82rem] shadow-[0_8px_24px_rgba(0,0,0,0.22)]',
                  isGradientHome ? 'text-white/90' : 'text-text-primary/85',
                )}
              >
                {item.children.map((child) => {
                  const childActive = isChildLinkActive(pathname, child.href)
                  return (
                    <span key={child.id} className="inline-flex items-center">
                      <Link
                        href={child.href}
                        onClick={() => {
                          if (child.href !== pathname) setNavigating(true)
                          setMobileOpen(false)
                        }}
                        className={cn(
                          'w-full whitespace-nowrap rounded-lg px-2.5 py-2 leading-none transition-all duration-200',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
                          childActive
                            ? cn(
                                'font-semibold',
                                'transition-all',
                                cockpitActiveChildClass
                              )
                            : cn(
                                'hover:bg-white/10',
                                isGradientHome
                                  ? 'text-white/80 hover:text-white'
                                  : 'text-text-primary/85 hover:text-text-primary'
                              )
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
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
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
            'relative flex items-center gap-3 px-3 py-3 rounded-[12px]',
            'transition-all duration-200 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar',
            !(filmNav && isActive) &&
              (isGradientHome
                ? 'hover:bg-white/10 hover:text-white'
                : 'hover:bg-accent-gold-soft/70 hover:text-text-primary'),
            isActive && !filmNav && 'bg-accent-gold-soft text-text-primary shadow-sm',
            filmNav &&
              !isActive &&
              'border border-white/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0.01)_100%)]',
            filmNav && isActive && cockpitActiveItemClass
          )}
        >
          {isActive && !filmNav && (
            <div
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-accent-gold"
              aria-hidden
            />
          )}

          <div
            className={cn(
              'flex-shrink-0 transition-all duration-200',
              !filmNav && 'w-5 h-5 group-hover:scale-110',
              filmNav &&
                'flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.03)_100%)]',
              isActive
                ? cn(
                    'text-accent-gold',
                    filmNav && '!border-white/25 !bg-white/10 !text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
                  )
                : isGradientHome
                  ? 'text-white/75 group-hover:text-white'
                  : 'text-text-secondary group-hover:text-accent-gold'
            )}
          >
            <Icon
              className={cn(
                filmNav ? 'h-4 w-4' : 'h-full w-full',
                filmNav && isActive && '!text-white'
              )}
              strokeWidth={filmNav ? 1.35 : 2}
            />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className={cn(
              'text-[0.95rem] font-medium leading-none tracking-[0.01em] transition-all duration-200',
              'group-hover:translate-x-0.5',
              isActive
                ? cn(
                    'font-semibold text-text-primary',
                    filmNav && '!text-white'
                  )
                : isGradientHome
                  ? 'text-white/80 group-hover:text-white'
                  : isCockpit
                    ? 'text-text-primary/90 group-hover:text-text-primary'
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
          className="fixed left-24 z-[200] whitespace-nowrap rounded-xl border border-white/10 px-3 py-2 text-[0.78rem] font-semibold shadow-lg backdrop-blur"
          style={{
            top: `${tooltipPos.top}px`,
            transform: 'translateY(-50%)',
            animation: 'fadeIn 0.2s ease-out',
            backgroundColor: filmNav ? 'rgba(19, 28, 35, 0.92)' : 'rgb(var(--text-primary))',
            /* fundo escuro + text-primary no claro = texto ilegível; texto sempre claro no chip escuro */
            color: filmNav ? 'rgba(255,255,255,0.95)' : 'rgb(var(--bg-surface))',
          }}
        >
          {menuLabel(item.id, item.label)}
          <div
            className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
            style={{ borderRightColor: filmNav ? 'rgba(19, 28, 35, 0.92)' : 'rgb(var(--text-primary))' }}
          />
        </div>
      )}
    </li>
  )
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const { setNavigating } = useNavigationLoading()
  const pathname = usePathname()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()
  const { theme, appearance } = useTheme()

  const isCockpit = false
  const isGradientHome = useDashboardHomeChrome()
  const filmNav = isCockpit || isGradientHome
  const isRepublicanosPremium = theme === 'republicanos' && appearance === 'light'
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
          if (item.id === 'ficha-atendimento') {
            return canAccess('ficha-atendimento') || canAccess('territorio')
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
        data-sidebar-mobile-toggle={filmNav ? 'true' : undefined}
        onClick={toggleMobile}
        className={cn(
          'fixed left-4 top-4 z-[110] rounded-full p-2 transition-premium lg:hidden',
          filmNav
            ? 'cockpit-glass border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.12)]'
            : 'rounded-lg border border-border-card bg-bg-surface shadow-card hover:shadow-card-hover'
        )}
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X
            className={cn(
              isGradientHome ? 'text-white' : 'text-accent-gold',
              filmNav ? 'h-4 w-4' : 'h-5 w-5'
            )}
            strokeWidth={filmNav ? 1.35 : 2}
          />
        ) : (
          <Menu
            className={cn(
              isGradientHome ? 'text-white' : 'text-accent-gold',
              filmNav ? 'h-4 w-4' : 'h-5 w-5'
            )}
            strokeWidth={filmNav ? 1.35 : 2}
          />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-72 overflow-visible transition-all duration-300 ease-out',
          isGradientHome && 'border-r border-white/15 bg-transparent',
          !isGradientHome && 'border-r border-card bg-[rgb(var(--bg-sidebar))]',
          isCockpit && !isGradientHome && 'sidebar-cockpit-shell',
          isRepublicanosPremium && !isGradientHome && 'republicanos-premium-sidebar',
          'max-lg:z-[100] max-lg:shadow-2xl lg:z-40',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-[5.5rem]' : 'lg:w-72'
        )}
        style={{ isolation: 'isolate' }}
      >
        <div
          className={cn(
            'flex h-full min-h-0 flex-col',
            filmNav ? 'bg-transparent' : 'bg-[rgb(var(--bg-sidebar))]',
          )}
        >
          {/* Logo */}
          <div className="flex h-16 items-center justify-between px-4">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2.5">
                <AppBrandTitle
                  isCockpit={isCockpit}
                  lightOnGradient={isGradientHome}
                />
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleCollapse}
                className={cn(
                  'hidden h-8 w-8 items-center justify-center rounded-lg transition-premium lg:flex',
                  isGradientHome
                    ? 'hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent'
                    : 'hover:bg-accent-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar'
                )}
                aria-label="Toggle sidebar"
              >
                <ChevronLeft
                  className={cn(
                    'w-4 h-4',
                    isGradientHome ? 'text-white' : 'text-accent-gold'
                  )}
                  strokeWidth={filmNav ? 1.35 : 2}
                />
              </button>
            )}
            {collapsed && !mobileOpen && (
              <button
                onClick={toggleCollapse}
                className={cn(
                  'hidden h-8 w-8 items-center justify-center rounded-lg transition-premium lg:flex',
                  isGradientHome
                    ? 'hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent'
                    : 'hover:bg-accent-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar'
                )}
                aria-label="Toggle sidebar"
              >
                <ChevronLeft
                  className={cn(
                    'w-4 h-4 rotate-180',
                    isGradientHome ? 'text-white' : 'text-accent-gold'
                  )}
                  strokeWidth={filmNav ? 1.35 : 2}
                />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-x-visible overflow-y-auto px-2.5 py-4 scrollbar-hide">
            <ul className="space-y-1.5">
              {visibleItems.map((item: SidebarMenuItem) => {
                const juridicoInMenu = visibleItems.some((i) => i.id === 'juridico')
                const sectionLabel: string | undefined =
                  SIDEBAR_SECTION_START_LABEL[item.id] ??
                  (item.id === 'emendas' && !juridicoInMenu ? 'Institucional' : undefined)
                const Icon = resolveMenuIcon(item.icon, isCockpit)
                const hasSubmenu = Boolean(item.children?.length)
                const submenuOpen = openSubmenuId === item.id
                const isActive = hasSubmenu
                  ? Boolean(item.children?.some((c) => isChildLinkActive(pathname, c.href)))
                  : item.id === 'territorio-mapa-tds'
                    ? pathname.startsWith('/dashboard/territorio/mapa-tds')
                    : item.id === 'ficha-atendimento'
                      ? pathname.startsWith('/dashboard/ficha-atendimento')
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
                    collapsed={collapsed}
                    mobileOpen={mobileOpen}
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

          {/* Ações rápidas: Splash + Tema */}
          <div
            className={cn(
              'space-y-1.5 border-t px-2.5 py-3',
              isGradientHome ? 'border-white/15' : 'border-border-card/80'
            )}
          >
            <button
              onClick={() => {
                window.dispatchEvent(new Event('activateSplash'))
                setMobileOpen(false)
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-[12px] px-3 py-3',
                'transition-all duration-200 ease-out group',
                isGradientHome ? 'hover:bg-white/10' : 'hover:bg-accent-gold-soft/70',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-sidebar'
              )}
              title="Ativar tela de descanso"
            >
              <Monitor
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isGradientHome
                    ? 'text-white/75 group-hover:text-white'
                    : 'text-text-secondary group-hover:text-accent-gold',
                  filmNav ? 'h-4 w-4' : 'h-5 w-5'
                )}
                strokeWidth={filmNav ? 1.35 : 2}
              />
              {(!collapsed || mobileOpen) && (
                <span
                  className={cn(
                    'text-[0.92rem] font-medium transition-colors',
                    isGradientHome
                      ? 'text-white/90 group-hover:text-white'
                      : 'text-text-primary/90 group-hover:text-text-primary'
                  )}
                >
                  Tela de descanso
                </span>
              )}
            </button>
            {!showTopbar ? (
              <div className="flex w-full min-w-0 justify-start px-1">
                <UserMenu />
              </div>
            ) : null}
            <ThemeToggle
              collapsed={collapsed}
              mobileOpen={mobileOpen}
              triggerOnVibrantNav={isGradientHome}
            />
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

