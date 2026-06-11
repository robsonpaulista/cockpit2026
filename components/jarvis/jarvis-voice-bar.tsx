'use client'

import { useEffect, useState } from 'react'
import { IconMicrophone, IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { JarvisVoicePicker } from '@/components/jarvis/jarvis-voice-picker'
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
  speechSupported?: boolean
  voiceOutputEnabled?: boolean
  onVoiceOutputChange?: (enabled: boolean) => void
  onMicClick?: () => void
  className?: string
}

export function JarvisVoiceBar({
  isListening = false,
  listenPaused = false,
  wakeStandby = true,
  isSpeaking = false,
  isProcessing = false,
  speechSupported = false,
  voiceOutputEnabled = true,
  onVoiceOutputChange,
  onMicClick,
  className,
}: JarvisVoiceBarProps) {
  const [hintIndex, setHintIndex] = useState(0)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (isListening || isSpeaking || isProcessing) return
    const full = PLACEHOLDER_HINTS[hintIndex]
    let i = 0
    setTyped('')
    const id = setInterval(() => {
      i += 1
      setTyped(full.slice(0, i))
      if (i >= full.length) clearInterval(id)
    }, 28)
    return () => clearInterval(id)
  }, [hintIndex, isListening, isSpeaking, isProcessing])

  useEffect(() => {
    if (isListening || isSpeaking || isProcessing) return
    const id = setInterval(() => setHintIndex((h) => (h + 1) % PLACEHOLDER_HINTS.length), 7000)
    return () => clearInterval(id)
  }, [isListening, isSpeaking, isProcessing])

  const statusLabel = isSpeaking
    ? 'respondendo'
    : isProcessing
      ? 'interpretando'
      : listenPaused
        ? 'escuta pausada · toque no microfone'
        : isListening
          ? wakeStandby
            ? 'escuta ativa · diga jarvis…'
            : 'ouvindo comando…'
          : 'iniciando escuta…'

  return (
    <div className={cn('w-full max-w-lg px-1 sm:px-0', className)}>
      <div className="flex items-center gap-2 px-1 py-1.5 sm:gap-3 sm:px-3 sm:py-2.5">
        {speechSupported ? (
          <button
            type="button"
            onClick={onMicClick}
            className={cn(
              'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all',
              isSpeaking
                ? 'border-[var(--color-alert)] text-[var(--color-alert)]'
                : isListening
                  ? 'border-[var(--color-core)] text-[var(--color-core)] shadow-[0_0_16px_rgba(0,212,255,0.35)]'
                  : 'border-[rgba(0,212,255,0.25)] text-[rgba(0,212,255,0.45)] hover:text-[var(--color-core)]'
            )}
            title="Microfone"
          >
            {isListening && <span className="jarvis-pulse-expand absolute inset-0 rounded-full border border-current" />}
            {isSpeaking ? (
              <div className="flex h-4 items-end gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="jarvis-audio-bar w-0.5 rounded-sm bg-current" style={{ height: 12 }} />
                ))}
              </div>
            ) : (
              <IconMicrophone className="relative z-[1] h-4 w-4" stroke={1.5} />
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
            {isListening || isSpeaking || isProcessing ? statusLabel : typed}
            {!isListening && !isSpeaking && !isProcessing ? (
              <span className="jarvis-cursor-blink ml-0.5 inline-block h-[10px] w-[4px] bg-[var(--color-core)]" />
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-1 rounded px-1 py-1 sm:mt-2 sm:px-2 sm:py-1.5">
        <JarvisVoicePicker
          className="!max-w-none"
          compact
          voiceOutputEnabled={voiceOutputEnabled}
        />
      </div>
    </div>
  )
}
