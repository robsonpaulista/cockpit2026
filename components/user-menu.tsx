'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import {
  sidebarActiveFocusRingClass,
  sidebarBrandWelcomeClass,
  sidebarBrandWelcomeNameClass,
} from '@/lib/sidebar-brand-styles'
import {
  JARVIS_SIDEBAR_FOCUS,
  JARVIS_SIDEBAR_HOVER,
  JARVIS_SIDEBAR_ICON,
  JARVIS_SIDEBAR_TEXT,
} from '@/lib/jarvis-sidebar-styles'
import { UserAvatarPatch } from '@/components/user-avatar-patch'

const USER_MENU_DROPDOWN_HEIGHT = 260
const USER_MENU_VIEWPORT_MARGIN = 12

type UserMenuPlacement = 'bottom' | 'top'

type UserMenuProps = {
  variant?: 'default' | 'sidebar'
  className?: string
  /** Sidebar recolhida — só avatar no rodapé. */
  collapsed?: boolean
  /** Topbar âmbar no mobile — ícones e hover claros. */
  amberMobileChrome?: boolean
}

function resolveWelcomeName(name: string | undefined, email: string | undefined): string {
  if (name?.trim()) {
    const first = name.trim().split(/\s+/)[0]
    return first || name.trim()
  }
  if (email) return email.split('@')[0] ?? email
  return 'Usuário'
}

export function UserMenu({
  variant = 'default',
  className,
  collapsed = false,
  amberMobileChrome = false,
}: UserMenuProps) {
  const { user, loading, signOut } = useAuth()
  const isGradientHome = useDashboardHomeChrome()
  const isSidebar = variant === 'sidebar'
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<UserMenuPlacement>('bottom')
  const [sidebarDropdownCoords, setSidebarDropdownCoords] = useState<{
    top?: number
    bottom?: number
    left: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const recomputePlacement = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight =
      typeof window !== 'undefined' ? window.innerHeight : 0
    const espacoAbaixo = viewportHeight - rect.bottom - USER_MENU_VIEWPORT_MARGIN
    const espacoAcima = rect.top - USER_MENU_VIEWPORT_MARGIN
    const nextPlacement: UserMenuPlacement =
      espacoAbaixo < USER_MENU_DROPDOWN_HEIGHT && espacoAcima > espacoAbaixo
        ? 'top'
        : 'bottom'

    setPlacement(nextPlacement)

    if (isSidebar) {
      setSidebarDropdownCoords(
        nextPlacement === 'bottom'
          ? { top: rect.bottom + 8, left: rect.left }
          : { bottom: viewportHeight - rect.top + 8, left: rect.left },
      )
    } else {
      setSidebarDropdownCoords(null)
    }
  }

  useEffect(() => {
    if (!open) return
    const onResize = () => recomputePlacement()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        recomputePlacement()
      }
      return next
    })
  }

  const handleSignOut = async () => {
    try {
      setOpen(false)
      localStorage.removeItem('auth_redirect')
      localStorage.removeItem('candidatoPadraoPesquisa')
      await signOut()
      await new Promise((resolve) => setTimeout(resolve, 200))
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      window.location.href = '/login'
    }
  }

  if (!mounted) {
    return null
  }

  if (loading) {
    if (isSidebar) {
      return (
        <div
          className={cn(
            'flex items-center gap-2',
            collapsed && 'justify-center',
            className,
          )}
          aria-hidden
        >
          <div className="h-7 w-7 animate-pulse rounded-full bg-[#C8900A]/25" />
          {!collapsed ? (
            <div className="h-[10px] flex-1 animate-pulse rounded bg-bg-app" />
          ) : null}
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#C8900A]/25" aria-hidden />
        <div className="hidden md:block">
          <div className="h-4 w-24 animate-pulse rounded bg-background" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={cn('relative', className)}>
        <button
          onClick={async () => {
            localStorage.clear()
            window.location.href = '/login'
          }}
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 transition-colors text-secondary',
            isSidebar && 'px-0 py-0.5 text-[10px] text-[#888888] hover:text-[#1a1a1a]'
          )}
          title="Sair"
        >
          {isSidebar ? 'Entrar' : <LogOut className="h-5 w-5" />}
        </button>
      </div>
    )
  }

  const welcomeName = resolveWelcomeName(user.profile?.name, user.email ?? undefined)

  const roleLabels: Record<string, string> = {
    candidato: 'Candidato',
    coordenacao: 'Coordenação',
    comunicacao: 'Comunicação',
    articulacao: 'Articulação',
    juridico: 'Jurídico',
    bi: 'BI / Inteligência',
  }

  return (
    <div className={cn('relative min-w-0', className)} ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="menu"
        title={isSidebar && collapsed ? welcomeName : undefined}
        className={cn(
          'group flex min-w-0 items-center gap-1.5 rounded-md transition-colors',
          isSidebar
            ? cn(
                'w-full text-left',
                collapsed ? 'justify-center px-1 py-1' : 'px-0.5 py-1',
                sidebarActiveFocusRingClass,
                'hover:opacity-80',
              )
            : cn(
                'gap-2 rounded-lg px-3 py-2',
                amberMobileChrome && 'max-lg:hover:bg-white/12',
                isGradientHome
                  ? cn(JARVIS_SIDEBAR_HOVER, JARVIS_SIDEBAR_FOCUS)
                  : !amberMobileChrome && 'hover:bg-accent-gold-soft'
              )
        )}
      >
        <UserAvatarPatch
          name={user.profile?.name}
          email={user.email ?? undefined}
          avatarUrl={user.profile?.avatar_url}
          size={isSidebar ? 'sm' : 'md'}
        />

        {isSidebar ? (
          collapsed ? (
            <span className="sr-only">{welcomeName}</span>
          ) : (
            <span className={cn('min-w-0 flex-1 truncate', sidebarBrandWelcomeClass)}>
              Bem-vindo,{' '}
              <span className={sidebarBrandWelcomeNameClass}>{welcomeName}</span>
            </span>
          )
        ) : (
          <div className="hidden text-left md:block">
            <p
              className={cn(
                'text-sm font-medium',
                isGradientHome ? 'text-[#E8F4FD] group-hover:text-[#00D4FF]' : 'text-text-primary'
              )}
            >
              {user.profile?.name || user.email}
            </p>
            {user.profile?.role ? (
              <p className={cn('text-xs', isGradientHome ? JARVIS_SIDEBAR_TEXT : 'text-secondary')}>
                {roleLabels[user.profile.role] || user.profile.role}
              </p>
            ) : null}
          </div>
        )}

        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            isSidebar
              ? collapsed
                ? 'hidden'
                : 'text-[#888888]'
              : amberMobileChrome
                ? 'text-secondary max-lg:text-white/85'
                : isGradientHome
                  ? cn(JARVIS_SIDEBAR_ICON, 'group-hover:!text-[#00D4FF]')
                  : 'text-secondary',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'w-56 overflow-hidden rounded-xl border border-card bg-surface shadow-card',
            isSidebar
              ? 'fixed z-[200]'
              : cn(
                  'absolute z-50',
                  placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                  'right-0',
                ),
          )}
          style={
            isSidebar && sidebarDropdownCoords
              ? {
                  top: sidebarDropdownCoords.top,
                  bottom: sidebarDropdownCoords.bottom,
                  left: sidebarDropdownCoords.left,
                }
              : undefined
          }
        >
          <div className="border-b border-card p-4">
            <p className="text-sm font-semibold text-text-primary">
              {user.profile?.name || 'Usuário'}
            </p>
            <p className="mt-1 text-xs text-secondary">{user.email}</p>
            {user.profile?.role ? (
              <span className="mt-2 inline-block rounded-lg bg-accent-gold-soft px-2 py-1 text-xs font-medium text-accent-gold">
                {roleLabels[user.profile.role] || user.profile.role}
              </span>
            ) : null}
          </div>

          <div className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-background"
            >
              <User className="h-4 w-4 text-secondary" />
              <span>Meu Perfil</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-primary transition-colors hover:bg-background"
            >
              <Settings className="h-4 w-4 text-secondary" />
              <span>Configurações</span>
            </button>

            <div className="my-1 border-t border-card" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-status-error transition-colors hover:bg-status-error/10"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
