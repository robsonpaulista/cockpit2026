'use client'

import { useEffect, useId, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, X } from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { useLoginCockpit } from '@/hooks/use-login-cockpit'
import { cn } from '@/lib/utils'
import './cockpit-home.css'

const EASE = [0.22, 1, 0.36, 1] as const
const LETRAS = 'COCKPIT'.split('')
/** Momento (s) em que a revelação da marca termina e as ações aparecem. */
const FIM_REVELACAO = 1.75

type Traco = { x1: number; y1: number; x2: number; y2: number; longo: boolean }

const arred = (n: number) => Math.round(n * 100) / 100

const TRACOS_MOSTRADOR: Traco[] = Array.from({ length: 72 }, (_, i) => {
  const a = (i * 5 * Math.PI) / 180
  const longo = i % 6 === 0
  const r1 = 196
  const r2 = longo ? 180 : 189
  return {
    x1: arred(200 + r1 * Math.sin(a)),
    y1: arred(200 - r1 * Math.cos(a)),
    x2: arred(200 + r2 * Math.sin(a)),
    y2: arred(200 - r2 * Math.cos(a)),
    longo,
  }
})

const campoClass =
  'h-11 w-full rounded-lg border border-[var(--tse-border)] bg-white px-3.5 text-[15px] text-[var(--tse-text)] outline-none transition placeholder:text-[var(--tse-zero)] focus:border-[var(--tse-text)] focus:ring-4 focus:ring-[var(--tse-yellow-soft)]'
const rotuloClass =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--tse-muted)]'

function useRelogioBrasilia(): string | null {
  const [hora, setHora] = useState<string | null>(null)

  useEffect(() => {
    const atualizar = () =>
      setHora(
        new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })
      )
    atualizar()
    const id = window.setInterval(atualizar, 15_000)
    return () => window.clearInterval(id)
  }, [])

  return hora
}

function Mostrador() {
  return (
    <div className="ch-home__mostrador" aria-hidden>
      <svg className="ch-home__mostrador-giro" viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="198" stroke="currentColor" strokeWidth="1" />
        {TRACOS_MOSTRADOR.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="currentColor"
            strokeWidth={t.longo ? 1.6 : 0.8}
          />
        ))}
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 6" />
      </svg>
    </div>
  )
}

export type CockpitHomeProps = {
  /** Abre o cartão de login já na entrada (rota `/login`). */
  loginInicial?: boolean
}

/** Home pública do Cockpit X: marca revelada sobre o amarelo TSE e acesso da equipe. */
export function CockpitHome({ loginInicial = false }: CockpitHomeProps) {
  const reduzir = useReducedMotion() ?? false
  const hora = useRelogioBrasilia()
  const login = useLoginCockpit()
  const tituloId = useId()
  const [loginAberto, setLoginAberto] = useState<boolean>(loginInicial)
  const [revelado, setRevelado] = useState<boolean>(false)
  const [mostrarSenha, setMostrarSenha] = useState<boolean>(false)

  useEffect(() => {
    const id = window.setTimeout(() => setRevelado(true), FIM_REVELACAO * 1000 + 600)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!loginAberto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLoginAberto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginAberto])

  const atrasoAcoes = reduzir || revelado ? 0 : FIM_REVELACAO
  const inicial = <T,>(valor: T): T | false => (reduzir ? false : valor)

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void login.entrar()
  }

  return (
    <main className="ch-home" style={TSE_TOKENS}>
      <div className="ch-home__fundo" aria-hidden>
        <div className="ch-home__grade" />
        <motion.div
          className="absolute inset-0"
          initial={inicial({ opacity: 0, scale: 0.92 })}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        >
          <Mostrador />
        </motion.div>
        <div className="ch-home__brilho" />
      </div>

      <motion.header
        className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-8 sm:pt-6"
        initial={inicial({ opacity: 0, y: -8 })}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6, ease: EASE }}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-white/25 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--tse-text)] backdrop-blur-sm">
          <span className="ch-home__pulso" aria-hidden />
          Sistema online
        </span>
        {hora ? (
          <span className="text-[13px] font-semibold tabular-nums tracking-[0.06em] text-[var(--tse-text)]">
            {hora} <span className="font-medium opacity-60">· Brasília</span>
          </span>
        ) : null}
      </motion.header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-5 py-10">
        <motion.div layout={!reduzir} transition={{ duration: 0.5, ease: EASE }} className="flex flex-col items-center text-center">
          <h1 className="ch-home__marca" aria-label="Cockpit X">
            <span className="inline-flex" aria-hidden>
              {LETRAS.map((letra, i) => (
                <span key={i} className="ch-home__mascara">
                  <motion.span
                    className="inline-block"
                    initial={inicial({ y: '115%' })}
                    animate={{ y: '0%' }}
                    transition={{ delay: 0.35 + i * 0.055, duration: 0.85, ease: EASE }}
                  >
                    {letra}
                  </motion.span>
                </span>
              ))}
            </span>
            <span className="ch-home__x-wrap" aria-hidden>
              {!reduzir ? <span className="ch-home__onda" /> : null}
              <motion.span
                className="ch-home__x"
                initial={inicial({ opacity: 0, scale: 0.2, rotate: -135 })}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                whileHover={reduzir ? undefined : { rotate: 90 }}
                transition={{ delay: 0.95, type: 'spring', stiffness: 240, damping: 15 }}
              >
                X
              </motion.span>
            </span>
          </h1>

          <motion.span
            className="ch-home__linha"
            initial={inicial({ scaleX: 0 })}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.1, duration: 1.1, ease: EASE }}
            aria-hidden
          />

          <motion.p
            className="mt-6 text-[clamp(1rem,2.2vw,1.25rem)] font-semibold tracking-[-0.005em] text-[var(--tse-text)]"
            initial={inicial({ opacity: 0, y: 10 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.7, ease: EASE }}
          >
            Assuma o controle do seu mandato.
          </motion.p>
          <motion.p
            className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ch-tinta-suave)]"
            initial={inicial({ opacity: 0, y: 8 })}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.7, ease: EASE }}
          >
            Comando · Dep. Federal Jadyel Alencar
          </motion.p>
        </motion.div>

        <div className="mt-9 flex w-full flex-col items-center">
          <AnimatePresence mode="wait" initial={!reduzir}>
            {loginAberto ? (
              <motion.form
                key="login"
                onSubmit={enviar}
                aria-labelledby={tituloId}
                className="w-full max-w-[24rem] rounded-2xl bg-white p-6 text-left shadow-[0_28px_70px_-28px_rgba(51,51,51,0.55)]"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: atrasoAcoes, duration: 0.5, ease: EASE } }}
                exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.18 } }}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--tse-yellow-soft)] text-[var(--tse-gold-text)]">
                      <Lock className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </span>
                    <div>
                      <p id={tituloId} className="text-[15px] font-semibold leading-tight text-[var(--tse-text)]">
                        Acesso restrito
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--tse-muted)]">Entre com a sua conta da equipe.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLoginAberto(false)}
                    aria-label="Fechar"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--tse-muted)] transition hover:bg-[var(--tse-bg)] hover:text-[var(--tse-text)]"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor={`${tituloId}-email`} className={rotuloClass}>
                      E-mail
                    </label>
                    <input
                      id={`${tituloId}-email`}
                      type="email"
                      autoComplete="username"
                      autoFocus
                      required
                      value={login.email}
                      onChange={(e) => login.setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className={campoClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${tituloId}-senha`} className={rotuloClass}>
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id={`${tituloId}-senha`}
                        type={mostrarSenha ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={login.senha}
                        onChange={(e) => login.setSenha(e.target.value)}
                        placeholder="••••••••"
                        className={cn(campoClass, 'pr-11')}
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-[var(--tse-muted)] transition hover:text-[var(--tse-text)]"
                      >
                        {mostrarSenha ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer select-none items-start gap-2.5 text-[13px] text-[var(--tse-muted)]">
                    <input
                      type="checkbox"
                      checked={login.lembrar}
                      onChange={(e) => login.setLembrar(e.target.checked)}
                      className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--tse-text)]"
                    />
                    <span>Lembrar neste dispositivo (use só em tablets da equipe)</span>
                  </label>

                  <AnimatePresence initial={false}>
                    {login.erro ? (
                      <motion.p
                        key="erro"
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {login.erro}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={login.carregando}
                    className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--tse-text)] text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {login.carregando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Entrando…
                      </>
                    ) : (
                      <>
                        Entrar no Cockpit
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                key="cta"
                type="button"
                onClick={() => setLoginAberto(true)}
                className="group inline-flex h-12 items-center gap-3 rounded-full bg-[var(--tse-text)] pl-7 pr-2 text-[15px] font-semibold text-white shadow-[0_18px_40px_-18px_rgba(51,51,51,0.7)] transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: atrasoAcoes, duration: 0.55, ease: EASE } }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.97 }}
              >
                Entrar
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--tse-yellow)] text-[var(--tse-text)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:rotate-[-45deg]">
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          <motion.a
            href="/pesquisador/login"
            className="mt-5 text-[13px] font-medium text-[var(--ch-tinta-suave)] underline decoration-[var(--ch-tinta-linha)] underline-offset-4 transition hover:text-[var(--tse-text)] hover:decoration-[var(--tse-text)]"
            initial={inicial({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ delay: FIM_REVELACAO + 0.25, duration: 0.6 }}
          >
            Acesso pesquisadores de campo
          </motion.a>
        </div>
      </div>

      <motion.footer
        className="relative z-10 flex items-center justify-center px-5 pb-5 text-[11px] font-medium tracking-[0.08em] text-[var(--ch-tinta-fraca)] sm:pb-6"
        initial={inicial({ opacity: 0 })}
        animate={{ opacity: 1 }}
        transition={{ delay: FIM_REVELACAO + 0.4, duration: 0.6 }}
      >
        © 2026 Cockpit X · Inteligência, território e operação em um só lugar
      </motion.footer>
    </main>
  )
}
