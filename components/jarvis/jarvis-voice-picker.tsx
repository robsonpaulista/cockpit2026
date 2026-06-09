'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconPlayerPlay } from '@tabler/icons-react'
import {
  getSelectedBrowserVoiceLabel,
  listPortugueseVoices,
  previewVoice,
  type PortugueseVoiceOption,
} from '@/lib/agent/speech-output'
import {
  getPreferredSiriVoiceNumber,
  getPreferredVoiceUri,
  setPreferredSiriVoiceNumber,
  setPreferredVoiceUri,
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
  const [voices, setVoices] = useState<PortugueseVoiceOption[]>([])
  const [selectedUri, setSelectedUri] = useState<string>('')
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const loadVoices = useCallback(async () => {
    const list = await listPortugueseVoices()
    setVoices(list)

    const savedUri = getPreferredVoiceUri()
    const savedSiriNum = getPreferredSiriVoiceNumber()

    if (savedUri && list.some((v) => v.voiceURI === savedUri)) {
      setSelectedUri(savedUri)
    } else if (savedSiriNum) {
      const byNumber = list.find((v) => v.siriNumber === savedSiriNum)
      if (byNumber) {
        setSelectedUri(byNumber.voiceURI)
        setPreferredVoiceUri(byNumber.voiceURI)
      }
    }

    setActiveLabel(await getSelectedBrowserVoiceLabel())
  }, [])

  useEffect(() => {
    void loadVoices()
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [loadVoices])

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

  const handleChange = (uri: string) => {
    setSelectedUri(uri)
    setPreferredVoiceUri(uri || null)
    const found = voices.find((v) => v.voiceURI === uri)
    setPreferredSiriVoiceNumber(found?.siriNumber ?? null)
    setActiveLabel(found?.label ?? null)
    setOpen(false)
  }

  const handlePreview = async () => {
    if (!selectedUri || previewing) return
    setPreviewing(true)
    try {
      await previewVoice(PREVIEW_PHRASE, selectedUri)
    } finally {
      setPreviewing(false)
    }
  }

  const selectedVoice = voices.find((v) => v.voiceURI === selectedUri)
  const siriVoices = voices.filter((v) => v.isSiri)
  const otherVoices = voices.filter((v) => !v.isSiri)

  if (voices.length === 0) {
    return (
      <p className={cn('font-mono text-[8px] uppercase tracking-wider text-[rgba(0,229,255,0.35)]', className)}>
        carregando vozes do sistema…
      </p>
    )
  }

  return (
    <div className={cn('flex w-full flex-col items-center gap-1.5', compact ? '' : 'max-w-xs', className)}>
      {!compact ? (
        <p className="font-jarvis-mono text-[8px] uppercase tracking-[0.18em] text-[var(--color-text-dim)]">
          voz de resposta
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
              {selectedVoice?.label ?? 'Escolha a voz do Siri…'}
            </span>
            <IconChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 text-[var(--color-text-dim)] transition-transform', open && 'rotate-180')}
              stroke={1.5}
            />
          </button>

          {open ? (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-48 overflow-y-auto rounded bg-[var(--color-deep)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              {siriVoices.map((v) => (
                <li key={v.voiceURI} role="option" aria-selected={v.voiceURI === selectedUri}>
                  <button
                    type="button"
                    onClick={() => handleChange(v.voiceURI)}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-left font-jarvis-mono text-[10px] hover:bg-[rgba(0,212,255,0.08)]',
                      v.voiceURI === selectedUri
                        ? 'text-[var(--color-core)]'
                        : 'text-[var(--color-text-primary)]'
                    )}
                  >
                    {v.label}
                  </button>
                </li>
              ))}
              {otherVoices.length > 0 ? (
                <>
                  <li className="px-2.5 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider text-[var(--color-text-dim)]">
                    outras vozes
                  </li>
                  {otherVoices.map((v) => (
                    <li key={v.voiceURI} role="option" aria-selected={v.voiceURI === selectedUri}>
                      <button
                        type="button"
                        onClick={() => handleChange(v.voiceURI)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-left font-jarvis-mono text-[10px] hover:bg-[rgba(0,212,255,0.08)]',
                          v.voiceURI === selectedUri
                            ? 'text-[var(--color-core)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        {v.label}
                      </button>
                    </li>
                  ))}
                </>
              ) : null}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={previewing || !selectedUri}
          title="Ouvir amostra"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.06)] disabled:opacity-40"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.5} />
        </button>
      </div>
      {activeLabel && !compact ? (
        <p className="text-center font-jarvis-mono text-[7px] uppercase tracking-wider text-[var(--color-online)]">
          ativa · {activeLabel}
        </p>
      ) : null}
      {!compact ? (
        <p className="text-center font-jarvis-mono text-[7px] leading-snug text-[var(--color-text-dim)]">
          escolha o mesmo número dos Ajustes do Siri — ex.: Voz 2 → Siri · Voz 2
        </p>
      ) : null}
    </div>
  )
}
