'use client'

import { useEffect, useRef, useState } from 'react'
import {
  HOME_SCENE_PETROL,
  HOME_SCENE_VIDEO,
  HOME_SCENE_VIDEO_END_SEC,
} from '@/lib/rest-screen-chrome'

/**
 * Frame final do videohome como plano de fundo estático (sem playback contínuo).
 * Glass da sidebar/painel deixa a cor da cena aparecer.
 */
export function HomeSceneBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const video = videoRef.current
    if (!video) return

    const freezeAtCut = () => {
      video.pause()
      if (Math.abs(video.currentTime - HOME_SCENE_VIDEO_END_SEC) > 0.05) {
        video.currentTime = HOME_SCENE_VIDEO_END_SEC
      }
    }

    const onLoaded = () => {
      const seek = () => {
        try {
          video.currentTime = HOME_SCENE_VIDEO_END_SEC
        } catch {
          /* ignore */
        }
      }
      seek()
      // Garante frame após seek
      video.addEventListener('seeked', freezeAtCut, { once: true })
      freezeAtCut()
    }

    if (video.readyState >= 1) onLoaded()
    else video.addEventListener('loadedmetadata', onLoaded, { once: true })

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [reducedMotion])

  return (
    <div className="home-scene-backdrop" aria-hidden>
      {!reducedMotion ? (
        <video
          ref={videoRef}
          className="home-scene-backdrop__media"
          src={HOME_SCENE_VIDEO}
          muted
          playsInline
          preload="auto"
          // Congelado no frame final — não autoplay
        />
      ) : (
        <div
          className="home-scene-backdrop__media"
          style={{
            background: `linear-gradient(165deg, #03384a 0%, ${HOME_SCENE_PETROL} 55%, #011820 100%)`,
          }}
        />
      )}
      {/* Scrim leve só para legibilidade do glass — sem pintar de petróleo sólido */}
      <div className="home-scene-backdrop__scrim" />
    </div>
  )
}
