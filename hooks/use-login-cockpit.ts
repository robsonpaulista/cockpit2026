'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  entrarComSenha,
  lerLoginSalvo,
  limparLoginSalvo,
  salvarLogin,
} from '@/lib/services/auth-client'

export function useLoginCockpit() {
  const [email, setEmail] = useState<string>('')
  const [senha, setSenha] = useState<string>('')
  const [lembrar, setLembrar] = useState<boolean>(false)
  const [carregando, setCarregando] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const salvo = lerLoginSalvo()
    if (!salvo) return
    setEmail(salvo.email)
    setSenha(salvo.senha)
    setLembrar(true)
  }, [])

  const entrar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const destino = await entrarComSenha(email.trim(), senha)
      if (lembrar) salvarLogin(email.trim(), senha)
      else limparLoginSalvo()
      localStorage.setItem('auth_redirect', destino === '/pesquisador' ? 'pesquisador' : 'dashboard')
      window.location.href = destino
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.')
      setCarregando(false)
    }
  }, [email, senha, lembrar])

  return { email, setEmail, senha, setSenha, lembrar, setLembrar, carregando, erro, entrar }
}
