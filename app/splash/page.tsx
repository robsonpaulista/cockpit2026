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
    background: 'linear-gradient(145deg, #e85a10 0%, #de5a12 40%, #b84311 100%)',
    zIndex: 9999,
    overflow: 'hidden',
  }

  // Antes de montar, tudo invisível (fundo laranja já aparece)
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
          background: #de5a12 !important;
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
          background: linear-gradient(145deg, #e85a10 0%, #de5a12 40%, #b84311 100%);
          z-index: 9999;
          overflow: hidden;
        }

        .splash-container::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Na saída, o container mantém o fundo laranja — só o conteúdo some */
        .splash-container.saida .splash-logo-area,
        .splash-container.saida .splash-divider,
        .splash-container.saida .splash-slogan,
        .splash-container.saida .splash-barra-container {
          animation: splash-saida-conteudo 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .splash-logo-area {
          display: flex;
          align-items: baseline;
          gap: 0;
          margin-bottom: 28px;
        }

        .splash-c {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 5.5rem;
          font-weight: 800;
          color: white;
          line-height: 1;
          opacity: 0;
          text-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .splash-c.visivel {
          animation: splash-c-in 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .splash-ockpit {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 5.5rem;
          font-weight: 800;
          color: white;
          line-height: 1;
          opacity: 0;
          text-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }

        .splash-ockpit.visivel {
          animation: splash-nome-in 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .splash-ano {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 2rem;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1;
          margin-left: 12px;
          opacity: 0;
          align-self: flex-end;
          padding-bottom: 8px;
        }

        .splash-ano.visivel {
          animation: splash-slogan-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 0.3s;
        }

        .splash-divider {
          width: 60px;
          height: 2px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 1px;
          margin-bottom: 20px;
          opacity: 0;
          transform: scaleX(0);
          transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .splash-divider.visivel {
          opacity: 1;
          transform: scaleX(1);
        }

        .splash-slogan {
          font-family: 'DM Sans', 'Inter', sans-serif;
          font-size: 1.15rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0;
        }

        .splash-slogan.visivel {
          animation: splash-slogan-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .splash-barra-container {
          position: absolute;
          bottom: 60px;
          width: 200px;
          height: 3px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 2px;
          overflow: hidden;
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .splash-barra-container.visivel {
          opacity: 1;
        }

        .splash-barra-fill {
          height: 100%;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 2px;
          animation: splash-barra-progress 4.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        /* ===== Sombra de carro de corrida passando ===== */
        @keyframes splash-carro-passando {
          0% {
            transform: translateY(-50%) translateX(calc(-100% - 60px));
          }
          100% {
            transform: translateY(-50%) translateX(calc(100vw + 60px));
          }
        }

        @keyframes splash-speed-line-pass {
          0% {
            transform: scaleX(0);
            opacity: 0;
          }
          15% {
            opacity: 0.5;
          }
          100% {
            transform: scaleX(1);
            opacity: 0;
          }
        }

        .splash-carro-wrapper {
          position: absolute;
          top: 50%;
          left: 0;
          width: 380px;
          height: 105px;
          pointer-events: none;
          z-index: 2;
          filter: blur(3px);
          transform: translateY(-50%) translateX(calc(-100% - 60px));
          animation: splash-carro-passando 1.5s cubic-bezier(0.12, 0.72, 0.28, 1) forwards;
          animation-delay: 2.0s;
        }

        .splash-carro-wrapper svg {
          width: 100%;
          height: 100%;
        }

        .splash-speed-lines-container {
          position: absolute;
          top: 36%;
          left: 0;
          right: 0;
          height: 28%;
          pointer-events: none;
          z-index: 1;
          overflow: hidden;
        }

        .splash-speed-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 20%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.25) 80%, transparent 100%);
          transform-origin: left center;
          transform: scaleX(0);
          opacity: 0;
          animation: splash-speed-line-pass 1.2s cubic-bezier(0.22, 0.68, 0.35, 1) forwards;
        }

        .splash-speed-line:nth-child(1) { top: 8%; animation-delay: 2.1s; }
        .splash-speed-line:nth-child(2) { top: 28%; animation-delay: 2.25s; height: 1px; }
        .splash-speed-line:nth-child(3) { top: 50%; animation-delay: 2.05s; }
        .splash-speed-line:nth-child(4) { top: 72%; animation-delay: 2.3s; height: 1px; }
        .splash-speed-line:nth-child(5) { top: 92%; animation-delay: 2.15s; }

        @media (max-width: 640px) {
          .splash-c,
          .splash-ockpit {
            font-size: 3.5rem;
          }
          .splash-ano {
            font-size: 1.3rem;
            margin-left: 8px;
            padding-bottom: 4px;
          }
          .splash-slogan {
            font-size: 0.85rem;
            padding: 0 20px;
            text-align: center;
          }
          .splash-carro-wrapper {
            width: 240px;
            height: 68px;
          }
        }
      `}</style>

      <div className={`splash-container ${fase === 'saida' ? 'saida' : ''}`}>
        {/* Sombra de carro de corrida passando */}
        <div className="splash-carro-wrapper">
          <svg viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
            <path fill="rgba(0,0,0,0.14)" d="M5,52 L30,52 L38,44 L55,34 L80,24 L120,16 L160,12 L185,12 L198,16 L204,24 L210,14 L230,10 L260,10 L285,14 L310,24 L330,38 L340,48 L345,52 L395,52 L395,58 L350,58 C346,44 334,38 322,38 C310,38 298,44 294,58 L106,58 C102,44 90,38 78,38 C66,38 54,44 50,58 L5,58 Z"/>
            <path fill="rgba(0,0,0,0.14)" d="M330,38 L335,16 L340,6 L360,4 L362,8 L345,10 L340,18 L338,38 Z"/>
            <circle fill="rgba(0,0,0,0.14)" cx="78" cy="52" r="12"/>
            <circle fill="rgba(0,0,0,0.14)" cx="322" cy="52" r="12"/>
          </svg>
        </div>

        {/* Linhas de velocidade */}
        <div className="splash-speed-lines-container">
          <div className="splash-speed-line" />
          <div className="splash-speed-line" />
          <div className="splash-speed-line" />
          <div className="splash-speed-line" />
          <div className="splash-speed-line" />
        </div>

        {/* Logo animado */}
        <div className="splash-logo-area">
          <span className={`splash-c ${fase !== 'inicio' ? 'visivel' : ''}`}>C</span>
          <span className={`splash-ockpit ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>ockpit</span>
          <span className={`splash-ano ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>2026</span>
        </div>

        {/* Divisor */}
        <div className={`splash-divider ${fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`} />

        {/* Slogan */}
        <span className={`splash-slogan ${fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>
          Comando Central de Eleições Dep Fed Jadyel Alencar
        </span>

        {/* Barra de progresso sutil */}
        <div className={`splash-barra-container ${fase === 'nome' || fase === 'slogan' || fase === 'saida' ? 'visivel' : ''}`}>
          <div className="splash-barra-fill" />
        </div>
      </div>
    </>
  )
}
