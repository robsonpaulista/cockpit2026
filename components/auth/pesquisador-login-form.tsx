'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SAVED_LOGIN_STORAGE_KEY = 'cockpit_pesquisador_saved_login_v1'

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
  localStorage.setItem(SAVED_LOGIN_STORAGE_KEY, JSON.stringify({ email, password }))
}

function clearSavedLogin() {
  localStorage.removeItem(SAVED_LOGIN_STORAGE_KEY)
}

export function PesquisadorLoginForm() {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [salvarSenha, setSalvarSenha] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
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
        const me = await fetch('/api/auth/me')
        const body = (await me.json()) as {
          user?: { profile?: { role?: string } }
        }
        const role = body.user?.profile?.role
        if (role !== 'pesquisadores') {
          await supabase.auth.signOut()
          setError('Este acesso é exclusivo para pesquisadores. Use o login do Cockpit se for equipe.')
          setLoading(false)
          return
        }
        if (salvarSenha) {
          persistSavedLogin(email.trim(), password)
        } else {
          clearSavedLogin()
        }
        localStorage.setItem('auth_redirect', 'pesquisador')
        await new Promise((r) => setTimeout(r, 200))
        window.location.href = '/pesquisador'
        return
      }
      setError('Erro ao fazer login. Tente novamente.')
      setLoading(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-6 shadow-xl dark:bg-zinc-900/95">
        <h1 className="text-center text-2xl font-bold text-zinc-900 dark:text-white">
          Pesquisa de campo
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500">PI 2026 · Acesso pesquisador</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="pemail" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              E-mail
            </label>
            <input
              id="pemail"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label htmlFor="ppass" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Senha
            </label>
            <input
              id="ppass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={salvarSenha}
              onChange={(e) => setSalvarSenha(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
            />
            <span>Salvar e-mail e senha neste dispositivo (útil em tablets)</span>
          </label>
          {error && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-orange-600 py-3.5 text-sm font-semibold text-white shadow hover:bg-orange-700 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
