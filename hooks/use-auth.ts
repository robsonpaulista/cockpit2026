'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  name: string
  role: string
  avatar_url?: string
}

interface AuthUser extends User {
  profile?: Profile
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // Função para buscar perfil (definida antes do useEffect)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Erro ao buscar perfil:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    let timeoutId: NodeJS.Timeout

    // Timeout de segurança: se após 5 segundos não carregou, para o loading
    timeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[useAuth] Timeout: forçando parar loading após 5s')
        setLoading(false)
      }
    }, 5000)

    // Verificar sessão inicial
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if (error) {
        console.error('Erro ao buscar usuário:', error)
        if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
        return
      }

      if (user) {
        fetchProfile(user.id)
          .then((profile) => {
            if (mounted) {
              clearTimeout(timeoutId)
              setUser({ ...user, profile: profile || undefined } as AuthUser)
              setLoading(false)
            }
          })
          .catch((error) => {
            console.error('Erro ao buscar perfil:', error)
            // Mesmo sem perfil, permite acesso (pode criar depois)
            if (mounted) {
              clearTimeout(timeoutId)
              setUser({ ...user, profile: undefined } as AuthUser)
              setLoading(false)
            }
          })
      } else {
        if (mounted) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    })

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('[useAuth] Auth state changed:', event, session?.user?.email || 'no user')

      if (session?.user) {
        try {
          const profile = await fetchProfile(session.user.id)
          setUser({ ...session.user, profile: profile || undefined } as AuthUser)
        } catch (error) {
          console.error('Erro ao buscar perfil:', error)
          // Permite acesso mesmo sem perfil
          setUser({ ...session.user, profile: undefined } as AuthUser)
        }
      } else {
        setUser(null)
      }
      clearTimeout(timeoutId)
      setLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return {
    user,
    loading,
    signOut,
  }
}
