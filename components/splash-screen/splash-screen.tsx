'use client'

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'framer-motion'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  SplashHudPanels,
  SplashModuleBoot,
  SplashSystemLines,
} from '@/components/splash-screen/splash-screen-hud'
import { SplashScreenStudio } from '@/components/splash-screen/splash-screen-studio'
import {
  SPLASH_AUTO_ENTER_MS,
  SPLASH_PRELOAD_TIMEOUT_MS,
  SPLASH_READY,
  SPLASH_SCENES,
  SPLASH_START,
  SPLASH_STUDIO_FRAME_MS,
  SPLASH_SUNRISE_ASSET,
  SPLASH_SUNRISE_FALLBACK,
  SPLASH_SYSTEM_LINES,
  SPLASH_TOTAL_MS,
  type SplashSceneId,
} from '@/lib/splash-screen-config'
import { cn } from '@/lib/utils'
import '@/components/splash-screen/splash-screen.css'

const BEEP_AT = SPLASH_SCENES.find((s) => s.id === 'beep')!.at
const PANELS_AT = SPLASH_SCENES.find((s) => s.id === 'panels')!.at
const SYSTEM_AT = SPLASH_SCENES.find((s) => s.id === 'system')!.at
const READY_AT = SPLASH_SCENES.find((s) => s.id === 'ready')!.at

function sceneAtTime(ms: number): SplashSceneId {
  for (let i = SPLASH_SCENES.length - 1; i >= 0; i -= 1) {
    if (ms >= SPLASH_SCENES[i].at) return SPLASH_SCENES[i].id
  }
  return 'start'
}

function sceneSeekTime(sceneId: SplashSceneId, edge: 'start' | 'mid' | 'end'): number {
  const scene = SPLASH_SCENES.find((s) => s.id === sceneId)
  if (!scene) return 0
  if (edge === 'start') return scene.at
  if (edge === 'end') return Math.max(scene.at, scene.until - SPLASH_STUDIO_FRAME_MS)
  return Math.round((scene.at + scene.until) / 2)
}

/** Pré-carrega a foto da cena 6 (com fallback) e as fontes. */
function useSplashPhoto(): { ready: boolean; photoSrc: string | null } {
  const [state, setState] = useState<{ ready: boolean; photoSrc: string | null }>({
    ready: false,
    photoSrc: null,
  })

  useEffect(() => {
    let cancelled = false
    let settled = false

    const settle = (photoSrc: string | null) => {
      if (cancelled || settled) return
      settled = true
      window.clearTimeout(timeoutId)
      setState({ ready: true, photoSrc })
    }

    const timeoutId = window.setTimeout(() => settle(null), SPLASH_PRELOAD_TIMEOUT_MS)

    const tryLoad = (src: string, onFail: () => void) => {
      const img = new window.Image()
      img.onload = () => settle(src)
      img.onerror = onFail
      img.src = src
    }

    tryLoad(SPLASH_SUNRISE_ASSET, () => tryLoad(SPLASH_SUNRISE_FALLBACK, () => settle(null)))
    void document.fonts?.ready?.catch(() => undefined)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  return state
}

export type SplashScreenProps = {
  onComplete: () => void
  className?: string
  /** Desliga auto-avanço na cena final. */
  autoEnter?: boolean
  /** Mantém na splash (reinicia ao clicar no CTA) — útil em preview/dev. */
  holdOnComplete?: boolean
  /** Painel de scrub + frame a frame (rota `/splash-cockpit`). */
  studio?: boolean
  /**
   * Reinicia a animação após N ms de ociosidade na cena final (0/undefined = desativado).
   * Só atua quando `autoEnter` está desligado e fora do modo estúdio.
   */
  idleLoopMs?: number
}

export function SplashScreen({
  onComplete,
  className,
  autoEnter = true,
  holdOnComplete = false,
  studio = false,
  idleLoopMs = 0,
}: SplashScreenProps) {
  const reducedMotion = useReducedMotion()
  const { ready: preloaded, photoSrc } = useSplashPhoto()
  const ctaRef = useRef<HTMLButtonElement>(null)

  const [clockMs, setClockMs] = useState<number>(0)
  const [mode, setMode] = useState<'playing' | 'ready' | 'exit'>('playing')
  const [exiting, setExiting] = useState<boolean>(false)
  const [studioPlaying, setStudioPlaying] = useState<boolean>(false)

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const clockRef = useRef(0)
  const animRef = useRef<AnimationPlaybackControls | null>(null)
  const timelineStartedRef = useRef(false)
  const finishedRef = useRef(false)

  const clockMotion = useMotionValue(0)
  const scene = sceneAtTime(clockMs)
  const isLight = false

  const startOpacity = useTransform(clockMotion, [0, 80, PANELS_AT - 240, PANELS_AT - 20], [1, 1, 1, 0])
  const startScale = useTransform(
    clockMotion,
    [0, BEEP_AT - 120, BEEP_AT, BEEP_AT + 140],
    [1, 1, 0.84, 0.9],
  )
  const flashOpacity = useTransform(
    clockMotion,
    [BEEP_AT - 40, BEEP_AT + 60, BEEP_AT + 160, BEEP_AT + 320],
    [0, 0.28, 0.1, 0],
  )
  const bootRingScale = useTransform(clockMotion, [BEEP_AT - 20, BEEP_AT + 560], [1, 4.4])
  const bootRingOpacity = useTransform(
    clockMotion,
    [BEEP_AT - 20, BEEP_AT + 120, BEEP_AT + 560],
    [0, 0.65, 0],
  )
  const bootRing2Scale = useTransform(clockMotion, [BEEP_AT + 120, BEEP_AT + 720], [1, 4.4])
  const bootRing2Opacity = useTransform(
    clockMotion,
    [BEEP_AT + 120, BEEP_AT + 280, BEEP_AT + 720],
    [0, 0.42, 0],
  )
  // Carro surge sutil já na cena 5 (system) e ganha presença na cena 6.
  const photoOpacity = useTransform(
    clockMotion,
    [SYSTEM_AT + 200, SYSTEM_AT + 800, READY_AT, READY_AT + 1000],
    [0, 0.42, 0.78, 1],
  )
  const photoScale = useTransform(clockMotion, [SYSTEM_AT + 200, SPLASH_TOTAL_MS], [1.08, 1])

  const applyClock = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(SPLASH_TOTAL_MS, ms))
      clockRef.current = clamped
      clockMotion.set(clamped)
      setClockMs(clamped)
      setMode(clamped >= READY_AT ? 'ready' : 'playing')
      setExiting(false)
    },
    [clockMotion],
  )

  const runFrom = useCallback(
    (fromMs: number) => {
      animRef.current?.stop()
      timelineStartedRef.current = true
      const from = Math.max(0, Math.min(SPLASH_TOTAL_MS, fromMs))
      clockRef.current = from
      clockMotion.set(from)
      setClockMs(from)
      setMode(from >= READY_AT ? 'ready' : 'playing')

      animRef.current = animate(clockMotion, SPLASH_TOTAL_MS, {
        duration: (SPLASH_TOTAL_MS - from) / 1000,
        ease: 'linear',
        onUpdate: (v) => {
          clockRef.current = v
          setClockMs(v)
          if (v >= READY_AT) setMode('ready')
        },
        onComplete: () => {
          setStudioPlaying(false)
          setMode('ready')
        },
      })
    },
    [clockMotion],
  )

  const seekTo = useCallback(
    (ms: number) => {
      animRef.current?.stop()
      setStudioPlaying(false)
      applyClock(ms)
    },
    [applyClock],
  )

  const stepClock = useCallback(
    (deltaMs: number) => {
      const next = Math.round((clockRef.current + deltaMs) / SPLASH_STUDIO_FRAME_MS) * SPLASH_STUDIO_FRAME_MS
      seekTo(next)
    },
    [seekTo],
  )

  const playStudio = useCallback(() => {
    setStudioPlaying(true)
    runFrom(clockRef.current >= SPLASH_TOTAL_MS ? 0 : clockRef.current)
  }, [runFrom])

  const pauseStudio = useCallback(() => {
    animRef.current?.stop()
    setStudioPlaying(false)
  }, [])

  const jumpToScene = useCallback(
    (sceneId: SplashSceneId, edge: 'start' | 'mid' | 'end') => {
      seekTo(sceneSeekTime(sceneId, edge))
    },
    [seekTo],
  )

  const restartStudio = useCallback(() => {
    finishedRef.current = false
    timelineStartedRef.current = false
    seekTo(0)
  }, [seekTo])

  const jumpToReady = useCallback(() => {
    animRef.current?.stop()
    setStudioPlaying(false)
    applyClock(READY_AT + 500)
  }, [applyClock])

  const startPress = useCallback(() => {
    if (clockRef.current >= BEEP_AT) return
    runFrom(BEEP_AT - 120)
  }, [runFrom])

  const finish = useCallback(() => {
    if (holdOnComplete) {
      finishedRef.current = false
      timelineStartedRef.current = false
      setExiting(false)
      animRef.current?.stop()
      runFrom(0)
      return
    }
    if (finishedRef.current) return
    finishedRef.current = true
    animRef.current?.stop()
    setExiting(true)
    setMode('exit')
    window.setTimeout(() => onCompleteRef.current(), 380)
  }, [holdOnComplete, runFrom])

  useEffect(() => {
    if (!preloaded) return

    if (studio) {
      applyClock(0)
      return
    }

    if (reducedMotion) {
      jumpToReady()
      return
    }

    runFrom(0)

    return () => {
      animRef.current?.stop()
    }
  }, [preloaded, reducedMotion, studio, jumpToReady, runFrom, applyClock])

  useEffect(() => {
    if (!studio) return

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepClock(-SPLASH_STUDIO_FRAME_MS)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepClock(SPLASH_STUDIO_FRAME_MS)
      } else if (e.key === ' ') {
        e.preventDefault()
        if (studioPlaying) pauseStudio()
        else playStudio()
      } else if (e.key === 'Home') {
        e.preventDefault()
        restartStudio()
      } else if (/^[1-6]$/.test(e.key)) {
        e.preventDefault()
        const s = SPLASH_SCENES[Number(e.key) - 1]
        if (s) jumpToScene(s.id, 'start')
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studio, studioPlaying, stepClock, playStudio, pauseStudio, restartStudio, jumpToScene])

  useEffect(() => {
    if (mode !== 'ready' || finishedRef.current || !autoEnter || studio) return
    const t = window.setTimeout(() => finish(), SPLASH_AUTO_ENTER_MS)
    return () => window.clearTimeout(t)
  }, [mode, finish, autoEnter, studio])

  // Loop por ociosidade: sem interação na cena final, reinicia a animação.
  useEffect(() => {
    if (!idleLoopMs || idleLoopMs <= 0) return
    if (autoEnter || studio || reducedMotion) return
    if (mode !== 'ready' || finishedRef.current) return

    let timerId = 0
    let lastActivity = 0

    const restart = () => {
      finishedRef.current = false
      timelineStartedRef.current = false
      runFrom(0)
    }

    const schedule = () => {
      window.clearTimeout(timerId)
      timerId = window.setTimeout(restart, idleLoopMs)
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastActivity < 1000) return
      lastActivity = now
      schedule()
    }

    schedule()

    const events: (keyof WindowEventMap)[] = [
      'pointerdown',
      'pointermove',
      'keydown',
      'touchstart',
      'wheel',
    ]
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    return () => {
      window.clearTimeout(timerId)
      events.forEach((e) => window.removeEventListener(e, onActivity))
    }
  }, [idleLoopMs, mode, autoEnter, studio, reducedMotion, runFrom])

  useEffect(() => {
    if (mode === 'ready') ctaRef.current?.focus()
  }, [mode])

  const showStart = scene === 'start' || scene === 'beep'
  const showReady = mode === 'ready' || scene === 'ready'
  const showCta = showReady && !exiting
  const sceneLabel = SPLASH_SCENES.find((s) => s.id === scene)?.label ?? ''

  const readyMotion = studio
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      }

  if (!preloaded && !reducedMotion) {
    return <div className={cn('ss-root', className)} aria-busy="true" aria-label="Preparando entrada" />
  }

  return (
    <motion.div
      className={cn(
        'ss-root',
        isLight && 'ss-root--light',
        exiting && 'ss-root--exit',
        studio && 'ss-root--studio',
        className,
      )}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.38, ease: 'easeInOut' }}
      aria-hidden={mode !== 'ready'}
    >
      <button type="button" className="ss-skip" onClick={() => (studio ? seekTo(READY_AT + 500) : jumpToReady())}>
        {SPLASH_START.skip}
      </button>

      <div className="ss-bg-dark" aria-hidden />
      <div className="ss-vignette" aria-hidden />

      {/* Cena 1–2 — botão START + power-on (anéis nascem do botão) */}
      {showStart ? (
        <motion.div className="ss-start" style={{ opacity: startOpacity }}>
          <div className="ss-start__stage">
            <motion.span
              className="ss-start__ring"
              style={{ opacity: bootRingOpacity, scale: bootRingScale }}
              aria-hidden
            />
            <motion.span
              className="ss-start__ring"
              style={{ opacity: bootRing2Opacity, scale: bootRing2Scale }}
              aria-hidden
            />
            <motion.button
              type="button"
              className="ss-start__btn"
              style={{ scale: startScale }}
              onClick={studio ? undefined : startPress}
              aria-label={SPLASH_START.label}
            >
              <span className="ss-start__power" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <path d="M12 3v9" className="ss-start__power-line" />
                  <path d="M6.4 6.4a8 8 0 1 0 11.2 0" className="ss-start__power-arc" />
                </svg>
              </span>
            </motion.button>
          </div>
          <span className="ss-start__label">{SPLASH_START.label}</span>
        </motion.div>
      ) : null}

      {/* Cena 2 — flicker sutil do arranque */}
      <motion.div className="ss-flash" style={{ opacity: flashOpacity }} aria-hidden />

      {/* Cena 3 — painéis HUD */}
      <SplashHudPanels clock={clockMotion} />

      {/* Cena 4 — módulos inicializando */}
      <SplashModuleBoot clock={clockMotion} />

      {/* Cena 5 — texto de sistema */}
      <SplashSystemLines clock={clockMotion} lines={SPLASH_SYSTEM_LINES} />

      {/* Cena 5–6 — carro isolado */}
      {photoSrc ? (
        <motion.div className="ss-sunrise" style={{ opacity: photoOpacity, scale: photoScale }} aria-hidden>
          <Image src={photoSrc} alt="" fill priority sizes="100vw" className="ss-sunrise__photo" />
        </motion.div>
      ) : null}

      {showReady ? (
        <div className="ss-ready">
          <motion.div className="ss-ready__inner" {...readyMotion}>
            <h1 className="ss-ready__brand">
              <span className="ss-ready__brand-strong">COCKPIT</span> 2026
            </h1>
            <p className="ss-ready__tag">{SPLASH_READY.tagline}</p>
            <p className="ss-ready__dest">{SPLASH_READY.destination}</p>
          </motion.div>
          {showCta ? (
            <motion.button
              ref={ctaRef}
              type="button"
              className="ss-cta ss-ready__cta"
              initial={studio ? false : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22, delay: studio ? 0 : 0.15 }}
              onClick={finish}
            >
              {SPLASH_READY.cta}
              <span aria-hidden> ›</span>
            </motion.button>
          ) : null}
        </div>
      ) : null}

      <p className="ss-live" aria-live="polite">
        {mode === 'ready' ? `${SPLASH_READY.cta}. ${SPLASH_READY.tagline}` : sceneLabel}
      </p>

      {studio ? (
        <SplashScreenStudio
          clockMs={clockMs}
          sceneId={scene}
          sceneLabel={sceneLabel}
          playing={studioPlaying}
          onSeek={seekTo}
          onStep={stepClock}
          onPlay={playStudio}
          onPause={pauseStudio}
          onRestart={restartStudio}
          onJumpScene={jumpToScene}
        />
      ) : null}
    </motion.div>
  )
}
