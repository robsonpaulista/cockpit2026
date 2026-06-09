'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconPlayerPlay } from '@tabler/icons-react'
import {
  type OpenAiTtsVoiceId,
  OPENAI_TTS_VOICES,
} from '@/lib/agent/openai-voices'
import { unlockJarvisAudio } from '@/lib/agent/audio-unlock'
import {
  fetchJarvisSpeechConfig,
  getActiveJarvisVoiceLabel,
  previewOpenAiVoice,
} from '@/lib/agent/speech-output'
import {
  getPreferredOpenAiVoice,
  resolvePreferredOpenAiVoice,
  setJarvisTtsMode,
  setPreferredOpenAiVoice,
} from '@/lib/agent/voice-preference'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

const PREVIEW_PHRASE = 'Jarvis online. Sistemas prontos para uso.'

export function JarvisVoicePicker({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [selectedVoice, setSelectedVoice] = useState<OpenAiTtsVoiceId>('coral')
  const [serverDefault, setServerDefault] = useState<OpenAiTtsVoiceId>('coral')
  const [neuralAvailable, setNeuralAvailable] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadConfig = useCallback(async () => {
    const config = await fetchJarvisSpeechConfig()
    setNeuralAvailable(config.available)
    setServerDefault(config.defaultVoice)

    const effective = resolvePreferredOpenAiVoice(config.defaultVoice)
    setSelectedVoice(effective)

    if (!getPreferredOpenAiVoice()) {
      setPreferredOpenAiVoice(effective)
    }
    setJarvisTtsMode('openai')
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleChange = (voiceId: OpenAiTtsVoiceId) => {
    setSelectedVoice(voiceId)
    setPreferredOpenAiVoice(voiceId)
    setJarvisTtsMode('openai')
    setOpen(false)
  }

  const handlePreview = async () => {
    if (!selectedVoice || previewing || !neuralAvailable) return
    unlockJarvisAudio()
    setPreviewing(true)
    try {
      await previewOpenAiVoice(PREVIEW_PHRASE, selectedVoice)
    } finally {
      setPreviewing(false)
    }
  }

  const selectedMeta = OPENAI_TTS_VOICES.find((v) => v.id === selectedVoice)
  const isServerDefault = selectedVoice === serverDefault

  if (!neuralAvailable) {
    return (
      <p
        className={cn(
          'text-center font-mono text-[7px] leading-snug text-[rgba(255,180,80,0.85)] sm:text-[8px]',
          className
        )}
      >
        <span className="sm:hidden">Voz do navegador (configure OPENAI_API_KEY para TTS fixo)</span>
        <span className="hidden sm:inline">
          TTS neural indisponível — usando voz do navegador. Configure OPENAI_API_KEY no servidor.
        </span>
      </p>
    )
  }

  return (
    <div className={cn('flex w-full flex-col items-center gap-1.5', compact ? '' : 'max-w-xs', className)}>
      {!compact ? (
        <p className="font-jarvis-mono text-[8px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
          voz de resposta · OpenAI
        </p>
      ) : null}
      <div className="flex w-full items-center gap-1.5">
        <div ref={rootRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded bg-transparent px-2 py-1.5 font-jarvis-mono text-[10px] text-[var(--color-text-code)] hover:bg-[rgba(0,212,255,0.06)] focus:outline-none focus:ring-1 focus:ring-[var(--color-core)]"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Selecionar voz do Jarvis"
          >
            <span className="truncate text-left">
              {selectedMeta?.label ?? selectedVoice}
              {isServerDefault ? ' · padrão' : ''}
            </span>
            <IconChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 text-[var(--color-text-dim)] transition-transform', open && 'rotate-180')}
              stroke={1.5}
            />
          </button>

          {open ? (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-52 overflow-y-auto rounded bg-[var(--color-deep)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              {OPENAI_TTS_VOICES.map((v) => (
                <li key={v.id} role="option" aria-selected={v.id === selectedVoice}>
                  <button
                    type="button"
                    onClick={() => handleChange(v.id)}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-left hover:bg-[rgba(0,212,255,0.08)]',
                      v.id === selectedVoice
                        ? 'text-[var(--color-core)]'
                        : 'text-[var(--color-text-primary)]'
                    )}
                  >
                    <span className="block font-jarvis-mono text-[10px]">
                      {v.label}
                      {v.id === serverDefault ? ' · padrão servidor' : ''}
                    </span>
                    <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                      {v.tone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={previewing || !selectedVoice}
          title="Ouvir amostra"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.06)] disabled:opacity-40"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.5} />
        </button>
      </div>
      {!compact ? (
        <>
          <p className="text-center font-jarvis-mono text-[7px] uppercase tracking-wider text-[var(--color-online)]">
            ativa · {getActiveJarvisVoiceLabel(selectedVoice)}
          </p>
          <p className="text-center font-jarvis-mono text-[7px] leading-snug text-[var(--color-text-dim)]">
            mesma voz em todos os computadores · padrão do servidor: {serverDefault}
          </p>
        </>
      ) : null}
    </div>
  )
}
