'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'

/**
 * Altura aproximada do dropdown (cabeçalho do usuário + 3 botões + separadores).
 * Usada para decidir se há espaço suficiente abaixo do gatilho antes de abrir
 * (caso contrário, o popover é renderizado para cima evitando que ele seja
 * cortado pelo rodapé da viewport — caso da Sidebar com Topbar oculta).
 */
const USER_MENU_DROPDOWN_HEIGHT = 260
const USER_MENU_VIEWPORT_MARGIN = 12

type UserMenuPlacement = 'bottom' | 'top'

export function UserMenu() {
  const { user, loading, signOut } = useAuth()
  const isGradientHome = useDashboardHomeChrome()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<UserMenuPlacement>('bottom')
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

  /**
   * Calcula o melhor lado para abrir o popover comparando o espaço abaixo e
   * acima do gatilho na viewport. Roda no toggle (antes de abrir) e também
   * em resize/scroll enquanto o menu está aberto, para manter o posicionamento
   * coerente quando o layout muda.
   */
  const recomputePlacement = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const viewportHeight =
      typeof window !== 'undefined' ? window.innerHeight : 0
    const espacoAbaixo = viewportHeight - rect.bottom - USER_MENU_VIEWPORT_MARGIN
    const espacoAcima = rect.top - USER_MENU_VIEWPORT_MARGIN
    if (
      espacoAbaixo < USER_MENU_DROPDOWN_HEIGHT &&
      espacoAcima > espacoAbaixo
    ) {
      setPlacement('top')
    } else {
      setPlacement('bottom')
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
      
      // Limpar localStorage
      localStorage.removeItem('auth_redirect')
      localStorage.removeItem('candidatoPadraoPesquisa')
      
      // Fazer logout no Supabase
      await signOut()
      
      // Aguardar um pouco para garantir que a sessão foi limpa
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Redirecionar para login usando window.location para forçar reload completo
      window.location.href = '/login'
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo com erro, tentar redirecionar
      window.location.href = '/login'
    }
  }

  // Se ainda não montou, não mostrar nada (evita erro de hidratação)
  if (!mounted) {
    return null
  }

  // Se está carregando, mostrar um placeholder
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-background animate-pulse" />
        <div className="hidden md:block">
          <div className="h-4 w-24 bg-background rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Se não há usuário após carregar, mostrar um botão de fallback para logout
  // Isso garante que sempre há uma forma de sair
  if (!user) {
    return (
      <div className="relative">
        <button
          onClick={async () => {
            // Limpar tudo e redirecionar
            localStorage.clear()
            window.location.href = '/login'
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent-gold-soft transition-colors text-secondary"
          title="Sair"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    )
  }

  const userInitials = user.profile?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.email?.[0].toUpperCase() || 'U'

  const roleLabels: Record<string, string> = {
    candidato: 'Candidato',
    coordenacao: 'Coordenação',
    comunicacao: 'Comunicação',
    articulacao: 'Articulação',
    juridico: 'Jurídico',
    bi: 'BI / Inteligência',
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          isGradientHome ? 'hover:bg-white/10' : 'hover:bg-accent-gold-soft',
        )}
      >
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white',
            user.profile?.avatar_url ? 'bg-accent-gold' : 'bg-accent-gold'
          )}
        >
          {user.profile?.avatar_url ? (
            <img
              src={user.profile.avatar_url}
              alt={user.profile.name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            userInitials
          )}
        </div>
        <div className="hidden md:block text-left">
          <p
            className={cn(
              'text-sm font-medium',
              isGradientHome ? 'text-white' : 'text-text-primary',
            )}
          >
            {user.profile?.name || user.email}
          </p>
          {user.profile?.role && (
            <p
              className={cn(
                'text-xs',
                isGradientHome ? 'text-white/70' : 'text-secondary',
              )}
            >
              {roleLabels[user.profile.role] || user.profile.role}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform',
            isGradientHome ? 'text-white/75' : 'text-secondary',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 w-56 bg-surface border border-card rounded-xl shadow-card z-50 overflow-hidden',
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          )}
        >
          <div className="p-4 border-b border-card">
            <p className="text-sm font-semibold text-text-primary">
              {user.profile?.name || 'Usuário'}
            </p>
            <p className="text-xs text-secondary mt-1">{user.email}</p>
            {user.profile?.role && (
              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-lg">
                {roleLabels[user.profile.role] || user.profile.role}
              </span>
            )}
          </div>

          <div className="p-1">
            <button
              onClick={() => {
                setOpen(false)
                // TODO: Navegar para página de perfil quando criarmos
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-background rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-secondary" />
              <span>Meu Perfil</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                // TODO: Navegar para configurações quando criarmos
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-primary hover:bg-background rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-secondary" />
              <span>Configurações</span>
            </button>

            <div className="my-1 border-t border-card" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-status-error hover:bg-status-error/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}




