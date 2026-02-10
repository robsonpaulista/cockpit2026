'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

const TEMPO_INATIVIDADE = 10 * 60 * 1000 // 10 minutos

/**
 * Screensaver por inatividade.
 * Após 10 minutos sem interação, exibe a splash animada como overlay.
 * Qualquer clique ou tecla dispensa o overlay e volta para onde o usuário estava.
 */
export function IdleSplash() {
  const [ativo, setAtivo] = useState<boolean>(false)
  const [fase, setFase] = useState<'inicio' | 'c' | 'nome' | 'slogan'>('inicio')
  const [dispensando, setDispensando] = useState<boolean>(false)

  const timerInatividade = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timersAnimacao = useRef<ReturnType<typeof setTimeout>[]>([])

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
    }, TEMPO_INATIVIDADE)
  }, [ativo, dispensando])

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
    }, 600)
  }, [ativo, dispensando, limparTimersAnimacao])

  // Iniciar animação quando ativo
  useEffect(() => {
    if (!ativo || dispensando) return

    const t1 = setTimeout(() => setFase('c'), 200)
    const t2 = setTimeout(() => setFase('nome'), 1600)
    const t3 = setTimeout(() => setFase('slogan'), 3400)

    timersAnimacao.current = [t1, t2, t3]

    return () => {
      limparTimersAnimacao()
    }
  }, [ativo, dispensando, limparTimersAnimacao])

  // Listeners de atividade do usuário
  useEffect(() => {
    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown']

    const handleAtividade = () => {
      if (ativo) {
        dispensar()
      } else {
        resetarTimer()
      }
    }

    eventos.forEach(evento => {
      window.addEventListener(evento, handleAtividade, { passive: true })
    })

    // Iniciar timer pela primeira vez
    resetarTimer()

    return () => {
      eventos.forEach(evento => {
        window.removeEventListener(evento, handleAtividade)
      })
      if (timerInatividade.current) {
        clearTimeout(timerInatividade.current)
      }
      limparTimersAnimacao()
    }
  }, [ativo, dispensar, resetarTimer, limparTimersAnimacao])

  if (!ativo) return null

  return (
    <div
      onClick={dispensar}
      onKeyDown={dispensar}
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
        Comando Central de Eleições
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
        Clique ou pressione qualquer tecla para voltar
      </span>
    </div>
  )
}
