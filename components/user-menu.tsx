'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-soft transition-colors text-text-muted"
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
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary-soft transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
          {user.profile?.avatar_url ? (
            <img
              src={user.profile.avatar_url}
              alt={user.profile.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            userInitials
          )}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium text-text-strong">
            {user.profile?.name || user.email}
          </p>
          {user.profile?.role && (
            <p className="text-xs text-text-muted">
              {roleLabels[user.profile.role] || user.profile.role}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-text-muted transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-card z-50 overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm font-semibold text-text-strong">
              {user.profile?.name || 'Usuário'}
            </p>
            <p className="text-xs text-text-muted mt-1">{user.email}</p>
            {user.profile?.role && (
              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-primary-soft text-primary rounded-lg">
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
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-strong hover:bg-background rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-text-muted" />
              <span>Meu Perfil</span>
            </button>

            <button
              onClick={() => {
                setOpen(false)
                // TODO: Navegar para configurações quando criarmos
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-text-strong hover:bg-background rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4 text-text-muted" />
              <span>Configurações</span>
            </button>

            <div className="my-1 border-t border-border" />

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




