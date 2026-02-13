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
  const protecaoManual = useRef<boolean>(false) // Ignora eventos por 1s após ativação manual

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
        dispensar()
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
  }, [ativo, dispensando, dispensar, resetarTimer, limparTimersAnimacao])

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
        Clique ou pressione qualquer tecla para voltar
      </span>
    </div>
  )
}
