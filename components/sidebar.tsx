'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  FileBarChart,
  Menu,
  X,
  ChevronLeft,
  Vote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuItem } from '@/types'
import { useSidebar } from '@/contexts/sidebar-context'

const menuItems: MenuItem[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/dashboard' },
  { id: 'fases', label: 'Fases da Campanha', icon: 'Calendar', href: '/dashboard/fases' },
  { id: 'narrativas', label: 'Bandeiras de Campanha', icon: 'FileText', href: '/dashboard/narrativas' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/dashboard/campo' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/dashboard/territorio' },
  { id: 'chapas', label: 'Chapas', icon: 'Vote', href: '/dashboard/chapas' },
  { id: 'conteudo', label: 'Conteúdo & Redes', icon: 'MessageSquare', href: '/dashboard/conteudo' },
  { id: 'noticias', label: 'Notícias & Crises', icon: 'Newspaper', href: '/dashboard/noticias' },
  { id: 'mobilizacao', label: 'Mobilização', icon: 'Users', href: '/dashboard/mobilizacao' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', href: '/dashboard/whatsapp' },
  { id: 'pesquisa', label: 'Pesquisa & Relato', icon: 'BarChart3', href: '/dashboard/pesquisa' },
  { id: 'operacao', label: 'Operação & Equipe', icon: 'Settings', href: '/dashboard/operacao' },
  { id: 'juridico', label: 'Jurídico', icon: 'Scale', href: '/dashboard/juridico' },
  { id: 'relatorios', label: 'Relatórios', icon: 'FileBarChart', href: '/dashboard/relatorios' },
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
  FileBarChart,
}

export function Sidebar() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar()
  const pathname = usePathname()

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
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-surface border border-border shadow-card hover:shadow-card-hover transition-premium"
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-text-strong" />
        ) : (
          <Menu className="w-5 h-5 text-text-strong" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-surface border-r border-border transition-all duration-300 ease-premium z-40',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo - Simplificado, logo está no header agora */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white text-sm font-bold">C</span>
                </div>
                <span className="text-sm font-semibold text-text-strong">Cockpit 2026</span>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-text-muted" />
              </button>
            )}
            {collapsed && !mobileOpen && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary-soft transition-premium"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-text-muted rotate-180" />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hide">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = iconMap[item.icon] || LayoutDashboard
                const isActive = pathname === item.href

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-xl',
                        'transition-all duration-300 ease-premium group',
                        'hover:bg-primary-soft hover:translate-x-1 hover:shadow-sm',
                        isActive && 'bg-primary-soft text-primary shadow-sm'
                      )}
                    >
                      {/* Indicador de ativo */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                      )}
                      
                      <div className={cn(
                        'w-5 h-5 flex-shrink-0 transition-all duration-300',
                        'group-hover:scale-110',
                        isActive ? 'text-primary' : 'text-text-muted group-hover:text-primary'
                      )}>
                        <Icon className="w-full h-full" />
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <span className={cn(
                          'text-sm font-medium transition-all duration-300',
                          'group-hover:translate-x-0.5',
                          isActive ? 'text-primary font-semibold' : 'text-text-strong group-hover:text-primary'
                        )}>
                          {item.label}
                        </span>
                      )}
                      {item.badge && (!collapsed || mobileOpen) && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-status-error text-white rounded-full transition-transform duration-300 group-hover:scale-110">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
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

