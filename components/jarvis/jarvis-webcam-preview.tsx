'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconVideo, IconVideoOff } from '@tabler/icons-react'
import type { JarvisLogLine } from '@/components/jarvis/jarvis-hud-widgets'
import { jarvisDiagnosticLine } from '@/lib/agent/jarvis-diagnostic-log'
import {
  acquireJarvisWebcamStream,
  attachStreamToVideoElement,
  type JarvisWebcamFailureKind,
} from '@/lib/agent/jarvis-webcam'
import { cn } from '@/lib/utils'

export type JarvisWebcamStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'failed'

interface JarvisWebcamPreviewProps {
  active: boolean
  enabled: boolean
  compact?: boolean
  className?: string
  onDiagnosticLog?: (lines: JarvisLogLine[]) => void
}

function failureLabel(kind: JarvisWebcamFailureKind, detail?: string): string {
  switch (kind) {
    case 'denied':
      return 'Câmera bloqueada no navegador'
    case 'not_found':
      return 'Nenhuma câmera detectada'
    case 'in_use':
      return 'Câmera bloqueada ou sem sinal'
    case 'unsupported':
      return 'Câmera não suportada'
    case 'aborted':
      return 'Reabrindo câmera…'
    default:
      return detail?.slice(0, 48) || 'Câmera indisponível'
  }
}

export function JarvisWebcamPreview({
  active,
  enabled,
  compact = false,
  className,
  onDiagnosticLog,
}: JarvisWebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)
  const lastLoggedStatusRef = useRef<string | null>(null)

  const [status, setStatus] = useState<JarvisWebcamStatus>('idle')
  const [failureKind, setFailureKind] = useState<JarvisWebcamFailureKind | null>(null)
  const [failureMessage, setFailureMessage] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    if (retryTimerRef.current != null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    for (const track of streamRef.current?.getTracks() ?? []) {
      track.stop()
    }
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
    setStatus('idle')
    setFailureKind(null)
    setFailureMessage(null)
  }, [])

  const bindStreamToVideo = useCallback(async () => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return false
    const ok = await attachStreamToVideoElement(video, stream)
    if (!ok) {
      setStatus('failed')
      setFailureKind('in_use')
      setFailureMessage('Câmera bloqueada ou sem sinal.')
      return false
    }
    setStatus('active')
    return true
  }, [])

  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node
      if (node && streamRef.current) {
        void bindStreamToVideo()
      }
    },
    [bindStreamToVideo]
  )

  const openStream = useCallback(
    async (session: number, attempt = 0) => {
      if (session !== sessionRef.current) return

      setStatus('starting')
      setFailureKind(null)
      setFailureMessage(null)

      const result = await acquireJarvisWebcamStream()
      if (session !== sessionRef.current) {
        if (result.ok) result.stream.getTracks().forEach((t) => t.stop())
        return
      }

      if (!result.ok) {
        if (result.kind === 'aborted' && attempt < 1) {
          retryTimerRef.current = window.setTimeout(() => {
            void openStream(session, attempt + 1)
          }, 350)
          return
        }
        if (result.kind === 'in_use' && attempt < 1) {
          retryTimerRef.current = window.setTimeout(() => {
            void openStream(session, attempt + 1)
          }, 500)
          return
        }
        setStatus('failed')
        setFailureKind(result.kind)
        setFailureMessage(result.message)
        return
      }

      streamRef.current = result.stream
      const bound = await bindStreamToVideo()
      if (!bound && attempt < 1 && session === sessionRef.current) {
        stopStream()
        retryTimerRef.current = window.setTimeout(() => {
          void openStream(session, attempt + 1)
        }, 400)
      }
    },
    [bindStreamToVideo, stopStream]
  )

  useEffect(() => {
    if (!enabled || !active) {
      sessionRef.current += 1
      lastLoggedStatusRef.current = null
      stopStream()
      return
    }

    const session = ++sessionRef.current
    const startDelay = window.setTimeout(() => {
      void openStream(session)
    }, 280)

    return () => {
      window.clearTimeout(startDelay)
      sessionRef.current += 1
      stopStream()
    }
  }, [enabled, active, openStream, stopStream])

  useEffect(() => {
    if (!onDiagnosticLog) return
    if (!enabled || !active) return

    const key =
      status === 'failed' && failureKind
        ? `failed:${failureKind}`
        : status === 'active'
          ? 'active'
          : status === 'starting'
            ? 'starting'
            : null

    if (!key || lastLoggedStatusRef.current === key) return
    lastLoggedStatusRef.current = key

    if (status === 'active') {
      onDiagnosticLog([jarvisDiagnosticLine('WEBCAM', 'CÂMERA ATIVA', 'success')])
      return
    }

    if (status === 'failed' && failureKind) {
      onDiagnosticLog([
        jarvisDiagnosticLine(
          'WEBCAM',
          failureLabel(failureKind, failureMessage ?? undefined).toUpperCase(),
          'warn'
        ),
      ])
    }
  }, [active, enabled, failureKind, failureMessage, onDiagnosticLog, status])

  if (!enabled) return null
  if (!active && status === 'idle') return null

  const showVideo = status === 'active'
  const showLoading = status === 'starting'
  const hint =
    status === 'failed' && failureKind
      ? failureLabel(failureKind, failureMessage ?? undefined)
      : null
  const title = hint || (showVideo ? 'Câmera ativa' : 'Abrindo câmera…')

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-full border border-[rgba(0,212,255,0.35)] bg-[var(--color-deep)] shadow-[0_0_12px_rgba(0,212,255,0.15)]',
        compact ? 'h-10 w-10' : 'h-14 w-14 sm:h-16 sm:w-16',
        className
      )}
      aria-label="Preview da webcam da IA Cockpit"
      title={title}
    >
      <video
        ref={setVideoNode}
        muted
        playsInline
        autoPlay
        className={cn(
          'h-full w-full object-cover scale-x-[-1]',
          showVideo ? 'opacity-100' : 'opacity-0'
        )}
      />

      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1 text-center">
          {showLoading ? (
            <span className="jarvis-pulse-expand absolute inset-1 rounded-full border border-[var(--color-core)] opacity-40" />
          ) : null}
          <IconVideoOff
            className={cn(
              'text-[var(--color-text-dim)]',
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              (showLoading || status === 'failed') && 'text-[var(--color-core)]'
            )}
            stroke={1.5}
            aria-hidden
          />
        </div>
      ) : (
        <span
          className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] text-[var(--color-online)]"
          title="Câmera ativa"
        >
          <IconVideo className="h-2.5 w-2.5" stroke={2} aria-hidden />
        </span>
      )}
    </div>
  )
}
