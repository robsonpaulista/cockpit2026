'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [montado, setMontado] = useState(false)
  const [fase, setFase] = useState<'inicio' | 'c' | 'nome' | 'slogan' | 'saida'>('inicio')

  useEffect(() => {
    // Verificar se veio de um login válido
    const authRedirect = localStorage.getItem('auth_redirect')
    if (!authRedirect) {
      router.replace('/login')
      return
    }

    if (authRedirect === 'pesquisador') {
      router.replace('/pesquisador')
      return
    }

    // Marcar como montado e iniciar animação do "C"
    setMontado(true)
    const timerC = setTimeout(() => setFase('c'), 100)

    // Timeline de animação (tempos confortáveis para percepção)
    const timerNome = setTimeout(() => setFase('nome'), 1400)
    const timerSlogan = setTimeout(() => setFase('slogan'), 3200)
    const timerSaida = setTimeout(() => setFase('saida'), 5200)
    const timerNavegar = setTimeout(() => {
      // Sinalizar para o dashboard que deve mostrar overlay de transição
      localStorage.setItem('splash_transition', 'true')
      router.replace('/dashboard')
    }, 6000)

    return () => {
      clearTimeout(timerC)
      clearTimeout(timerNome)
      clearTimeout(timerSlogan)
      clearTimeout(timerSaida)
      clearTimeout(timerNavegar)
    }
  }, [router])

  // Estilos inline críticos para evitar flash de conteúdo sem estilo
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(145deg, rgb(var(--accent-gold)) 0%, rgb(var(--accent-gold)) 40%, rgb(var(--accent-gold-dark)) 100%)',
    zIndex: 9999,
    overflow: 'hidden',
  }

  // Antes de montar, renderiza apenas o ambiente base
  if (!montado) {
    return (
      <div style={containerStyle}>
        {/* Tela laranja pura enquanto monta */}
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        /* Impedir qualquer background do body/html durante splash */
        html, body {
          background: rgb(var(--accent-gold-dark)) !important;
        }

        @keyframes splash-c-in {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-15deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.08) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes splash-nome-in {
          0% {
            opacity: 0;
            transform: translateX(-20px);
            letter-spacing: 0.3em;
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            letter-spacing: 0.05em;
          }
        }

        @keyframes splash-slogan-in {
          0% {
            opacity: 0;
            transform: translateY(15px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes splash-saida-conteudo {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px);
          }
        }

        @keyframes splash-barra-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        .splash-container {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, rgb(var(--accent-gold)) 0%, rgb(var(--accent-gold)) 40%, rgb(var(--accent-gold-dark)) 100%);
          z-index: 9999;
          overflow: hidden;
          isolation: isolate;
        }

        .splash-container::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.16), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .splash-wave {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 140px;
          pointer-events: none;
          background: linear-gradient(
            135deg,
            rgba(var(--accent-gold), 0.22),
            rgba(var(--accent-gold-dark), 0.24),
            rgba(255, 255, 255, 0.18)
          );
          border-top-left-radius: 60% 40%;
          border-top-right-radius: 60% 40%;
          filter: blur(20px);
          z-index: 0;
        }

        .splash-wave-1 {
          opacity: 0.5;
          transform: translateY(10px);
        }

        .splash-wave-2 {
          opacity: 0.3;
          transform: translateY(20px);
        }

        .splash-wave-3 {
          opacity: 0.2;
          transform: translateY(30px);
        }

        .splash-container.saida .splash-card {
          animation: splash-saida-conteudo 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .splash-card {
          position: relative;
          z-index: 1;
          width: min(86vw, 430px);
          min-height: 520px;
          border-radius: 22px;
          padding: 40px 34px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          overflow: hidden;
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.1) 45%, rgba(255, 255, 255, 0.12) 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            0 28px 60px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .splash-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.22), transparent 48%);
          z-index: 0;
        }

        .splash-emblem {
          width: 112px;
          height: 112px;
          border-radius: 24px;
          margin-bottom: 34px;
          display: grid;
          place-items: center;
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.12));
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          position: relative;
          z-index: 1;
        }

        .splash-logo-area {
          display: flex;
          align-items: baseline;
          gap: 0;
          margin-bottom: 24px;
          position: relative;
          z-index: 1;
        }

        .splash-c {
          font-family: var(--font-sans), var(--font-sans-fallback), 'IBM Plex Sans', 'Inter', sans-serif;
          font-size: 4.6rem;
          font-weight: 800;
          color: #eaf2f7;
          background: linear-gradient(
            135deg,
            #ffffff 0%,
            rgba(255, 255, 255, 0.92) 45%,
            rgba(255, 255, 255, 0.72) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1;
          opacity: 0;
          text-shadow: 0 6px 24px rgba(10, 18, 28, 0.28);
        }

        .splash-c.visivel {
          animation: splash-c-in 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .splash-ockpit {
          font-family: var(--font-sans), var(--font-sans-fallback), 'IBM Plex Sans', 'Inter', sans-serif;
          font-size: 4.6rem;
          font-weight: 800;
          color: #eaf2f7;
          background: linear-gradient(
            135deg,
            #ffffff 0%,
            rgba(255, 255, 255, 0.92) 45%,
            rgba(255, 255, 255, 0.72) 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1;
          opacity: 0;
          text-shadow: 0 6px 24px rgba(10, 18, 28, 0.28);
        }

        .splash-ockpit.visivel {
          animation: splash-nome-in 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .splash-ano {
          font-family: var(--font-sans), var(--font-sans-fallback), 'IBM Plex Sans', 'Inter', sans-serif;
          font-size: 2rem;
          font-weight: 300;
          color: rgba(168, 186, 198, 0.8);
          line-height: 1;
          margin-left: 10px;
          opacity: 0;
          align-self: flex-end;
          padding-bottom: 8px;
        }

        .splash-ano.visivel {
          animation: splash-slogan-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 0.3s;
        }

        .splash-divider {
          width: 72px;
          height: 2px;
          background: rgba(168, 186, 198, 0.45);
          border-radius: 1px;
          margin-bottom: 20px;
          opacity: 0;
          transform: scaleX(0);
          transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
          position: relative;
          z-index: 1;
        }

        .splash-divider.visivel {
          opacity: 1;
          transform: scaleX(1);
        }

        .splash-slogan {
          font-family: var(--font-sans), var(--font-sans-fallback), 'IBM Plex Sans', 'Inter', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          color: rgba(168, 186, 198, 0.88);
          letter-spacing: 0.11em;
          text-transform: uppercase;
          opacity: 0;
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 280px;
        }

        .splash-slogan.visivel {
          animation: splash-slogan-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .splash-barra-container {
          position: relative;
          margin-top: 34px;
          width: 220px;
          height: 4px;
          background: rgba(168, 186, 198, 0.22);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.5s ease;
          z-index: 1;
        }

        .splash-barra-container.visivel {
          opacity: 1;
        }

        .splash-barra-fill {
          height: 100%;
          background: linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.82) 55%, rgba(255, 255, 255, 0.58) 100%);
          border-radius: 2px;
          animation: splash-barra-progress 4.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @media (max-width: 640px) {
          .splash-card {
            width: min(90vw, 360px);
            min-height: 470px;
            padding: 32px 20px 24px;
          }

          .splash-emblem {
            width: 92px;
            height: 92px;
            border-radius: 20px;
            margin-bottom: 26px;
          }

          .splash-c,
          .splash-ockpit {
            font-size: 3.2rem;
          }
          .splash-ano {
            font-size: 1.2rem;
            margin-left: 8px;
            padding-bottom: 4px;
          }
          .splash-slogan {
            font-size: 0.76rem;
            padding: 0 8px;
          }
        }
      `}</style>

      <div className={`splash-container ${fase === 'saida' ? 'saida' : ''}`}>
        <div className="splash-card">
          <div className="splash-emblem">
            <span className={`splash-c ${fase !== 'inicio' ? 'visivel' : ''}`}>C</span>
          </div>

          <div className="splash-logo-area">
            <span className={`splash-ockpit ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>ockpit</span>
            <span className={`splash-ano ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>2026</span>
          </div>

          <div className={`splash-divider ${fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`} />

          <span className={`splash-slogan ${fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>
            Comando Central de Eleicoes
          </span>

          <div className={`splash-barra-container ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>
            <div className="splash-barra-fill" />
          </div>

          <div className="splash-wave splash-wave-1" />
          <div className="splash-wave splash-wave-2" />
          <div className="splash-wave splash-wave-3" />
        </div>
      </div>
    </>
  )
}
