'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

const TEMPO_INATIVIDADE = 10 * 60 * 1000 // 10 minutos
const IDLE_SPLASH_LOCK_KEY = 'idle_splash_locked_v1'

export type IdleSplashFase = 'inicio' | 'c' | 'nome' | 'slogan'

type IdleSplashContextValue = {
  ativo: boolean
  fase: IdleSplashFase
  dispensando: boolean
  requerSenha: boolean
  senha: string
  setSenha: (value: string) => void
  erroSenha: string | null
  verificandoSenha: boolean
  solicitarDesbloqueio: () => void
  validarSenha: () => Promise<void>
  cancelarSenha: () => void
}

const IdleSplashContext = createContext<IdleSplashContextValue | null>(null)

export function IdleSplashProvider({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState<boolean>(false)
  const [fase, setFase] = useState<IdleSplashFase>('inicio')
  const [dispensando, setDispensando] = useState<boolean>(false)
  const [requerSenha, setRequerSenha] = useState<boolean>(false)
  const [senha, setSenha] = useState<string>('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [verificandoSenha, setVerificandoSenha] = useState<boolean>(false)

  const timerInatividade = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timersAnimacao = useRef<ReturnType<typeof setTimeout>[]>([])
  const protecaoManual = useRef<boolean>(false)
  const supabaseRef = useRef(createClient())

  const registrarBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(IDLE_SPLASH_LOCK_KEY, '1')
  }, [])

  const limparBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(IDLE_SPLASH_LOCK_KEY)
  }, [])

  const limparTimersAnimacao = useCallback(() => {
    timersAnimacao.current.forEach(clearTimeout)
    timersAnimacao.current = []
  }, [])

  const resetarTimer = useCallback(() => {
    if (timerInatividade.current) {
      clearTimeout(timerInatividade.current)
    }

    if (ativo || dispensando) return

    timerInatividade.current = setTimeout(() => {
      setAtivo(true)
      setFase('inicio')
      setDispensando(false)
      setRequerSenha(false)
      setSenha('')
      setErroSenha(null)
      registrarBloqueioPersistente()
    }, TEMPO_INATIVIDADE)
  }, [ativo, dispensando, registrarBloqueioPersistente])

  const dispensar = useCallback(() => {
    if (!ativo || dispensando) return

    setDispensando(true)
    limparTimersAnimacao()

    setTimeout(() => {
      setAtivo(false)
      setFase('inicio')
      setDispensando(false)
      setRequerSenha(false)
      setSenha('')
      setErroSenha(null)
    }, 600)
  }, [ativo, dispensando, limparTimersAnimacao])

  const solicitarDesbloqueio = useCallback(() => {
    if (!ativo || dispensando) return
    setRequerSenha(true)
    setErroSenha(null)
  }, [ativo, dispensando])

  const atualizarSenha = useCallback((value: string) => {
    setSenha(value)
    setErroSenha(null)
  }, [])

  const cancelarSenha = useCallback(() => {
    setRequerSenha(false)
    setSenha('')
    setErroSenha(null)
  }, [])

  const validarSenha = useCallback(async () => {
    if (verificandoSenha) return
    const senhaLimpa = senha.trim()
    if (!senhaLimpa) {
      setErroSenha('Digite sua senha para desbloquear.')
      return
    }

    setVerificandoSenha(true)
    setErroSenha(null)

    try {
      const supabase = supabaseRef.current
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user?.email) {
        setErroSenha('Sessão indisponível. Faça login novamente.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: senhaLimpa,
      })

      if (signInError) {
        setErroSenha('Senha inválida. Tente novamente.')
        return
      }

      setSenha('')
      setRequerSenha(false)
      setErroSenha(null)
      limparBloqueioPersistente()
      dispensar()
    } catch {
      setErroSenha('Não foi possível validar a senha.')
    } finally {
      setVerificandoSenha(false)
    }
  }, [senha, verificandoSenha, dispensar, limparBloqueioPersistente])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const bloqueado = sessionStorage.getItem(IDLE_SPLASH_LOCK_KEY) === '1'
    if (!bloqueado) return

    setAtivo(true)
    setFase('inicio')
    setDispensando(false)
    setRequerSenha(true)
    setSenha('')
    setErroSenha(null)
  }, [])

  useEffect(() => {
    if (!ativo || dispensando) return

    const CICLO = {
      mostrarC: 200,
      mostrarNome: 1600,
      mostrarSlogan: 3400,
      fadeOut: 6800,
      reinicio: 8000,
    }

    let cancelado = false

    const iniciarCiclo = () => {
      if (cancelado) return

      setFase('inicio')

      const t1 = setTimeout(() => {
        if (!cancelado) setFase('c')
      }, CICLO.mostrarC)
      const t2 = setTimeout(() => {
        if (!cancelado) setFase('nome')
      }, CICLO.mostrarNome)
      const t3 = setTimeout(() => {
        if (!cancelado) setFase('slogan')
      }, CICLO.mostrarSlogan)
      const t4 = setTimeout(() => {
        if (!cancelado) setFase('inicio')
      }, CICLO.fadeOut)
      const t5 = setTimeout(() => {
        if (!cancelado) iniciarCiclo()
      }, CICLO.reinicio)

      timersAnimacao.current = [t1, t2, t3, t4, t5]
    }

    iniciarCiclo()

    return () => {
      cancelado = true
      limparTimersAnimacao()
    }
  }, [ativo, dispensando, limparTimersAnimacao])

  useEffect(() => {
    const eventosDispensar = ['mousedown', 'keydown', 'touchstart', 'pointerdown']
    const eventosResetar = ['mousemove', 'scroll']

    const isAlvoSidebar = (event: Event): boolean => {
      const target = event.target
      if (!(target instanceof Node)) return false
      return Boolean(document.querySelector('[data-sidebar-shell]')?.contains(target))
    }

    const handleDispensar = (event: Event) => {
      if (protecaoManual.current) return
      if (isAlvoSidebar(event)) return
      if (ativo) {
        solicitarDesbloqueio()
      } else {
        resetarTimer()
      }
    }

    const handleResetar = (event: Event) => {
      if (isAlvoSidebar(event)) return
      if (!ativo) {
        resetarTimer()
      }
    }

    const handleActivateSplash = () => {
      if (!ativo && !dispensando) {
        protecaoManual.current = true
        setTimeout(() => {
          protecaoManual.current = false
        }, 1000)
        setAtivo(true)
        setFase('inicio')
        setDispensando(false)
        setRequerSenha(false)
        setSenha('')
        setErroSenha(null)
        registrarBloqueioPersistente()
      }
    }

    eventosDispensar.forEach((e) =>
      window.addEventListener(e, handleDispensar as EventListener, { passive: true }),
    )
    eventosResetar.forEach((e) =>
      window.addEventListener(e, handleResetar as EventListener, { passive: true }),
    )
    window.addEventListener('activateSplash', handleActivateSplash)

    resetarTimer()

    return () => {
      eventosDispensar.forEach((e) => window.removeEventListener(e, handleDispensar as EventListener))
      eventosResetar.forEach((e) => window.removeEventListener(e, handleResetar as EventListener))
      window.removeEventListener('activateSplash', handleActivateSplash)
      if (timerInatividade.current) {
        clearTimeout(timerInatividade.current)
      }
      limparTimersAnimacao()
    }
  }, [
    ativo,
    dispensando,
    solicitarDesbloqueio,
    resetarTimer,
    limparTimersAnimacao,
    registrarBloqueioPersistente,
  ])

  return (
    <IdleSplashContext.Provider
      value={{
        ativo,
        fase,
        dispensando,
        requerSenha,
        senha,
        setSenha: atualizarSenha,
        erroSenha,
        verificandoSenha,
        solicitarDesbloqueio,
        validarSenha,
        cancelarSenha,
      }}
    >
      {children}
    </IdleSplashContext.Provider>
  )
}

export function useIdleSplash(): IdleSplashContextValue {
  const ctx = useContext(IdleSplashContext)
  if (!ctx) {
    throw new Error('useIdleSplash must be used within IdleSplashProvider')
  }
  return ctx
}
