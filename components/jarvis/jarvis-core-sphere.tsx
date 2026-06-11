'use client'

import './jarvis-neural.css'
import { IconMicrophone } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface JarvisCoreSphereProps {
  isListening?: boolean
  listenPaused?: boolean
  wakeStandby?: boolean
  isSpeaking?: boolean
  isProcessing?: boolean
  onMicClick?: () => void
  enableMic?: boolean
  className?: string
}

export function JarvisCoreSphere({
  isListening = false,
  listenPaused = false,
  wakeStandby = true,
  isSpeaking = false,
  isProcessing = false,
  onMicClick,
  enableMic = true,
  className,
}: JarvisCoreSphereProps) {
  const active = isListening || isSpeaking || isProcessing

  return (
    <div
      className={cn(
        'relative flex aspect-square h-full max-h-full w-auto max-w-full items-center justify-center',
        className
      )}
    >
      <span className="jarvis-pulse-expand pointer-events-none absolute inset-[8%] rounded-full border border-[var(--color-core)] opacity-40" />
      <span
        className="jarvis-pulse-expand pointer-events-none absolute inset-[18%] rounded-full border border-[var(--color-pulse)] opacity-25"
        style={{ animationDelay: '1.2s' }}
      />

      <div className="jarvis-ring-outer pointer-events-none absolute inset-[2%] rounded-full border border-[rgba(0,212,255,0.18)]" />
      <div
        className="jarvis-ring-inner pointer-events-none absolute inset-[10%] rounded-full border border-dashed border-[rgba(0,102,255,0.28)]"
      />

      <svg viewBox="0 0 320 320" className="relative z-[1] h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="jarvis-sphere-fill" cx="45%" cy="38%" r="58%">
            <stop offset="0%" stopColor="rgba(0,212,255,0.12)" />
            <stop offset="55%" stopColor="rgba(0,102,255,0.05)" />
            <stop offset="100%" stopColor="rgba(2,11,20,0)" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="160" r="118" fill="url(#jarvis-sphere-fill)" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
        {[0, 30, 60, 90, 120, 150].map((rot) => (
          <ellipse
            key={`m-${rot}`}
            cx="160"
            cy="160"
            rx="118"
            ry="42"
            fill="none"
            stroke="rgba(0,212,255,0.1)"
            strokeWidth="0.6"
            transform={`rotate(${rot} 160 160)`}
          />
        ))}
        {[42, 78, 114].map((ry) => (
          <ellipse
            key={`p-${ry}`}
            cx="160"
            cy="160"
            rx="118"
            ry={ry}
            fill="none"
            stroke="rgba(0,102,255,0.12)"
            strokeWidth="0.5"
          />
        ))}
      </svg>

      {enableMic ? (
        <button
          type="button"
          onClick={onMicClick}
          className={cn(
            'absolute z-[2] flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border transition-all duration-300 sm:h-20 sm:w-20',
            isSpeaking
              ? 'border-[var(--color-alert)] bg-[rgba(255,107,53,0.12)] shadow-[0_0_28px_rgba(255,107,53,0.35)]'
              : isListening
                ? 'border-[var(--color-core)] bg-[rgba(0,212,255,0.1)] shadow-[0_0_32px_rgba(0,212,255,0.4)]'
                : 'border-[rgba(0,212,255,0.35)] bg-[var(--color-surface)] hover:border-[var(--color-core)]'
          )}
          title={
            listenPaused
              ? 'Retomar escuta contínua'
              : isListening
                ? 'Pausar escuta'
                : 'Ativar escuta contínua'
          }
        >
          {(isListening || isSpeaking) && (
            <span className="jarvis-pulse-expand absolute inset-0 rounded-full border border-current opacity-50" />
          )}
          {isSpeaking ? (
            <div className="flex h-6 items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="jarvis-audio-bar w-1 rounded-sm bg-[var(--color-alert)]"
                  style={{ height: '18px' }}
                />
              ))}
            </div>
          ) : (
            <IconMicrophone
              className={cn(
                'relative z-[1] h-7 w-7',
                isListening ? 'text-[var(--color-core)]' : 'text-[rgba(0,212,255,0.55)]'
              )}
              stroke={1.5}
            />
          )}
        </button>
      ) : null}

      {active ? (
        <p className="absolute -bottom-1 font-jarvis-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-dim)]">
          {isSpeaking ? 'síntese' : isListening ? 'escuta' : 'processando'}
        </p>
      ) : null}
    </div>
  )
}
