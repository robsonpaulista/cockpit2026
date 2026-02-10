'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import {
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
  Menu,
  X,
  ChevronLeft,
  Vote,
  Building2,
  Shield,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuItem } from '@/types'
import { useSidebar } from '@/contexts/sidebar-context'
import { useNavigationLoading } from '@/contexts/navigation-loading-context'
import { usePermissions } from '@/hooks/use-permissions'
import { ThemeToggle } from '@/components/theme-toggle'

const menuItems: MenuItem[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/dashboard' },
  { id: 'fases', label: 'Fases da Campanha', icon: 'Calendar', href: '/dashboard/fases' },
  { id: 'narrativas', label: 'Bandeiras de Campanha', icon: 'FileText', href: '/dashboard/narrativas' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/dashboard/campo' },
  { id: 'agenda', label: 'Agenda', icon: 'Calendar', href: '/dashboard/agenda' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/dashboard/territorio' },
  { id: 'chapas', label: 'Chapas', icon: 'Vote', href: '/dashboard/chapas' },
  { id: 'conteudo', label: 'Conteúdo & Redes', icon: 'MessageSquare', href: '/dashboard/conteudo' },
  { id: 'noticias', label: 'Notícias & Crises', icon: 'Newspaper', href: '/dashboard/noticias' },
  { id: 'mobilizacao', label: 'Mobilização', icon: 'Users', href: '/dashboard/mobilizacao' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', href: '/dashboard/whatsapp' },
  { id: 'pesquisa', label: 'Pesquisa & Relato', icon: 'BarChart3', href: '/dashboard/pesquisa' },
  { id: 'operacao', label: 'Operação & Equipe', icon: 'Settings', href: '/dashboard/operacao' },
  { id: 'juridico', label: 'Jurídico', icon: 'Scale', href: '/dashboard/juridico' },
  { id: 'obras', label: 'Obras', icon: 'Building2', href: '/dashboard/obras' },
  { id: 'sei-pesquisa', label: 'Pesquisa SEI (teste)', icon: 'Search', href: '/dashboard/sei-pesquisa' },
  { id: 'usuarios', label: 'Gestão de Usuários', icon: 'Shield', href: '/dashboard/usuarios' },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
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
}

function pageKeyForItem(id: string): string {
  return id === 'home' ? 'dashboard' : id
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const { setNavigating } = useNavigationLoading()
  const pathname = usePathname()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()

  const visibleItems = permLoading
    ? menuItems
    : menuItems.filter((item) => {
        if (item.id === 'home') return true
        if (item.id === 'usuarios') return isAdmin
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
        onClick={toggleMobile}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-bg-surface border border-border-card shadow-card hover:shadow-card-hover transition-premium"
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-accent-gold" />
        ) : (
          <Menu className="w-5 h-5 text-accent-gold" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-sidebar border-r border-card transition-all duration-300 ease-out z-40 overflow-visible',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-card">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-gold flex items-center justify-center">
                  <span className="text-white text-sm font-bold">C</span>
                </div>
                <span className="text-sm font-semibold text-text-primary">Cockpit 2026</span>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent-gold-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-accent-gold" />
              </button>
            )}
            {collapsed && !mobileOpen && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent-gold-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-accent-gold rotate-180" />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto overflow-x-visible py-4 px-2 scrollbar-hide">
            <ul className="space-y-1">
              {visibleItems.map((item: MenuItem) => {
                const Icon = iconMap[item.icon] || LayoutDashboard
                const isActive = pathname === item.href
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
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (item.href !== pathname) setNavigating(true)
                        setMobileOpen(false)
                      }}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-[10px]',
                        'transition-all duration-200 ease-out',
                        'hover:bg-accent-gold-soft hover:text-text-primary',
                        isActive && 'bg-accent-gold-soft text-text-primary shadow-sm'
                      )}
                    >
                      {/* Indicador de ativo */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent-gold rounded-r-full" />
                      )}
                      
                      <div className={cn(
                        'w-5 h-5 flex-shrink-0 transition-all duration-200',
                        'group-hover:scale-110',
                        isActive ? 'text-accent-gold font-bold' : 'text-secondary group-hover:text-accent-gold'
                      )}>
                        <Icon className="w-full h-full" />
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <span className={cn(
                          'text-sm transition-all duration-200',
                          'group-hover:translate-x-0.5',
                          isActive ? 'text-text-primary font-semibold' : 'text-text-secondary group-hover:text-text-primary'
                        )}>
                          {item.label}
                        </span>
                      )}
                      {item.badge && (!collapsed || mobileOpen) && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-status-danger text-white rounded-full transition-transform duration-200 group-hover:scale-110">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                    
                    {/* Tooltip quando sidebar está recolhida - usando fixed para sair do overflow */}
                    {collapsed && !mobileOpen && tooltipPos && (
                      <div className="fixed left-24 px-3 py-2 bg-text-text-primary text-bg-app text-xs font-semibold rounded-lg whitespace-nowrap z-[200] shadow-lg backdrop-blur-sm" style={{
                        top: `${tooltipPos.top}px`,
                        transform: 'translateY(-50%)',
                        animation: 'fadeIn 0.2s ease-out'
                      }}>
                        {item.label}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-text-text-primary" />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Theme Toggle */}
          <div className="px-2 py-3 border-t border-border-card">
            <ThemeToggle collapsed={collapsed} mobileOpen={mobileOpen} />
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}

