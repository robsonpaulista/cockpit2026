'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
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
      window.location.href = '/'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      window.location.href = '/'
    }
  }

  if (!mounted) {
    return null
  }

  const iceSidebar = isSidebar && isGradientHome
  const avatarPulseClass = iceSidebar
    ? 'bg-[#f2d06b]/45'
    : 'bg-[#f04b23]/25'

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
          <div className={cn('h-7 w-7 animate-pulse rounded-full', avatarPulseClass)} />
          {!collapsed ? (
            <div className="h-[10px] flex-1 animate-pulse rounded bg-bg-app" />
          ) : null}
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div
          className={cn('h-8 w-8 animate-pulse rounded-full', avatarPulseClass)}
          aria-hidden
        />
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
            window.location.href = '/'
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
                iceSidebar
                  ? cn(JARVIS_SIDEBAR_HOVER, JARVIS_SIDEBAR_FOCUS)
                  : sidebarActiveFocusRingClass,
                !iceSidebar && 'hover:opacity-80',
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
          tone={iceSidebar || isGradientHome ? 'ice' : 'amber'}
        />

        {isSidebar ? (
          collapsed ? (
            <span className="sr-only">{welcomeName}</span>
          ) : (
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[13px] font-medium leading-[17px]',
                iceSidebar
                  ? 'text-[#2b2d31]'
                  : sidebarBrandWelcomeClass,
              )}
            >
              Bem-vindo,{' '}
              <span
                className={cn(
                  iceSidebar ? 'font-semibold text-[#2b2d31]' : sidebarBrandWelcomeNameClass,
                )}
              >
                {welcomeName}
              </span>
            </span>
          )
        ) : (
          <div className="hidden text-left md:block">
            <p
              className={cn(
                'text-sm font-medium',
                isGradientHome ? 'text-[#2b2d31] group-hover:text-[#2b2d31]' : 'text-text-primary'
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
                : iceSidebar
                  ? 'text-[#2b2d31] opacity-100'
                  : 'text-white/45'
              : amberMobileChrome
                ? 'text-secondary max-lg:text-white/85'
                : isGradientHome
                  ? cn(JARVIS_SIDEBAR_ICON, 'group-hover:!text-[#2b2d31]')
                  : 'text-secondary',
            open && 'rotate-180'
          )}
        />
      </button>

      {open ? (
        (() => {
          const dropdown = (
            <div
              ref={dropdownRef}
              role="menu"
              className={cn(
                'user-menu-dropdown w-56 overflow-hidden rounded-xl border border-[#e8e8e6] bg-[#ffffff] shadow-[0_8px_24px_rgba(43,45,49,0.14),0_2px_6px_rgba(43,45,49,0.06)]',
                isSidebar
                  ? 'fixed z-[300]'
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
                      backgroundColor: '#ffffff',
                    }
                  : { backgroundColor: '#ffffff' }
              }
            >
              <div className="border-b border-[#e8e8e6] bg-[#ffffff] p-4">
                <p className="text-sm font-semibold text-[#2b2d31]">
                  {user.profile?.name || 'Usuário'}
                </p>
                <p className="mt-1 text-xs text-[#686865]">{user.email}</p>
                {user.profile?.role ? (
                  <span className="mt-2 inline-block rounded-lg bg-[#f2d06b] px-2 py-1 text-xs font-medium text-[#2b2d31]">
                    {roleLabels[user.profile.role] || user.profile.role}
                  </span>
                ) : null}
              </div>

              <div className="bg-[#ffffff] p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#2b2d31] transition-colors hover:bg-[#f3f3f1]"
                >
                  <User className="h-4 w-4 text-[#686865]" />
                  <span>Meu Perfil</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#2b2d31] transition-colors hover:bg-[#f3f3f1]"
                >
                  <Settings className="h-4 w-4 text-[#686865]" />
                  <span>Configurações</span>
                </button>

                <div className="my-1 border-t border-[#e8e8e6]" />

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
          )

          // Portal no body: escapa backdrop-filter / isolation da sidebar (fundo transparente).
          if (isSidebar && typeof document !== 'undefined') {
            return createPortal(dropdown, document.body)
          }
          return dropdown
        })()
      ) : null}
    </div>
  )
}
