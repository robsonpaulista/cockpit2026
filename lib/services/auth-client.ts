import { createClient } from '@/lib/supabase/client'

export type DestinoLogin = '/dashboard' | '/pesquisador'

export type LoginSalvo = { email: string; senha: string }

/** Credenciais em texto no dispositivo — útil em tablets; não usar em computadores compartilhados. */
const LOGIN_SALVO_STORAGE_KEY = 'cockpit_saved_login_v1'

export function lerLoginSalvo(): LoginSalvo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LOGIN_SALVO_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { email?: unknown; password?: unknown }
    if (typeof data.email === 'string' && typeof data.password === 'string') {
      return { email: data.email, senha: data.password }
    }
  } catch {
    /* ignore */
  }
  return null
}

export function salvarLogin(email: string, senha: string): void {
  localStorage.setItem(LOGIN_SALVO_STORAGE_KEY, JSON.stringify({ email, password: senha }))
}

export function limparLoginSalvo(): void {
  localStorage.removeItem(LOGIN_SALVO_STORAGE_KEY)
}

function traduzirErroLogin(mensagem: string): string {
  if (/invalid login credentials/i.test(mensagem)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(mensagem)) return 'E-mail ainda não confirmado.'
  return mensagem
}

/** Autentica no Supabase e devolve a rota inicial conforme o perfil do usuário. */
export async function entrarComSenha(email: string, senha: string): Promise<DestinoLogin> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(traduzirErroLogin(error.message))
  if (!data.user || !data.session) throw new Error('Erro ao fazer login. Tente novamente.')

  const me = await fetch('/api/auth/me')
  if (!me.ok) return '/dashboard'
  const body = (await me.json()) as { user?: { profile?: { role?: string } } }
  return body.user?.profile?.role === 'pesquisadores' ? '/pesquisador' : '/dashboard'
}
