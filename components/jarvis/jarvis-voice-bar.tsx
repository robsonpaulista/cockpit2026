'use client'

import { useEffect, useState } from 'react'
import { IconMicrophone, IconVideo, IconVideoOff, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { JarvisListeningWave } from '@/components/jarvis/jarvis-listening-wave'
import { cn } from '@/lib/utils'
import { JARVIS_SAUDACAO_LINES, pickJarvisSaudacaoPorHorario } from '@/lib/agent/jarvis-phrases'
import './jarvis-neural.css'

const PLACEHOLDER_HINTS = [
  pickJarvisSaudacaoPorHorario(),
  ...JARVIS_SAUDACAO_LINES,
  'Agenda, pesquisas, alertas.',
  'Ex.: estimulada em Teresina.',
]

interface JarvisVoiceBarProps {
  isListening?: boolean
  listenPaused?: boolean
  wakeStandby?: boolean
  isSpeaking?: boolean
  isProcessing?: boolean
  listeningTranscript?: string
  speechSupported?: boolean
  voiceOutputEnabled?: boolean
  onVoiceOutputChange?: (enabled: boolean) => void
  webcamEnabled?: boolean
  onWebcamChange?: (enabled: boolean) => void
  onMicClick?: () => void
  className?: string
}

export function JarvisVoiceBar({
  isListening = false,
  listenPaused = false,
  wakeStandby = true,
  isSpeaking = false,
  isProcessing = false,
  listeningTranscript = '',
  speechSupported = false,
  voiceOutputEnabled = true,
  onVoiceOutputChange,
  webcamEnabled = true,
  onWebcamChange,
  onMicClick,
  className,
}: JarvisVoiceBarProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [typed, setTyped] = useState('')

  const listeningActive = isListening && !listenPaused && !isSpeaking && !isProcessing
  const listeningCapture = listeningActive && !wakeStandby
  const trimmedTranscript = listeningTranscript.trim()
  const showListeningPanel = listeningCapture

  useEffect(() => {
    if (listeningActive || isSpeaking || isProcessing) return
    const full = PLACEHOLDER_HINTS[hintIndex]
    let i = 0
    setTyped('')
    const id = setInterval(() => {
      i += 1
      setTyped(full.slice(0, i))
      if (i >= full.length) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [hintIndex, listeningActive, isSpeaking, isProcessing])

  useEffect(() => {
    if (listeningActive || isSpeaking || isProcessing) return
    const id = setInterval(() => setHintIndex((h) => (h + 1) % PLACEHOLDER_HINTS.length), 7000)
    return () => clearInterval(id)
  }, [listeningActive, isSpeaking, isProcessing])

  const statusLabel = isSpeaking
    ? 'respondendo'
    : isProcessing
      ? 'interpretando'
      : listenPaused
        ? 'escuta pausada · toque no microfone'
        : listeningCapture
          ? 'modo escuta · fale seu comando'
          : 'iniciando escuta…'

  return (
    <div className={cn('w-full max-w-lg px-1 sm:px-0', className)}>
      {showListeningPanel ? (
        <div
          className="jarvis-listening-panel mb-2 rounded-xl border border-[rgba(0,212,255,0.38)] bg-[rgba(0,212,255,0.08)] px-3 py-2.5 shadow-[0_0_24px_rgba(0,212,255,0.12)] sm:px-4 sm:py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3">
            <JarvisListeningWave variant="capture" barCount={9} className="h-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-jarvis-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-core)] sm:text-[10px]">
                ● escutando agora
              </p>
              <p className="mt-0.5 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)] sm:text-[9px]">
                fale seu pedido · pausa automática ao terminar
              </p>
            </div>
          </div>
          {trimmedTranscript ? (
            <p className="mt-2 border-t border-[rgba(0,212,255,0.14)] pt-2 font-jarvis-ui text-[11px] leading-snug text-[var(--color-text-primary)] sm:text-xs">
              <span className="mr-1 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)]">
                ouvindo:
              </span>
              {trimmedTranscript}
              <span className="jarvis-cursor-blink ml-0.5 inline-block h-[11px] w-[4px] bg-[var(--color-core)] align-middle" />
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-2 px-1 py-1.5 sm:gap-3 sm:px-3 sm:py-2.5">
        {speechSupported ? (
          <button
            type="button"
            onClick={onMicClick}
            className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
              isSpeaking
                ? 'border-[var(--color-alert)] text-[var(--color-alert)]'
                : listeningCapture
                  ? 'border-[var(--color-core)] text-[var(--color-core)] shadow-[0_0_16px_rgba(0,212,255,0.35)]'
                  : 'border-[rgba(0,212,255,0.25)] text-[rgba(0,212,255,0.45)] hover:text-[var(--color-core)]'
            )}
            title="Microfone"
          >
            {listeningCapture && (
              <span className="jarvis-pulse-expand absolute inset-0 rounded-full border border-current" />
            )}
            {isSpeaking ? (
              <div className="flex h-4 items-end gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="jarvis-audio-bar w-0.5 rounded-sm bg-current" style={{ height: 12 }} />
                ))}
              </div>
            ) : listeningCapture ? (
              <JarvisListeningWave variant="capture" barCount={3} className="relative z-[1] h-4" />
            ) : (
              <IconMicrophone className="relative z-[1] h-4 w-4" stroke={1.5} />
            )}
          </button>
        ) : null}
        {onWebcamChange ? (
          <button
            type="button"
            onClick={() => onWebcamChange(!webcamEnabled)}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
              webcamEnabled
                ? 'border-[rgba(0,212,255,0.35)] text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.08)]'
                : 'border-[rgba(0,212,255,0.15)] text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]'
            )}
            title={
              webcamEnabled
                ? 'Desligar preview da câmera'
                : 'Ligar preview da câmera ao escutar'
            }
            aria-pressed={webcamEnabled}
            aria-label={webcamEnabled ? 'Preview da câmera ligado' : 'Preview da câmera desligado'}
          >
            {webcamEnabled ? (
              <IconVideo className="h-4 w-4" stroke={1.5} />
            ) : (
              <IconVideoOff className="h-4 w-4" stroke={1.5} />
            )}
          </button>
        ) : null}
        {onVoiceOutputChange ? (
          <button
            type="button"
            onClick={() => onVoiceOutputChange(!voiceOutputEnabled)}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
              voiceOutputEnabled
                ? 'border-[rgba(0,212,255,0.35)] text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.08)]'
                : 'border-[rgba(0,212,255,0.15)] text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]'
            )}
            title={
              voiceOutputEnabled
                ? 'Desligar resposta por voz (continua ouvindo)'
                : 'Ligar resposta por voz'
            }
            aria-pressed={voiceOutputEnabled}
            aria-label={voiceOutputEnabled ? 'Resposta por voz ligada' : 'Resposta por voz desligada'}
          >
            {voiceOutputEnabled ? (
              <IconVolume className="h-4 w-4" stroke={1.5} />
            ) : (
              <IconVolumeOff className="h-4 w-4" stroke={1.5} />
            )}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate font-jarvis-mono text-[9px] text-[var(--color-text-dim)] sm:text-[10px]">
            {listeningCapture || isSpeaking || isProcessing ? statusLabel : typed}
            {!listeningCapture && !isSpeaking && !isProcessing ? (
              <span className="jarvis-cursor-blink ml-0.5 inline-block h-[10px] w-[4px] bg-[var(--color-core)]" />
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}
