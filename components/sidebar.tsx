'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MenuItem } from '@/types'

const menuItems: MenuItem[] = [
  { id: 'home', label: 'Visão Geral', icon: 'LayoutDashboard', href: '/' },
  { id: 'fases', label: 'Fases da Campanha', icon: 'Calendar', href: '/fases' },
  { id: 'campo', label: 'Campo & Agenda', icon: 'MapPin', href: '/campo' },
  { id: 'narrativas', label: 'Banco de Narrativas', icon: 'FileText', href: '/narrativas' },
  { id: 'conteudo', label: 'Conteúdo & Redes', icon: 'MessageSquare', href: '/conteudo' },
  { id: 'noticias', label: 'Notícias & Crises', icon: 'Newspaper', href: '/noticias' },
  { id: 'territorio', label: 'Território & Base', icon: 'MapPin', href: '/territorio' },
  { id: 'mobilizacao', label: 'Mobilização', icon: 'Users', href: '/mobilizacao' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', href: '/whatsapp' },
  { id: 'pesquisa', label: 'Pesquisa & Relato', icon: 'BarChart3', href: '/pesquisa' },
  { id: 'operacao', label: 'Operação & Equipe', icon: 'Settings', href: '/operacao' },
  { id: 'juridico', label: 'Jurídico', icon: 'Scale', href: '/juridico' },
  { id: 'relatorios', label: 'Relatórios', icon: 'FileBarChart', href: '/relatorios' },
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
  FileBarChart,
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
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
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            {!collapsed && (
              <h1 className="text-xl font-semibold text-primary">Cockpit 2026</h1>
            )}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary-soft transition-premium"
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className={cn('w-4 h-4 text-text-muted transition-transform', collapsed && 'rotate-180')} />
            </button>
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
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-premium group',
                        'hover:bg-primary-soft',
                        isActive && 'bg-primary-soft text-primary'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 flex-shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-text-muted group-hover:text-primary'
                      )}>
                        <Icon className="w-full h-full" />
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <span className={cn(
                          'text-sm font-medium transition-colors',
                          isActive ? 'text-primary' : 'text-text-strong group-hover:text-primary'
                        )}>
                          {item.label}
                        </span>
                      )}
                      {item.badge && (!collapsed || mobileOpen) && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-status-error text-white rounded-full">
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

