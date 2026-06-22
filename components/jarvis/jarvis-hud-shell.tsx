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
import { JarvisTextInput } from '@/components/jarvis/jarvis-text-input'
import { JarvisVoiceBar } from '@/components/jarvis/jarvis-voice-bar'
import { JarvisWebcamPreview } from '@/components/jarvis/jarvis-webcam-preview'
import type { JarvisResultView } from '@/lib/agent/jarvis-result-view'
import { COCKPIT_AGENT_NAME } from '@/lib/agent/cockpit-agent-brand'
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
  listeningTranscript?: string
  isSpeaking?: boolean
  isProcessing?: boolean
  enableVoice?: boolean
  speechSupported?: boolean
  voiceOutputEnabled?: boolean
  onVoiceOutputChange?: (enabled: boolean) => void
  webcamEnabled?: boolean
  onWebcamChange?: (enabled: boolean) => void
  voiceError?: string | null
  onMicClick?: () => void
  onMinimize?: () => void
  lastAction?: JarvisHudAction
  onActionClick?: (action: JarvisHudAction) => void
  logLines?: JarvisLogLine[]
  onDiagnosticLog?: (lines: JarvisLogLine[]) => void
  resultPanel?: {
    view: JarvisResultView
    action?: JarvisHudAction
  } | null
  onResultPanelClose?: () => void
  onResultPanelAction?: (action: JarvisHudAction) => void
  textInputValue?: string
  onTextInputChange?: (value: string) => void
  onTextInputFocus?: () => void
  onTextInputBlur?: () => void
  onTextInputSubmit?: () => void
  textInputDisabled?: boolean
  textInputPlaceholder?: string
  agentTitle?: string
  hudLayout?: 'full' | 'compact' | 'column'
  className?: string
  style?: React.CSSProperties
}

function StatusTicker({
  message,
  listeningCapture = false,
}: {
  message: string
  listeningCapture?: boolean
}) {
  const parts = message.split('·').map((p) => p.trim()).filter(Boolean)
  const line = parts.length > 1 ? parts.join(' ◆ ') : message

  return (
    <div className="shrink-0 overflow-hidden bg-transparent py-1.5 sm:py-2">
      <div
        className={cn(
          'jarvis-ticker-track flex w-max gap-8 whitespace-nowrap px-3 font-jarvis-mono text-[8px] uppercase tracking-[0.14em] sm:gap-12 sm:px-4 sm:text-[9px] sm:tracking-[0.18em]',
          listeningCapture
            ? 'jarvis-status-ticker--capture'
            : 'text-[var(--color-text-dim)]'
        )}
      >
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
  listeningTranscript = '',
  isSpeaking = false,
  isProcessing = false,
  enableVoice = false,
  speechSupported = false,
  voiceOutputEnabled = true,
  onVoiceOutputChange,
  webcamEnabled = true,
  onWebcamChange,
  voiceError = null,
  onMicClick,
  onMinimize,
  lastAction,
  onActionClick,
  logLines = [],
  onDiagnosticLog,
  resultPanel = null,
  onResultPanelClose,
  onResultPanelAction,
  textInputValue = '',
  onTextInputChange,
  onTextInputFocus,
  onTextInputBlur,
  onTextInputSubmit,
  textInputDisabled = false,
  textInputPlaceholder,
  agentTitle = COCKPIT_AGENT_NAME,
  hudLayout = 'full',
  className,
  style,
}: JarvisHudShellProps) {
  const presentingResult = Boolean(resultPanel)
  const compact = hudLayout === 'compact'
  const column = hudLayout === 'column'
  const listeningActive = isListening && !listenPaused && !isSpeaking && !isProcessing
  const listeningCapture = listeningActive && !wakeStandby
  return (
    <JarvisFontScope
      className={cn(
        'relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[var(--color-text-primary)]',
        !column && 'jarvis-hud-grid-bg',
        column && 'bg-transparent',
        listeningCapture && 'jarvis-hud--listening-capture',
        compact && 'jarvis-hud-compact rounded-xl border border-[rgba(0,212,255,0.28)] shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
        className
      )}
      style={{ ...jarvisHudStyle, ...style } as React.CSSProperties}
    >
      {!column ? (
        <div className="jarvis-perspective-grid pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
      ) : null}

      <div
        className={cn(
          'jarvis-hud-mobile-compact relative flex h-full min-h-0 flex-1 flex-col',
          compact
            ? 'gap-1 p-1.5'
            : column
              ? 'gap-2 p-2 sm:gap-2.5 sm:p-3 lg:gap-3 lg:p-3 xl:p-4'
              : 'gap-1.5 p-1.5 sm:gap-3 sm:p-3 lg:flex-row lg:gap-6 lg:p-4'
        )}
      >
        <div
          className={cn(
            'jarvis-stagger relative flex min-h-0 transition-all duration-500',
            compact
              ? 'order-1 shrink-0'
              : column
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
              compact ? 'flex-row gap-2 py-1' : column ? 'flex-col py-1 sm:py-1.5' : 'h-full min-h-0 max-w-lg flex-col py-2 sm:py-4 lg:py-6'
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
                compact ? 'flex-row gap-2' : column ? 'flex-col items-center gap-2' : 'relative flex-col items-center gap-2 sm:gap-4'
              )}
            >
              <div
                className={cn(
                  'relative',
                  compact
                    ? 'flex shrink-0 items-center gap-2'
                    : column
                      ? 'w-full max-w-[min(100%,10.5rem)] sm:max-w-[11.5rem] lg:max-w-[12.5rem] xl:max-w-[14rem] 2xl:max-w-[15rem]'
                      : 'w-full max-w-[min(100%,clamp(8.75rem,34vw,11.5rem))] sm:max-w-[min(100%,clamp(11rem,36vw,16rem))] lg:max-w-[min(100%,clamp(14.5rem,40vh,21rem))]'
                )}
              >
                <JarvisCoreSphere
                  isListening={isListening}
                  listenPaused={listenPaused}
                  wakeStandby={wakeStandby}
                  isSpeaking={isSpeaking}
                  isProcessing={isProcessing}
                  onMicClick={onMicClick}
                  enableMic={enableVoice && speechSupported}
                  className={compact ? 'w-[4.25rem] sm:w-[4.75rem]' : 'w-full'}
                />

                <JarvisWebcamPreview
                  active={Boolean(enableVoice && isListening && !listenPaused)}
                  enabled={webcamEnabled}
                  compact={compact || column}
                  onDiagnosticLog={onDiagnosticLog}
                  className={
                    compact
                      ? 'shrink-0'
                      : 'absolute -right-1 top-0 z-10 sm:-right-2 sm:top-1'
                  }
                />
              </div>

              <div className={cn(compact ? 'min-w-0 flex-1 text-left' : 'relative w-full')}>
                <h1
                  className={cn(
                    'font-jarvis-display font-bold uppercase text-[var(--color-core)]',
                    compact
                      ? 'text-[0.65rem] tracking-[0.16em] sm:text-xs sm:tracking-[0.2em]'
                      : column
                        ? 'text-[1.2rem] tracking-[0.22em] sm:text-[1.35rem] lg:text-[1.5rem] xl:text-[1.65rem]'
                        : 'text-[1.15rem] tracking-[0.22em] sm:text-[clamp(1.35rem,3vh,1.75rem)] sm:tracking-[0.3em]'
                  )}
                >
                  {agentTitle}
                </h1>

                {enableVoice && speechSupported ? (
                  <JarvisVoiceBar
                    isListening={isListening}
                    listenPaused={listenPaused}
                    wakeStandby={wakeStandby}
                    listeningTranscript={listeningTranscript}
                    isSpeaking={isSpeaking}
                    isProcessing={isProcessing}
                    speechSupported={speechSupported}
                    voiceOutputEnabled={voiceOutputEnabled}
                    onVoiceOutputChange={onVoiceOutputChange}
                    webcamEnabled={webcamEnabled}
                    onWebcamChange={onWebcamChange}
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
              : column
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
              showVoicePicker={enableVoice && speechSupported}
              voiceOutputEnabled={voiceOutputEnabled}
              webcamEnabled={webcamEnabled}
              onDiagnosticLog={onDiagnosticLog}
              className="min-h-0 flex-1"
            />
          ) : (
            <JarvisHudSystemLog
              extraLines={logLines}
              processing={isProcessing}
              showVoicePicker={enableVoice && speechSupported}
              voiceOutputEnabled={voiceOutputEnabled}
              webcamEnabled={webcamEnabled}
              onDiagnosticLog={onDiagnosticLog}
              comfortable={column}
              className={cn('min-h-0 flex-1', column ? '' : 'max-lg:max-h-full lg:min-h-0')}
            />
          )}
        </div>
      </div>

      {!compact && !column ? <JarvisHudMetricsBar className="lg:hidden" /> : null}
      {onTextInputChange && onTextInputSubmit ? (
        <JarvisTextInput
          value={textInputValue}
          onChange={onTextInputChange}
          onFocus={onTextInputFocus}
          onBlur={onTextInputBlur}
          onSubmit={onTextInputSubmit}
          disabled={textInputDisabled}
          isListening={listeningCapture}
          placeholder={textInputPlaceholder}
        />
      ) : null}
      <StatusTicker message={statusMessage} listeningCapture={listeningCapture} />
    </JarvisFontScope>
  )
}
