'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_FONT_STACK_CSS } from '@/lib/app-font-stack'

/** Paleta compartilhada com a splash ("ligar a máquina"). */
const GOLD = '#c99a2e'
const GOLD_HOVER = '#dcae42'
const CAR_IMAGE = '/splash/cockpit-track-full.png'

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
          window.location.href = '/dashboard'
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
        window.location.href = '/dashboard'
      } else {
        setError('Erro ao fazer login. Tente novamente.')
        setLoading(false)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '11px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: 'white',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'all 0.2s ease',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0b0d',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Fundo: apenas um leve indício da foto da splash (carro na pista) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${CAR_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          opacity: 0.22,
        }}
      />
      {/* Scrim escuro para legibilidade + vinheta (mesma lógica da splash) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 75% 75% at 50% 48%, rgba(11,11,13,0.55) 0%, rgba(11,11,13,0.9) 68%, rgba(6,6,8,0.97) 100%)',
          pointerEvents: 'none',
        }}
      />

      <div className="w-full max-w-md" style={{ position: 'relative', zIndex: 1 }}>
        {/* Título e slogan — "COCKPIT" dourado + "2026" claro (igual à splash) */}
        <div className="text-center mb-10">
          <h1
            style={{
              fontFamily: APP_FONT_STACK_CSS,
              fontSize: 'clamp(1.9rem, 6vw, 2.6rem)',
              fontWeight: 500,
              color: 'white',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 20px rgba(0,0,0,0.6)',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontWeight: 700, color: GOLD }}>COCKPIT</span> 2026
          </h1>
          <p
            style={{
              fontFamily: APP_FONT_STACK_CSS,
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              textShadow: '0 1px 14px rgba(0,0,0,0.6)',
            }}
          >
            Comando Central de Eleições Dep Fed Jadyel Alencar
          </p>
        </div>

        {/* Formulário direto sobre o fundo — sem card, mais minimalista */}
        <div style={{ padding: '0 0.5rem' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
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
                style={inputBase}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = GOLD
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,154,46,0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.7)',
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
                style={inputBase}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = GOLD
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(201,154,46,0.18)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.boxShadow = 'none'
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
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              <input
                type="checkbox"
                checked={salvarSenha}
                onChange={(e) => setSalvarSenha(e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: GOLD,
                  cursor: 'pointer',
                }}
              />
              <span>Salvar e-mail e senha neste dispositivo (útil em tablets)</span>
            </label>

            {error && (
              <div
                style={{
                  padding: '12px',
                  background: 'rgba(201,154,46,0.1)',
                  border: '1px solid rgba(201,154,46,0.35)',
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
                padding: '13px',
                background: loading ? 'rgba(201,154,46,0.4)' : GOLD,
                color: '#14110a',
                borderRadius: '999px',
                fontWeight: 700,
                fontSize: '0.95rem',
                letterSpacing: '0.02em',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.8 : 1,
                boxShadow: loading ? 'none' : '0 8px 26px rgba(201,154,46,0.38)',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = GOLD_HOVER
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(201,154,46,0.5)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = loading ? 'rgba(201,154,46,0.4)' : GOLD
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = loading ? 'none' : '0 8px 26px rgba(201,154,46,0.38)'
              }}
            >
              {loading ? 'Entrando...' : 'Entrar no Cockpit'}
            </button>
          </form>
          <p className="mt-5 text-center">
            <a
              href="/pesquisador/login"
              className="text-xs font-medium text-white/60 underline decoration-white/25 underline-offset-2 hover:text-white"
            >
              Acesso pesquisadores de campo
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

