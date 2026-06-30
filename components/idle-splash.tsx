'use client'

import { useIdleSplash } from '@/contexts/idle-splash-context'
import { useSidebar } from '@/contexts/sidebar-context'
import {
  REST_SCREEN_AMBER_DARK,
  REST_SCREEN_GRADIENT,
  REST_SCREEN_RADIAL_GLOW,
} from '@/lib/rest-screen-chrome'
import { isSidebarIconOnly } from '@/lib/sidebar-layout'
import { cn } from '@/lib/utils'

const SLOGAN = 'Comando Central de Eleições Dep Fed Jadyel Alencar'

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
        'fixed top-0 right-0 bottom-0 z-[75] flex cursor-pointer flex-col items-center justify-center overflow-hidden px-4 py-8 sm:py-10',
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
        className="pointer-events-none absolute -left-1/2 -top-1/2 h-[200%] w-[200%]"
        style={{ background: REST_SCREEN_RADIAL_GLOW }}
      />

      <div className="relative z-[1] flex w-full max-w-lg flex-col items-center">
        <div className="mb-6 flex items-baseline justify-center gap-0 sm:mb-7">
          <span
            className="font-sans text-[3rem] font-extrabold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[opacity,transform] duration-700 sm:text-[4.5rem] lg:text-[5.5rem]"
            style={{
              opacity: fase !== 'inicio' ? 1 : 0,
              transform: fase !== 'inicio' ? 'scale(1) rotate(0deg)' : 'scale(0.3) rotate(-15deg)',
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            C
          </span>

          <span
            className="font-sans text-[3rem] font-extrabold leading-none text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-[opacity,transform,letter-spacing] duration-700 sm:text-[4.5rem] lg:text-[5.5rem]"
            style={{
              opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
              transform: fase === 'nome' || fase === 'slogan' ? 'translateX(0)' : 'translateX(-20px)',
              letterSpacing: fase === 'nome' || fase === 'slogan' ? '0.05em' : '0.3em',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            ockpit
          </span>

          <span
            className="ml-2 self-end pb-1 font-sans text-[1.1rem] font-light leading-none text-white/60 transition-[opacity,transform] duration-700 sm:ml-3 sm:pb-2 sm:text-[2rem]"
            style={{
              opacity: fase === 'nome' || fase === 'slogan' ? 1 : 0,
              transform: fase === 'nome' || fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
              transitionDelay: '0.3s',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            2026
          </span>
        </div>

        <div
          className="mb-4 h-0.5 w-14 rounded-full bg-white/40 transition-[opacity,transform] duration-700 sm:mb-5"
          style={{
            opacity: fase === 'slogan' ? 1 : 0,
            transform: fase === 'slogan' ? 'scaleX(1)' : 'scaleX(0)',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        <p
          className="w-full max-w-md text-center font-sans text-[0.65rem] font-medium uppercase leading-snug tracking-[0.08em] text-white/85 transition-[opacity,transform] duration-700 sm:text-[1.05rem] sm:leading-normal sm:tracking-[0.15em]"
          style={{
            opacity: fase === 'slogan' ? 1 : 0,
            transform: fase === 'slogan' ? 'translateY(0)' : 'translateY(15px)',
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {SLOGAN}
        </p>

        <p
          className="mt-8 w-full max-w-sm text-center font-sans text-[0.7rem] tracking-[0.06em] text-white/40 transition-opacity duration-1000 sm:absolute sm:bottom-10 sm:left-4 sm:right-4 sm:mt-0 sm:text-[0.8rem] sm:tracking-[0.08em]"
          style={{
            opacity: fase === 'slogan' ? 1 : 0,
            transitionDelay: '0.5s',
          }}
        >
          Clique ou pressione qualquer tecla para desbloquear
        </p>
      </div>

      {requerSenha && (
        <div
          className="absolute inset-0 z-20 flex cursor-default items-center justify-center bg-black/35 p-4"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void validarSenha()
            }
          }}
        >
          <div className="w-full max-w-[420px] rounded-[14px] border border-white/25 bg-white/[0.13] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-[14px] sm:p-[18px]">
            <p className="mb-1.5 font-sans text-base font-bold text-white">Confirmação de segurança</p>
            <p className="mb-3 font-sans text-[0.85rem] text-white/[0.82]">
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
              className="w-full rounded-[10px] border border-white/30 bg-white px-3 py-2.5 text-[0.9rem] text-text-primary outline-none placeholder:text-secondary"
            />

            {erroSenha && <p className="mt-2 text-[0.8rem] text-[#ffe4e4]">{erroSenha}</p>}

            <div className="mt-3.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelarSenha}
                className="w-full rounded-[10px] border border-white/30 bg-white/10 px-3 py-2 text-white sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void validarSenha()}
                disabled={verificandoSenha}
                className="w-full rounded-[10px] border-none px-3 py-2 font-semibold sm:w-auto"
                style={{
                  background: 'rgb(var(--bg-surface))',
                  color: REST_SCREEN_AMBER_DARK,
                  cursor: verificandoSenha ? 'not-allowed' : 'pointer',
                  opacity: verificandoSenha ? 0.7 : 1,
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
