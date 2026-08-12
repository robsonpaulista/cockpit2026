'use client'

import { useEffect, useRef, useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import './preview-home.css'

export type PreviewHomeScreenProps = {
  /**
   * `preview` — rota /preview-home (Entrar abre login).
   * `rest` — tela de descanso (Entrar volta ao Cockpit).
   */
  mode?: 'preview' | 'rest'
  /** Só em `rest` — fecha o overlay / dispensa idle. */
  onEnter?: () => void
  /** Classe extra no root (ex.: overlay fixo). */
  className?: string
}

/**
 * Home cinematográfica — vídeo full-bleed + marca Cockpit 2026.
 * Usada em /preview-home e na tela de descanso do dashboard.
 */
export function PreviewHomeScreen({
  mode = 'preview',
  onEnter,
  className,
}: PreviewHomeScreenProps) {
  const isRest = mode === 'rest'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

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

    if (!isRest && loginOpen) {
      video.pause()
      return
    }

    video.loop = true
    void video.play().catch(() => {
      /* ignore */
    })
  }, [isRest, loginOpen, reducedMotion])

  const handleEnter = () => {
    if (isRest) {
      onEnter?.()
      return
    }
    const video = videoRef.current
    if (video) video.pause()
    setLoginOpen(true)
  }

  const rootClass = [
    'preview-home',
    isRest ? 'preview-home--rest' : '',
    ready ? 'preview-home--ready' : '',
    !isRest && loginOpen ? 'preview-home--login' : '',
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
            src="/videohome.mp4"
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
        aria-hidden={!isRest && loginOpen}
        inert={!isRest && loginOpen ? true : undefined}
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
            {isRest ? 'Entrar no Cockpit' : 'Entrar'}
          </button>
        </div>
      </div>

      {!isRest ? (
        <LoginForm
          variant="floating"
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
        />
      ) : null}
    </main>
  )
}
