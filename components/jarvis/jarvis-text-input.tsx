'use client'

import { useCallback, useEffect, useRef } from 'react'
import { IconArrowRight } from '@tabler/icons-react'
import { COCKPIT_AGENT_NAME } from '@/lib/agent/cockpit-agent-brand'
import { JARVIS_WAKE_HOTKEY, jarvisWakeHint } from '@/lib/agent/jarvis-wake-word'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

interface JarvisTextInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onFocus?: () => void
  onBlur?: () => void
  disabled?: boolean
  isListening?: boolean
  placeholder?: string
  className?: string
}

const MAX_INPUT_HEIGHT_PX = 120

export function JarvisTextInput({
  value,
  onChange,
  onSubmit,
  onFocus,
  onBlur,
  disabled = false,
  isListening = false,
  placeholder,
  className,
}: JarvisTextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSubmit = Boolean(value.trim()) && !disabled

  const syncHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT_PX)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT_PX ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    syncHeight()
  }, [value, syncHeight])

  return (
    <div
      className={cn(
        'shrink-0 border-t border-[rgba(0,212,255,0.14)] bg-transparent px-2 py-2 sm:px-3',
        className
      )}
    >
      <div className="flex items-end gap-1.5 sm:gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
              e.preventDefault()
              onSubmit()
            }
          }}
          placeholder={
            placeholder ??
            jarvisWakeHint()
          }
          disabled={disabled}
          aria-busy={isListening}
          aria-label={`Pergunta à ${COCKPIT_AGENT_NAME}`}
          className={cn(
            'jarvis-text-input min-h-[2.25rem] min-w-0 flex-1 resize-none rounded-lg border bg-transparent px-2.5 py-2 font-jarvis-ui text-[11px] leading-relaxed text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[var(--color-core)] disabled:opacity-60 sm:text-xs',
            isListening
              ? 'border-[rgba(0,212,255,0.45)] ring-1 ring-[rgba(0,212,255,0.2)]'
              : 'border-[rgba(0,212,255,0.2)]'
          )}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onSubmit}
          disabled={!canSubmit}
          title="Enviar pergunta"
          aria-label="Enviar pergunta"
          className={cn(
            'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
            canSubmit
              ? 'border-[var(--color-core)] text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.1)]'
              : 'border-[rgba(0,212,255,0.12)] text-[var(--color-text-dim)] opacity-50'
          )}
        >
          <IconArrowRight className="h-4 w-4" stroke={1.75} />
        </button>
      </div>
    </div>
  )
}
