'use client'

import { useEffect, useState } from 'react'
import { IconMicrophone } from '@tabler/icons-react'
import { JarvisVoicePicker } from '@/components/jarvis/jarvis-voice-picker'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

const PLACEHOLDER_HINTS = [
  'Toque no microfone e fale sua pergunta…',
  'Pesquisas · território · agenda · alertas…',
  'Ex.: pesquisa estimulada em Teresina…',
]

interface JarvisVoiceBarProps {
  isListening?: boolean
  isSpeaking?: boolean
  isProcessing?: boolean
  speechSupported?: boolean
  onMicClick?: () => void
  className?: string
}

export function JarvisVoiceBar({
  isListening = false,
  isSpeaking = false,
  isProcessing = false,
  speechSupported = false,
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
    : isListening
      ? 'ouvindo você'
      : isProcessing
        ? 'interpretando'
        : 'aguardando voz'

  return (
    <div className={cn('w-full max-w-lg', className)}>
      <div className="flex items-center gap-3 px-3 py-2.5">
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
        <div className="min-w-0 flex-1">
          <p className="truncate font-jarvis-mono text-[10px] text-[var(--color-text-dim)]">
            {isListening || isSpeaking || isProcessing ? statusLabel : typed}
            {!isListening && !isSpeaking && !isProcessing ? (
              <span className="jarvis-cursor-blink ml-0.5 inline-block h-[10px] w-[4px] bg-[var(--color-core)]" />
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-2 rounded px-2 py-1.5">
        <JarvisVoicePicker className="!max-w-none" compact />
      </div>
    </div>
  )
}
