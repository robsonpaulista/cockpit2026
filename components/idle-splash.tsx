'use client'

import { APP_FONT_STACK_CSS } from '@/lib/app-font-stack'
import { useIdleSplash } from '@/contexts/idle-splash-context'
import { useSidebar } from '@/contexts/sidebar-context'
import {
  REST_SCREEN_AMBER_DARK,
  REST_SCREEN_GRADIENT,
  REST_SCREEN_RADIAL_GLOW,
} from '@/lib/rest-screen-chrome'
import { isSidebarIconOnly } from '@/lib/sidebar-layout'
import { cn } from '@/lib/utils'

/**
 * Overlay da tela de descanso — cobre apenas a área principal (não a sidebar).
 * A sidebar permanece visível e bloqueada até a confirmação de senha.
 */
export function IdleSplashOverlay() {
  const {
    ativo,
    fase,
    dispensando,
    requerSenha,
    senha,
    setSenha,
    erroSenha,
    verificandoSenha,
    solicitarDesbloqueio,
    validarSenha,
    cancelarSenha,
  } = useIdleSplash()
  const { collapsed, mobileOpen } = useSidebar()
  const sidebarIconOnly = isSidebarIconOnly(collapsed, mobileOpen)

  if (!ativo) return null

  return (
    <div
      onClick={solicitarDesbloqueio}
      onKeyDown={solicitarDesbloqueio}
      className={cn(
        'fixed top-0 right-0 bottom-0 z-[75] flex cursor-pointer flex-col items-center justify-center overflow-hidden',
        sidebarIconOnly ? 'lg:left-14' : 'lg:left-56',
        'left-0',
      )}
      style={{
        background: REST_SCREEN_GRADIENT,
        opacity: dispensando ? 0 : 1,
        transition: 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      role="button"
      tabIndex={0}
      aria-label="Clique ou pressione qualquer tecla para desbloquear"
    >
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: REST_SCREEN_RADIAL_GLOW,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 0,
          marginBottom: '28px',
        }}
      >
        <span
          style={{
            fontFamily: APP_FONT_STACK_CSS,
            fontSize: '5.5rem',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            textShadow: '0 4px 20px rgba(0,0,0,0.15)',
            opacity: fase !== 'inicio' ? 1 : 0,
            transform: fase !== 'inicio' ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-15deg)',
            transition:
              'opacity 0.7s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          C
        </span>

        <span
          style={{
            fontFamily: APP_FONT_STACK_CSS,
            fontSize: '5.5rem',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1,
            textShadow: '0 4px 20px rgba(0,0,0,0.15)',
            opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
            transform: fase === 'nome' || fase === 'slogan' ? 'translateX(0)' : 'translateX(-20px)',
            letterSpacing: fase === 'nome' || fase === 'slogan' ? '0.05em' : '0.3em',
            transition:
              'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 1s cubic-bezier(0.22, 1, 0.36, 1), letter-spacing 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          ockpit
        </span>

        <span
          style={{
            fontFamily: APP_FONT_STACK_CSS,
            fontSize: '2rem',
            fontWeight: 300,
            color: 'rgba(255, 255, 255, 0.6)',
            lineHeight: 1,
            marginLeft: '12px',
            alignSelf: 'flex-end',
            paddingBottom: '8px',
            opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
            transform: fase === 'nome' || fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
            transition:
              'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
          }}
        >
          2026
        </span>
      </div>

      <div
        style={{
          width: '60px',
          height: '2px',
          background: 'rgba(255, 255, 255, 0.4)',
          borderRadius: '1px',
          marginBottom: '20px',
          opacity: fase === 'slogan' ? 1 : 0,
          transform: fase === 'slogan' ? 'scaleX(1)' : 'scaleX(0)',
          transition:
            'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      <span
        style={{
          fontFamily: APP_FONT_STACK_CSS,
          fontSize: '1.15rem',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.85)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase' as const,
          opacity: fase === 'slogan' ? 1 : 0,
          transform: fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
          transition:
            'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1), transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        Comando Central de Eleições Dep Fed Jadyel Alencar
      </span>

      <span
        style={{
          position: 'absolute',
          bottom: '40px',
          fontFamily: APP_FONT_STACK_CSS,
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
                fontFamily: APP_FONT_STACK_CSS,
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
                fontFamily: APP_FONT_STACK_CSS,
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
                onClick={cancelarSenha}
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
                  background: 'rgb(var(--bg-surface))',
                  color: REST_SCREEN_AMBER_DARK,
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
  )
}

/** @deprecated use IdleSplashOverlay dentro do layout do dashboard */
export function IdleSplash() {
  return <IdleSplashOverlay />
}
