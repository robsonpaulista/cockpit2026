'use client'

import { ArrowRight } from 'lucide-react'
import { JarvisCoreSphere } from '@/components/jarvis/jarvis-core-sphere'
import { JarvisFontScope } from '@/components/jarvis/jarvis-fonts'
import { JarvisHudSystemLog, type JarvisLogLine } from '@/components/jarvis/jarvis-hud-widgets'
import { JarvisVoiceBar } from '@/components/jarvis/jarvis-voice-bar'
import { jarvisHudStyle, jarvisPanelClass } from '@/lib/jarvis-hud-tokens'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

interface JarvisHudAction {
  type: 'navigate' | 'link'
  url: string
  label: string
}

interface JarvisHudShellProps {
  statusMessage: string
  isListening?: boolean
  isSpeaking?: boolean
  isProcessing?: boolean
  enableVoice?: boolean
  speechSupported?: boolean
  voiceError?: string | null
  onMicClick?: () => void
  onMinimize?: () => void
  lastAction?: JarvisHudAction
  onActionClick?: (action: JarvisHudAction) => void
  logLines?: JarvisLogLine[]
  className?: string
  style?: React.CSSProperties
}

function StatusTicker({ message }: { message: string }) {
  const parts = message.split('·').map((p) => p.trim()).filter(Boolean)
  const line = parts.length > 1 ? parts.join(' ◆ ') : message

  return (
    <div className="shrink-0 overflow-hidden bg-[var(--color-deep)] py-2">
      <div className="jarvis-ticker-track flex w-max gap-12 whitespace-nowrap px-4 font-jarvis-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
        <span>{line}</span>
        <span aria-hidden>{line}</span>
      </div>
    </div>
  )
}

export function JarvisHudShell({
  statusMessage,
  isListening = false,
  isSpeaking = false,
  isProcessing = false,
  enableVoice = false,
  speechSupported = false,
  voiceError = null,
  onMicClick,
  onMinimize,
  lastAction,
  onActionClick,
  logLines = [],
  className,
  style,
}: JarvisHudShellProps) {
  return (
    <JarvisFontScope
      className={cn(
        'jarvis-hud-grid-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[var(--color-text-primary)]',
        className
      )}
      style={{ ...jarvisHudStyle, ...style } as React.CSSProperties}
    >
      <div className="jarvis-perspective-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="relative flex h-full min-h-0 flex-1 flex-col gap-3 p-2 sm:p-3 lg:flex-row lg:gap-6 lg:p-4">
        <div className="jarvis-stagger relative flex h-full min-h-0 flex-1">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col items-center justify-center py-4 text-center sm:py-6">
            {onMinimize ? (
              <button
                type="button"
                onClick={onMinimize}
                className="absolute right-0 top-0 z-10 rounded px-2 py-0.5 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-core)]"
              >
                recolher
              </button>
            ) : null}

            <div className="flex w-full flex-col items-center gap-3 sm:gap-4">
              <p className="font-jarvis-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-dim)]">
                núcleo ativo
              </p>

              <JarvisCoreSphere
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                onMicClick={onMicClick}
                enableMic={enableVoice && speechSupported}
                className="w-full max-w-[min(100%,clamp(14.5rem,40vh,21rem))]"
              />

              <h1 className="font-jarvis-display text-[clamp(1.35rem,3vh,1.75rem)] font-bold uppercase tracking-[0.3em] text-[var(--color-core)]">
                Jarvis
              </h1>

              {enableVoice && speechSupported ? (
                <JarvisVoiceBar
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  isProcessing={isProcessing}
                  speechSupported={speechSupported}
                  onMicClick={onMicClick}
                  className="w-full"
                />
              ) : null}

              {voiceError ? (
                <p className="font-jarvis-mono text-[9px] leading-snug text-[var(--color-alert)]" role="alert">
                  {voiceError}
                </p>
              ) : null}

              {lastAction && onActionClick ? (
                <button
                  type="button"
                  onClick={() => onActionClick(lastAction)}
                  className={cn(
                    jarvisPanelClass,
                    'flex items-center gap-2 px-3 py-1.5 font-jarvis-mono text-[9px] uppercase tracking-wider text-[var(--color-core)]'
                  )}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {lastAction.label}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="jarvis-stagger flex h-full min-h-0 w-full shrink-0 flex-col lg:w-[min(100%,20rem)] xl:w-[min(100%,22rem)]">
          <JarvisHudSystemLog
            extraLines={logLines}
            processing={isProcessing}
            className="min-h-[10rem] flex-1 lg:min-h-0"
          />
        </div>
      </div>

      <StatusTicker message={statusMessage} />
    </JarvisFontScope>
  )
}
