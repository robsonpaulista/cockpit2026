'use client'

import { ArrowRight } from 'lucide-react'
import { JarvisCoreSphere } from '@/components/jarvis/jarvis-core-sphere'
import { JarvisFontScope } from '@/components/jarvis/jarvis-fonts'
import {
  JarvisHudMetricsBar,
  JarvisHudSystemLog,
  type JarvisLogLine,
} from '@/components/jarvis/jarvis-hud-widgets'
import { JarvisResultPanel } from '@/components/jarvis/jarvis-result-panel'
import { JarvisVoiceBar } from '@/components/jarvis/jarvis-voice-bar'
import type { JarvisResultView } from '@/lib/agent/jarvis-result-view'
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
  resultPanel?: {
    view: JarvisResultView
    action?: JarvisHudAction
  } | null
  onResultPanelClose?: () => void
  onResultPanelAction?: (action: JarvisHudAction) => void
  className?: string
  style?: React.CSSProperties
}

function StatusTicker({ message }: { message: string }) {
  const parts = message.split('·').map((p) => p.trim()).filter(Boolean)
  const line = parts.length > 1 ? parts.join(' ◆ ') : message

  return (
    <div className="shrink-0 overflow-hidden bg-[var(--color-deep)] py-1.5 sm:py-2">
      <div className="jarvis-ticker-track flex w-max gap-8 whitespace-nowrap px-3 font-jarvis-mono text-[8px] uppercase tracking-[0.14em] text-[var(--color-text-dim)] sm:gap-12 sm:px-4 sm:text-[9px] sm:tracking-[0.18em]">
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
  resultPanel = null,
  onResultPanelClose,
  onResultPanelAction,
  className,
  style,
}: JarvisHudShellProps) {
  const presentingResult = Boolean(resultPanel)
  return (
    <JarvisFontScope
      className={cn(
        'jarvis-hud-grid-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[var(--color-text-primary)]',
        className
      )}
      style={{ ...jarvisHudStyle, ...style } as React.CSSProperties}
    >
      <div className="jarvis-perspective-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="jarvis-hud-mobile-compact relative flex h-full min-h-0 flex-1 flex-col gap-1.5 p-1.5 sm:gap-3 sm:p-3 lg:flex-row lg:gap-6 lg:p-4">
        <div
          className={cn(
            'jarvis-stagger relative order-2 flex min-h-0 flex-1 transition-all duration-500 lg:order-1',
            presentingResult && 'jarvis-core-presenting'
          )}
        >
          <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col items-center justify-center py-2 text-center sm:py-4 lg:py-6">
            {onMinimize ? (
              <button
                type="button"
                onClick={onMinimize}
                className="absolute right-0 top-0 z-10 rounded px-2 py-0.5 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-core)]"
              >
                recolher
              </button>
            ) : null}

            <div className="flex w-full max-w-full flex-col items-center gap-2 sm:gap-4">
              <p className="hidden font-jarvis-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-dim)] sm:block">
                núcleo ativo
              </p>

              <JarvisCoreSphere
                isListening={isListening}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                onMicClick={onMicClick}
                enableMic={enableVoice && speechSupported}
                className="w-full max-w-[min(100%,clamp(8.75rem,34vw,11.5rem))] sm:max-w-[min(100%,clamp(11rem,36vw,16rem))] lg:max-w-[min(100%,clamp(14.5rem,40vh,21rem))]"
              />

              <h1 className="font-jarvis-display text-[1.15rem] font-bold uppercase tracking-[0.22em] text-[var(--color-core)] sm:text-[clamp(1.35rem,3vh,1.75rem)] sm:tracking-[0.3em]">
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
                <p
                  className="max-w-full px-2 font-jarvis-mono text-[8px] leading-snug text-[var(--color-alert)] sm:text-[9px]"
                  role="alert"
                >
                  {voiceError}
                </p>
              ) : null}

              {lastAction && onActionClick && !presentingResult ? (
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

        <div
          className={cn(
            'jarvis-stagger flex w-full shrink-0 flex-col lg:order-2 lg:h-full lg:min-h-0 lg:max-h-none',
            presentingResult
              ? 'order-3 max-lg:max-h-[min(34vh,14rem)] lg:w-[min(100%,24rem)] xl:w-[min(100%,26rem)]'
              : 'order-1 max-lg:max-h-[min(22vh,8.5rem)] lg:w-[min(100%,20rem)] xl:w-[min(100%,22rem)]'
          )}
        >
          {resultPanel && onResultPanelClose ? (
            <JarvisResultPanel
              key={resultPanel.view.title}
              view={resultPanel.view}
              action={resultPanel.action}
              isSpeaking={isSpeaking}
              onAction={onResultPanelAction}
              onClose={onResultPanelClose}
              className="min-h-0 flex-1"
            />
          ) : (
            <JarvisHudSystemLog
              extraLines={logLines}
              processing={isProcessing}
              className="min-h-0 flex-1 max-lg:max-h-full lg:min-h-0"
            />
          )}
        </div>
      </div>

      <JarvisHudMetricsBar className="lg:hidden" />
      <StatusTicker message={statusMessage} />
    </JarvisFontScope>
  )
}
