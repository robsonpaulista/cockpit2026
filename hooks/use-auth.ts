'use client'

import { useEffect, useState, useRef } from 'react'
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

// Singleton do Supabase client (evita criar novo a cada render)
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const initializedRef = useRef(false)

  // Função para buscar perfil (não bloqueia o fluxo principal)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const supabase = getSupabase()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[useAuth] Erro ao buscar perfil:', error.message)
        return null
      }

      return data
    } catch (error) {
      console.error('[useAuth] Erro ao buscar perfil:', error)
      return null
    }
  }

  // Processar sessão: define o user imediatamente, busca perfil em background
  const processSession = async (sessionUser: User | null) => {
    if (!mountedRef.current) return

    if (sessionUser) {
      // PRIMEIRO: definir user imediatamente (sem esperar perfil)
      // Isso libera todas as páginas que dependem de user.id
      setUser({ ...sessionUser, profile: undefined } as AuthUser)
      setLoading(false)

      // DEPOIS: buscar perfil em background (não bloqueia)
      const profile = await fetchProfile(sessionUser.id)
      if (mountedRef.current) {
        setUser({ ...sessionUser, profile: profile || undefined } as AuthUser)
      }
    } else {
      setUser(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    
    // Evitar dupla inicialização (React Strict Mode)
    if (initializedRef.current) return
    initializedRef.current = true

    const supabase = getSupabase()

    // 1. getSession() - lê do cookie/localStorage (SEM chamada de rede)
    //    Diferente de getUser() que SEMPRE faz request HTTP ao servidor Supabase
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[useAuth] Erro getSession:', error.message)
        if (mountedRef.current) setLoading(false)
        return
      }
      
      console.log('[useAuth] Sessão local:', session?.user?.email || 'nenhuma')
      processSession(session?.user || null)
    })

    // 2. onAuthStateChange - escuta mudanças de auth (token refresh, login, logout)
    //    Evento-driven, sem polling, sem chamada ativa de rede
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return
      console.log('[useAuth] Auth event:', event, session?.user?.email || 'no user')
      processSession(session?.user || null)
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    try {
      const supabase = getSupabase()
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('[useAuth] Erro ao fazer logout:', error)
      }
      
      setUser(null)
      localStorage.removeItem('auth_redirect')
      localStorage.removeItem('chapas_uid')
    } catch (error) {
      console.error('[useAuth] Erro ao fazer logout:', error)
      setUser(null)
    }
  }

  return {
    user,
    loading,
    signOut,
  }
}
