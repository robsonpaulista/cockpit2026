'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { HOME_SCENE_VIDEO } from '@/lib/rest-screen-chrome'
import './preview-home.css'

export type PreviewHomeScreenProps = {
  /**
   * `preview` — rota /preview-home (Entrar abre login).
   * `rest` — tela de descanso (Entrar volta ao Cockpit).
   * `dashboard` — home autenticada `/dashboard` (Entrar abre o War Room).
   */
  mode?: 'preview' | 'rest' | 'dashboard'
  /** Só em `rest` — fecha o overlay / dispensa idle. */
  onEnter?: () => void
  /** Abre o login flutuante ao montar (ex.: rota legada `/login`). */
  initialLoginOpen?: boolean
  /** Classe extra no root (ex.: overlay fixo). */
  className?: string
}

/**
 * Home cinematográfica — vídeo full-bleed + marca Cockpit 2026.
 * Usada na entrada `/`, `/login`, `/preview-home`, `/dashboard` e descanso.
 */
export function PreviewHomeScreen({
  mode = 'preview',
  onEnter,
  initialLoginOpen = false,
  className,
}: PreviewHomeScreenProps) {
  const router = useRouter()
  const isRest = mode === 'rest'
  const isDashboard = mode === 'dashboard'
  const showLogin = mode === 'preview'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [loginOpen, setLoginOpen] = useState(showLogin && initialLoginOpen)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || reducedMotion) {
      setReady(true)
      return
    }

    const play = () => {
      void video.play().catch(() => {
        /* autoplay bloqueado — poster/primeiro frame permanece */
      })
    }

    if (video.readyState >= 2) play()
    else video.addEventListener('loadeddata', play, { once: true })
    setReady(true)
  }, [reducedMotion])

  useEffect(() => {
    const video = videoRef.current
    if (!video || reducedMotion) return

    if (showLogin && loginOpen) {
      video.pause()
      return
    }

    video.loop = true
    void video.play().catch(() => {
      /* ignore */
    })
  }, [showLogin, loginOpen, reducedMotion])

  const handleEnter = () => {
    if (isRest) {
      onEnter?.()
      return
    }
    if (isDashboard) {
      router.push('/dashboard/war-room')
      return
    }
    const video = videoRef.current
    if (video) video.pause()
    setLoginOpen(true)
  }

  const rootClass = [
    'preview-home',
    isRest ? 'preview-home--rest' : '',
    isDashboard ? 'preview-home--dashboard' : '',
    ready ? 'preview-home--ready' : '',
    showLogin && loginOpen ? 'preview-home--login' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={rootClass} role={isRest ? 'dialog' : undefined} aria-modal={isRest || undefined}>
      <div className="preview-home__media" aria-hidden>
        {!reducedMotion ? (
          <video
            ref={videoRef}
            className="preview-home__video"
            src={HOME_SCENE_VIDEO}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        ) : (
          <div className="preview-home__fallback" />
        )}
        <div className="preview-home__scrim" />
      </div>

      <div
        className="preview-home__content"
        aria-hidden={showLogin && loginOpen}
        inert={showLogin && loginOpen ? true : undefined}
      >
        <p className="preview-home__brand" aria-label="Cockpit 2026">
          <span className="preview-home__brand-name">COCKPIT</span>
          <span className="preview-home__brand-year">2026</span>
        </p>
        <h1 className="preview-home__headline">O centro de comando da campanha</h1>
        <p className="preview-home__lead">
          Inteligência, território e operação em um só lugar.
        </p>
        <div className="preview-home__cta">
          <button type="button" className="preview-home__btn" onClick={handleEnter}>
            {isRest || isDashboard ? 'Entrar no Cockpit' : 'Entrar'}
          </button>
        </div>
      </div>

      {showLogin ? (
        <LoginForm
          variant="floating"
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
        />
      ) : null}
    </main>
  )
}
