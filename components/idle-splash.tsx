'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const TEMPO_INATIVIDADE = 10 * 60 * 1000 // 10 minutos
const IDLE_SPLASH_LOCK_KEY = 'idle_splash_locked_v1'

/**
 * Screensaver por inatividade.
 * Após 10 minutos sem interação, exibe a splash animada como overlay.
 * Qualquer clique ou tecla dispensa o overlay e volta para onde o usuário estava.
 */
export function IdleSplash() {
  const [ativo, setAtivo] = useState<boolean>(false)
  const [fase, setFase] = useState<'inicio' | 'c' | 'nome' | 'slogan'>('inicio')
  const [dispensando, setDispensando] = useState<boolean>(false)
  const [requerSenha, setRequerSenha] = useState<boolean>(false)
  const [senha, setSenha] = useState<string>('')
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [verificandoSenha, setVerificandoSenha] = useState<boolean>(false)

  const timerInatividade = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timersAnimacao = useRef<ReturnType<typeof setTimeout>[]>([])
  const protecaoManual = useRef<boolean>(false) // Ignora eventos por 1s após ativação manual
  const supabaseRef = useRef(createClient())

  const registrarBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(IDLE_SPLASH_LOCK_KEY, '1')
  }, [])

  const limparBloqueioPersistente = useCallback(() => {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(IDLE_SPLASH_LOCK_KEY)
  }, [])

  // Limpar timers de animação
  const limparTimersAnimacao = useCallback(() => {
    timersAnimacao.current.forEach(clearTimeout)
    timersAnimacao.current = []
  }, [])

  // Resetar timer de inatividade
  const resetarTimer = useCallback(() => {
    if (timerInatividade.current) {
      clearTimeout(timerInatividade.current)
    }

    // Não reiniciar se está ativo ou dispensando
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

  // Dispensar o screensaver
  const dispensar = useCallback(() => {
    if (!ativo || dispensando) return

    setDispensando(true)
    limparTimersAnimacao()

    // Fade out suave, depois limpar tudo
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

  // Se a página for recarregada enquanto a splash estava bloqueando, restaura o bloqueio imediatamente.
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

  // Ciclo de animação contínuo (loop enquanto ativo)
  useEffect(() => {
    if (!ativo || dispensando) return

    // Duração de cada ciclo completo: ~8s
    const CICLO = {
      mostrarC: 200,
      mostrarNome: 1600,
      mostrarSlogan: 3400,
      pausaNoSlogan: 6000,  // slogan fica visível por ~2.6s
      fadeOut: 6800,         // fade out antes de reiniciar
      reinicio: 8000,        // reinicia o ciclo
    }

    let cancelado = false

    const iniciarCiclo = () => {
      if (cancelado) return

      setFase('inicio')

      const t1 = setTimeout(() => { if (!cancelado) setFase('c') }, CICLO.mostrarC)
      const t2 = setTimeout(() => { if (!cancelado) setFase('nome') }, CICLO.mostrarNome)
      const t3 = setTimeout(() => { if (!cancelado) setFase('slogan') }, CICLO.mostrarSlogan)
      // Fade out: volta para 'inicio' (os elementos fazem fade out via CSS transition)
      const t4 = setTimeout(() => { if (!cancelado) setFase('inicio') }, CICLO.fadeOut)
      // Reinicia o ciclo
      const t5 = setTimeout(() => { if (!cancelado) iniciarCiclo() }, CICLO.reinicio)

      timersAnimacao.current = [t1, t2, t3, t4, t5]
    }

    iniciarCiclo()

    return () => {
      cancelado = true
      limparTimersAnimacao()
    }
  }, [ativo, dispensando, limparTimersAnimacao])

  // Listeners de atividade do usuário
  useEffect(() => {
    // Eventos que DISPENSAM a splash (ação intencional: click, tecla, toque)
    const eventosDispensar = ['mousedown', 'keydown', 'touchstart', 'pointerdown']
    // Eventos que apenas RESETAM o timer de inatividade (movimento passivo)
    const eventosResetar = ['mousemove', 'scroll']

    const handleDispensar = () => {
      if (protecaoManual.current) return
      if (ativo) {
        solicitarDesbloqueio()
      } else {
        resetarTimer()
      }
    }

    const handleResetar = () => {
      if (!ativo) {
        resetarTimer()
      }
      // Se ativo, mousemove/scroll NÃO dispensam — só click/tecla dispensam
    }

    // Ativação manual via evento customizado (sidebar, atalho, etc.)
    const handleActivateSplash = () => {
      if (!ativo && !dispensando) {
        protecaoManual.current = true
        setTimeout(() => { protecaoManual.current = false }, 1000)
        setAtivo(true)
        setFase('inicio')
        setDispensando(false)
        setRequerSenha(false)
        setSenha('')
        setErroSenha(null)
        registrarBloqueioPersistente()
      }
    }

    eventosDispensar.forEach(e => window.addEventListener(e, handleDispensar, { passive: true }))
    eventosResetar.forEach(e => window.addEventListener(e, handleResetar, { passive: true }))
    window.addEventListener('activateSplash', handleActivateSplash)

    // Iniciar timer pela primeira vez
    resetarTimer()

    return () => {
      eventosDispensar.forEach(e => window.removeEventListener(e, handleDispensar))
      eventosResetar.forEach(e => window.removeEventListener(e, handleResetar))
      window.removeEventListener('activateSplash', handleActivateSplash)
      if (timerInatividade.current) {
        clearTimeout(timerInatividade.current)
      }
      limparTimersAnimacao()
    }
  }, [ativo, dispensando, solicitarDesbloqueio, resetarTimer, limparTimersAnimacao, registrarBloqueioPersistente])

  if (!ativo) return null

  return (
    <>
      <div
        onClick={solicitarDesbloqueio}
        onKeyDown={solicitarDesbloqueio}
        style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #e85a10 0%, #de5a12 40%, #b84311 100%)',
        zIndex: 99999,
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: dispensando ? 0 : 1,
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      role="button"
      tabIndex={0}
      aria-label="Clique ou pressione qualquer tecla para voltar"
    >
      {/* Efeito de luz radial */}
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

      {/* Logo animado */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 0,
          marginBottom: '28px',
        }}
      >
        {/* C */}
        <span
          style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: '5.5rem',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            textShadow: '0 4px 20px rgba(0,0,0,0.15)',
            opacity: fase !== 'inicio' ? 1 : 0,
            transform: fase !== 'inicio' ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-15deg)',
            transition: 'opacity 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          C
        </span>

        {/* ockpit */}
        <span
          style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: '5.5rem',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            textShadow: '0 4px 20px rgba(0,0,0,0.15)',
            opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
            transform: fase === 'nome' || fase === 'slogan' ? 'translateX(0)' : 'translateX(-20px)',
            letterSpacing: fase === 'nome' || fase === 'slogan' ? '0.05em' : '0.3em',
            transition: 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 1s cubic-bezier(0.22, 1, 0.36, 1), letter-spacing 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          ockpit
        </span>

        {/* 2026 */}
        <span
          style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: '2rem',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: 1,
            marginLeft: '12px',
            alignSelf: 'flex-end',
            paddingBottom: '8px',
            opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
            transform: fase === 'nome' || fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
            transition: 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
          }}
        >
          2026
        </span>
      </div>

      {/* Divisor */}
      <div
        style={{
          width: '60px',
          height: '2px',
          background: 'rgba(255, 255, 255, 0.4)',
          borderRadius: '1px',
          marginBottom: '20px',
          opacity: fase === 'slogan' ? 1 : 0,
          transform: fase === 'slogan' ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Slogan */}
      <span
        style={{
          fontFamily: "'DM Sans', 'Inter', sans-serif",
          fontSize: '1.15rem',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.85)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
          opacity: fase === 'slogan' ? 1 : 0,
          transform: fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
          transition: 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        Comando Central de Eleições Dep Fed Jadyel Alencar
      </span>

      {/* Instrução para voltar */}
      <span
        style={{
          position: 'absolute',
          bottom: '40px',
          fontFamily: "'DM Sans', 'Inter', sans-serif",
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.4)',
          letterSpacing: '0.08em',
          opacity: fase === 'slogan' ? 1 : 0,
          transition: 'opacity 1.2s ease 0.5s',
        }}
      >
        Clique ou pressione qualquer tecla para desbloquear
      </span>

      {requerSenha && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.35)',
            zIndex: 20,
            cursor: 'default',
            padding: '16px',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void validarSenha()
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: 'rgba(255,255,255,0.13)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '14px',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              padding: '18px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: '6px',
                fontFamily: "'Outfit', 'Inter', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                color: 'white',
              }}
            >
              Confirmação de segurança
            </p>
            <p
              style={{
                margin: 0,
                marginBottom: '12px',
                fontFamily: "'DM Sans', 'Inter', sans-serif",
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.82)',
              }}
            >
              Digite sua senha para desbloquear a tela.
            </p>

            <input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value)
                setErroSenha(null)
              }}
              autoFocus
              placeholder="Sua senha"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.18)',
                color: 'white',
                outline: 'none',
                fontSize: '0.9rem',
              }}
            />

            {erroSenha && (
              <p
                style={{
                  marginTop: '8px',
                  marginBottom: 0,
                  fontSize: '0.8rem',
                  color: '#ffe4e4',
                }}
              >
                {erroSenha}
              </p>
            )}

            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRequerSenha(false)
                  setSenha('')
                  setErroSenha(null)
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void validarSenha()}
                disabled={verificandoSenha}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'white',
                  color: '#b84311',
                  cursor: verificandoSenha ? 'not-allowed' : 'pointer',
                  opacity: verificandoSenha ? 0.7 : 1,
                  fontWeight: 600,
                }}
              >
                {verificandoSenha ? 'Validando...' : 'Desbloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  )
}
