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
  listenPaused?: boolean
  wakeStandby?: boolean
  isSpeaking?: boolean
  isProcessing?: boolean
  enableVoice?: boolean
  speechSupported?: boolean
  voiceOutputEnabled?: boolean
  onVoiceOutputChange?: (enabled: boolean) => void
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
  hudLayout?: 'full' | 'compact'
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
  listenPaused = false,
  wakeStandby = true,
  isSpeaking = false,
  isProcessing = false,
  enableVoice = false,
  speechSupported = false,
  voiceOutputEnabled = true,
  onVoiceOutputChange,
  voiceError = null,
  onMicClick,
  onMinimize,
  lastAction,
  onActionClick,
  logLines = [],
  resultPanel = null,
  onResultPanelClose,
  onResultPanelAction,
  hudLayout = 'full',
  className,
  style,
}: JarvisHudShellProps) {
  const presentingResult = Boolean(resultPanel)
  const compact = hudLayout === 'compact'
  return (
    <JarvisFontScope
      className={cn(
        'jarvis-hud-grid-bg relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[var(--color-text-primary)]',
        compact && 'jarvis-hud-compact rounded-xl border border-[rgba(0,212,255,0.28)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
        className
      )}
      style={{ ...jarvisHudStyle, ...style } as React.CSSProperties}
    >
      <div className="jarvis-perspective-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div
        className={cn(
          'jarvis-hud-mobile-compact relative flex h-full min-h-0 flex-1 flex-col',
          compact ? 'gap-1 p-1.5' : 'gap-1.5 p-1.5 sm:gap-3 sm:p-3 lg:flex-row lg:gap-6 lg:p-4'
        )}
      >
        <div
          className={cn(
            'jarvis-stagger relative flex min-h-0 transition-all duration-500',
            compact
              ? 'order-1 shrink-0'
              : cn(
                  'order-2 flex-1 lg:order-1',
                  presentingResult && 'jarvis-core-presenting'
                )
          )}
        >
          <div
            className={cn(
              'mx-auto flex w-full flex-col items-center justify-center text-center',
              compact ? 'flex-row gap-2 py-1' : 'h-full min-h-0 max-w-lg flex-col py-2 sm:py-4 lg:py-6'
            )}
          >
            {onMinimize ? (
              <button
                type="button"
                onClick={onMinimize}
                className={cn(
                  'z-10 rounded font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)] hover:text-[var(--color-core)]',
                  compact ? 'absolute right-1 top-1 px-1 py-0.5' : 'absolute right-0 top-0 px-2 py-0.5'
                )}
              >
                recolher
              </button>
            ) : null}

            <div
              className={cn(
                'flex w-full max-w-full items-center',
                compact ? 'flex-row gap-2' : 'flex-col items-center gap-2 sm:gap-4'
              )}
            >
              {!compact ? (
                <p className="hidden font-jarvis-mono text-[10px] uppercase tracking-[0.28em] text-[var(--color-text-dim)] sm:block">
                  núcleo ativo
                </p>
              ) : null}

              <JarvisCoreSphere
                isListening={isListening}
                listenPaused={listenPaused}
                wakeStandby={wakeStandby}
                isSpeaking={isSpeaking}
                isProcessing={isProcessing}
                onMicClick={onMicClick}
                enableMic={enableVoice && speechSupported}
                className={
                  compact
                    ? 'w-[4.25rem] shrink-0 sm:w-[4.75rem]'
                    : 'w-full max-w-[min(100%,clamp(8.75rem,34vw,11.5rem))] sm:max-w-[min(100%,clamp(11rem,36vw,16rem))] lg:max-w-[min(100%,clamp(14.5rem,40vh,21rem))]'
                }
              />

              <div className={cn(compact ? 'min-w-0 flex-1 text-left' : 'w-full')}>
                <h1
                  className={cn(
                    'font-jarvis-display font-bold uppercase text-[var(--color-core)]',
                    compact
                      ? 'text-[0.65rem] tracking-[0.16em] sm:text-xs sm:tracking-[0.2em]'
                      : 'text-[1.15rem] tracking-[0.22em] sm:text-[clamp(1.35rem,3vh,1.75rem)] sm:tracking-[0.3em]'
                  )}
                >
                  Jarvis
                </h1>

                {enableVoice && speechSupported ? (
                  <JarvisVoiceBar
                    isListening={isListening}
                    listenPaused={listenPaused}
                    wakeStandby={wakeStandby}
                    isSpeaking={isSpeaking}
                    isProcessing={isProcessing}
                    speechSupported={speechSupported}
                    voiceOutputEnabled={voiceOutputEnabled}
                    onVoiceOutputChange={onVoiceOutputChange}
                    onMicClick={onMicClick}
                    className={compact ? 'mt-0.5' : 'mt-0 w-full'}
                  />
                ) : null}
              </div>
            </div>

            {voiceError ? (
              <p
                className="max-w-full px-2 font-jarvis-mono text-[8px] leading-snug text-[var(--color-alert)] sm:text-[9px]"
                role="alert"
              >
                {voiceError}
              </p>
            ) : null}

            {lastAction && onActionClick && !presentingResult && !compact ? (
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

        <div
          className={cn(
            'jarvis-stagger flex w-full shrink-0 flex-col',
            compact
              ? 'order-2 min-h-0 flex-1'
              : cn(
                  'lg:order-2 lg:h-full lg:min-h-0 lg:max-h-none',
                  presentingResult
                    ? 'order-3 max-lg:max-h-[min(34vh,14rem)] lg:w-[min(100%,24rem)] xl:w-[min(100%,26rem)]'
                    : 'order-1 max-lg:max-h-[min(22vh,8.5rem)] lg:w-[min(100%,20rem)] xl:w-[min(100%,22rem)]'
                )
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
          ) : compact ? (
            <JarvisHudSystemLog
              extraLines={logLines.slice(-4)}
              processing={isProcessing}
              className="min-h-0 max-h-[5.5rem] flex-1"
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

      {!compact ? <JarvisHudMetricsBar className="lg:hidden" /> : null}
      <StatusTicker message={statusMessage} />
    </JarvisFontScope>
  )
}
