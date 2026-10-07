'use client'

import { useEffect, useRef, useState } from 'react'
import {
  HOME_SCENE_IMAGE,
  HOME_SCENE_MEDIA,
  HOME_SCENE_VIDEO,
} from '@/lib/rest-screen-chrome'
import './preview-home.css'

export type PreviewHomeScreenProps = {
  /** Fecha o overlay / dispensa o idle. */
  onEnter: () => void
}

/**
 * Tela de descanso do dashboard — cena full-bleed + marca Cockpit 2026.
 * Aberta pelo botão "Tela de descanso" da sidebar e por inatividade.
 */
export function PreviewHomeScreen({ onEnter }: PreviewHomeScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState<boolean>(false)
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const useImage = HOME_SCENE_MEDIA === 'image' || reducedMotion

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (useImage) {
      setReady(true)
      return
    }
    const video = videoRef.current
    if (!video) {
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
  }, [useImage])

  const rootClass = [
    'preview-home',
    'preview-home--rest',
    useImage ? 'preview-home--still' : '',
    ready ? 'preview-home--ready' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className={rootClass} role="dialog" aria-modal>
      <div className="preview-home__media" aria-hidden>
        {useImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- asset estático em /public
          <img
            className="preview-home__still"
            src={HOME_SCENE_IMAGE}
            alt=""
            decoding="async"
          />
        ) : (
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
        )}
        <div className="preview-home__scrim" />
      </div>

      <div className="preview-home__content">
        <p className="preview-home__brand" aria-label="Cockpit 2026">
          <span className="preview-home__brand-name">COCKPIT</span>
          <span className="preview-home__brand-year">2026</span>
        </p>
        <h1 className="preview-home__headline">O centro de comando da campanha</h1>
        <p className="preview-home__lead">
          Inteligência, território e operação em um só lugar.
        </p>
        <div className="preview-home__cta">
          <button type="button" className="preview-home__btn" onClick={onEnter}>
            Entrar no Cockpit
          </button>
        </div>
      </div>

      <p className="preview-home__ai-credit">
        Imagem gerada por inteligência artificial · Gemini
      </p>
    </main>
  )
}
