'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

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
        // Login bem-sucedido - salvar flag no localStorage para o ProtectedRoute saber
        localStorage.setItem('auth_redirect', 'dashboard')
        
        // Aguardar um pouco para garantir que a sessão foi estabelecida
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Redirecionar para splash screen após login
        window.location.href = '/splash'
      } else {
        setError('Erro ao fazer login. Tente novamente.')
        setLoading(false)
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Tente novamente.')
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
        </div>
      </div>
    </div>
  )
}

