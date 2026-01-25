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
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-white border border-border shadow-card hover:shadow-card-hover transition-all duration-200"
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-primary" />
        ) : (
          <Menu className="w-5 h-5 text-primary" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full transition-all duration-300 ease-out z-40 overflow-visible',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
        style={{
          background: 'linear-gradient(180deg, #072E66 0%, #0A3F8C 45%, #0B4FAE 100%)',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
            {(!collapsed || mobileOpen) && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white text-sm font-bold">C</span>
                </div>
                <span className="text-sm font-semibold text-white">Cockpit 2026</span>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-all duration-200"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-white/78" />
              </button>
            )}
            {collapsed && !mobileOpen && (
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-all duration-200"
                aria-label="Toggle sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-white/78 rotate-180" />
              </button>
            )}
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto overflow-x-visible py-4 px-2 scrollbar-hide">
            <ul className="space-y-1">
              {menuItems.map((item, index) => {
                const Icon = iconMap[item.icon] || LayoutDashboard
                const isActive = pathname === item.href
                const itemRef = useRef<HTMLDivElement>(null)
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
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2.5 rounded-[12px]',
                        'transition-all duration-200 ease-out',
                        'hover:bg-white/8',
                        isActive 
                          ? 'bg-white text-[#072E66] shadow-[0_6px_18px_rgba(0,0,0,0.14)]' 
                          : 'text-white/86'
                      )}
                      style={isActive ? {} : {
                        borderLeft: isActive ? 'none' : '3px solid transparent'
                      }}
                    >
                      {/* Borda esquerda no hover (não ativo) */}
                      {!isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 group-hover:w-0.5 group-hover:h-6 bg-white/25 rounded-r-full transition-all duration-200" />
                      )}
                      
                      <div className={cn(
                        'w-5 h-5 flex-shrink-0 transition-all duration-200',
                        'group-hover:scale-110',
                        isActive ? 'text-[#0B4FAE]' : 'text-white/78 group-hover:text-white/90'
                      )}>
                        <Icon className="w-full h-full" />
                      </div>
                      {(!collapsed || mobileOpen) && (
                        <span className={cn(
                          'text-sm transition-all duration-200',
                          'group-hover:translate-x-0.5',
                          isActive ? 'text-[#072E66] font-semibold' : 'text-white/86 group-hover:text-white'
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
                      <div className="fixed left-24 px-3 py-2 bg-text-primary text-bg-app text-xs font-semibold rounded-lg whitespace-nowrap z-[200] shadow-lg backdrop-blur-sm" style={{
                        top: `${tooltipPos.top}px`,
                        transform: 'translateY(-50%)',
                        animation: 'fadeIn 0.2s ease-out'
                      }}>
                        {item.label}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-text-primary" />
                      </div>
                    )}
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

