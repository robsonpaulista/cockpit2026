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

const TEMPO_INATIVIDADE = 10 * 60 * 1000 // 10 minutos
const IDLE_SPLASH_LOCK_KEY = 'idle_splash_locked_v1'

type IdleSplashContextValue = {
  ativo: boolean
  dispensar: () => void
}

const IdleSplashContext = createContext<IdleSplashContextValue | null>(null)

export function IdleSplashProvider({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState<boolean>(false)
  const [dispensando, setDispensando] = useState<boolean>(false)

  const timerInatividade = useRef<ReturnType<typeof setTimeout> | null>(null)
  const protecaoManual = useRef<boolean>(false)

  const registrarBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(IDLE_SPLASH_LOCK_KEY, '1')
  }, [])

  const limparBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(IDLE_SPLASH_LOCK_KEY)
  }, [])

  const ativar = useCallback(() => {
    setAtivo(true)
    setDispensando(false)
    registrarBloqueioPersistente()
  }, [registrarBloqueioPersistente])

  const resetarTimer = useCallback(() => {
    if (timerInatividade.current) {
      clearTimeout(timerInatividade.current)
    }

    if (ativo || dispensando) return

    timerInatividade.current = setTimeout(() => {
      ativar()
    }, TEMPO_INATIVIDADE)
  }, [ativo, dispensando, ativar])

  const dispensar = useCallback(() => {
    if (!ativo) return
    limparBloqueioPersistente()
    setAtivo(false)
    setDispensando(false)
  }, [ativo, limparBloqueioPersistente])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const bloqueado = sessionStorage.getItem(IDLE_SPLASH_LOCK_KEY) === '1'
    if (!bloqueado) return
    setAtivo(true)
    setDispensando(false)
  }, [])

  useEffect(() => {
    const eventosAtividade = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'mousemove', 'scroll']

    const isAlvoSidebar = (event: Event): boolean => {
      const target = event.target
      if (!(target instanceof Node)) return false
      return Boolean(document.querySelector('[data-sidebar-shell]')?.contains(target))
    }

    const handleAtividade = (event: Event) => {
      if (protecaoManual.current) return
      if (isAlvoSidebar(event)) return
      // Com a splash ativa, o desbloqueio é só via CTA / Escape da SplashScreen.
      if (ativo) return
      resetarTimer()
    }

    const handleActivateSplash = () => {
      if (!ativo && !dispensando) {
        protecaoManual.current = true
        setTimeout(() => {
          protecaoManual.current = false
        }, 1000)
        ativar()
      }
    }

    eventosAtividade.forEach((e) =>
      window.addEventListener(e, handleAtividade as EventListener, { passive: true }),
    )
    window.addEventListener('activateSplash', handleActivateSplash)

    resetarTimer()

    return () => {
      eventosAtividade.forEach((e) =>
        window.removeEventListener(e, handleAtividade as EventListener),
      )
      window.removeEventListener('activateSplash', handleActivateSplash)
      if (timerInatividade.current) {
        clearTimeout(timerInatividade.current)
      }
    }
  }, [ativo, dispensando, resetarTimer, ativar])

  return (
    <IdleSplashContext.Provider
      value={{
        ativo,
        dispensar,
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
