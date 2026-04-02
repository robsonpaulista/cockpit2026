'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Credenciais em texto no dispositivo — útil em tablets; não usar em computadores compartilhados. */
const SAVED_LOGIN_STORAGE_KEY = 'cockpit_saved_login_v1'

function readSavedLogin(): { email: string; password: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SAVED_LOGIN_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { email?: unknown; password?: unknown }
    if (typeof data.email === 'string' && typeof data.password === 'string') {
      return { email: data.email, password: data.password }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persistSavedLogin(email: string, password: string) {
  localStorage.setItem(
    SAVED_LOGIN_STORAGE_KEY,
    JSON.stringify({ email, password })
  )
}

function clearSavedLogin() {
  localStorage.removeItem(SAVED_LOGIN_STORAGE_KEY)
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [salvarSenha, setSalvarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const saved = readSavedLogin()
    if (saved) {
      setEmail(saved.email)
      setPassword(saved.password)
      setSalvarSenha(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (data.user && data.session) {
        if (salvarSenha) {
          persistSavedLogin(email.trim(), password)
        } else {
          clearSavedLogin()
        }

        const me = await fetch('/api/auth/me')
        if (!me.ok) {
          localStorage.setItem('auth_redirect', 'dashboard')
          await new Promise((resolve) => setTimeout(resolve, 300))
          window.location.href = '/splash'
          return
        }
        const body = (await me.json()) as {
          user?: { profile?: { role?: string } }
        }
        const role = body.user?.profile?.role
        if (role === 'pesquisadores') {
          localStorage.setItem('auth_redirect', 'pesquisador')
          await new Promise((resolve) => setTimeout(resolve, 300))
          window.location.href = '/pesquisador'
          return
        }
        localStorage.setItem('auth_redirect', 'dashboard')
        await new Promise((resolve) => setTimeout(resolve, 300))
        window.location.href = '/splash'
      } else {
        setError('Erro ao fazer login. Tente novamente.')
        setLoading(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #e85a10 0%, #de5a12 40%, #b84311 100%)',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Efeito de luz radial (mesmo da splash) */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 50%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-md" style={{ position: 'relative', zIndex: 1 }}>
        {/* Título e slogan acima do card */}
        <div className="text-center mb-8">
          <h1
            style={{
              fontFamily: "'Outfit', 'Inter', sans-serif",
              fontSize: '2.8rem',
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.1,
              textShadow: '0 2px 12px rgba(0,0,0,0.12)',
              marginBottom: '8px',
            }}
          >
            Cockpit <span style={{ fontWeight: 300, fontSize: '1.5rem', opacity: 0.6 }}>2026</span>
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', 'Inter', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Comando Central de Eleições Dep Fed Jadyel Alencar
          </p>
        </div>

        {/* Card do formulário */}
        <div
          style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '2rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: '8px',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.22)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: '8px',
                }}
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '0.95rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.22)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
                }}
              />
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                userSelect: 'none',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              <input
                type="checkbox"
                checked={salvarSenha}
                onChange={(e) => setSalvarSenha(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: '#b84311',
                  cursor: 'pointer',
                }}
              />
              <span>Salvar e-mail e senha neste dispositivo (útil em tablets)</span>
            </label>

            {error && (
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '10px',
                }}
              >
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.95)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? 'rgba(255,255,255,0.25)' : 'white',
                color: loading ? 'rgba(255,255,255,0.8)' : '#b84311',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
                boxShadow: loading ? 'none' : '0 4px 16px rgba(0,0,0,0.1)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 16px rgba(0,0,0,0.1)'
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          <p className="mt-4 text-center">
            <a
              href="/pesquisador/login"
              className="text-xs font-medium text-white/80 underline decoration-white/40 underline-offset-2 hover:text-white"
            >
              Acesso pesquisadores de campo
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

