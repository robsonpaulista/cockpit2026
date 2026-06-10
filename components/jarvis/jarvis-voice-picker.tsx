'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconPlayerPlay } from '@tabler/icons-react'
import { unlockJarvisAudio } from '@/lib/agent/audio-unlock'
import {
  ensureJarvisSystemVoiceDefault,
  getLiveJarvisSystemVoiceLabel,
  isSpeechSynthesisSupported,
  listPortugueseVoices,
  previewVoice,
  type PortugueseVoiceOption,
} from '@/lib/agent/speech-output'
import {
  applyJarvisSystemModeMigration,
  applyJarvisVoiceMigration,
  getPreferredVoiceUri,
  getPreferredSiriVoiceNumber,
  setJarvisTtsMode,
  setPreferredSiriVoiceNumber,
  setPreferredVoiceUri,
} from '@/lib/agent/voice-preference'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

const PREVIEW_PHRASE = 'Jarvis online. Sistemas prontos para uso.'

function findActiveOption(
  options: PortugueseVoiceOption[],
  uri: string | null,
  siriNumber: number | null
): PortugueseVoiceOption | undefined {
  if (uri) {
    const byUri = options.find((o) => o.voiceURI === uri)
    if (byUri) return byUri
  }
  if (siriNumber) {
    const bySiri = options.find((o) => o.siriNumber === siriNumber)
    if (bySiri) return bySiri
  }
  return options[0]
}

export function JarvisVoicePicker({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const [voices, setVoices] = useState<PortugueseVoiceOption[]>([])
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [liveLabel, setLiveLabel] = useState('carregando…')
  const [speechOk, setSpeechOk] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const syncSelection = useCallback(async (options: PortugueseVoiceOption[]) => {
    const uri = getPreferredVoiceUri()
    const siriNum = getPreferredSiriVoiceNumber()
    const match = findActiveOption(options, uri, siriNum)
    if (match) {
      setActiveUri(match.voiceURI)
    }
    const label = await getLiveJarvisSystemVoiceLabel()
    setLiveLabel(label)
  }, [])

  const loadVoices = useCallback(async () => {
    applyJarvisVoiceMigration()
    applyJarvisSystemModeMigration()
    setJarvisTtsMode('system')

    if (!isSpeechSynthesisSupported()) {
      setSpeechOk(false)
      setLiveLabel('não suportado neste navegador')
      return
    }

    await ensureJarvisSystemVoiceDefault()
    const options = await listPortugueseVoices()
    setVoices(options)
    setSpeechOk(options.length > 0)
    await syncSelection(options)
  }, [syncSelection])

  useEffect(() => {
    void loadVoices()
    if (!isSpeechSynthesisSupported()) return
    const onVoicesChanged = () => void loadVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged)
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

  const handleChange = (option: PortugueseVoiceOption) => {
    setPreferredVoiceUri(option.voiceURI)
    if (option.siriNumber) setPreferredSiriVoiceNumber(option.siriNumber)
    else setPreferredSiriVoiceNumber(null)
    setJarvisTtsMode('system')
    setActiveUri(option.voiceURI)
    setLiveLabel(option.label)
    setOpen(false)
  }

  const handlePreview = async () => {
    if (!activeUri || previewing || !speechOk) return
    unlockJarvisAudio()
    setPreviewing(true)
    try {
      await previewVoice(PREVIEW_PHRASE, activeUri)
    } finally {
      setPreviewing(false)
    }
  }

  const activeOption = voices.find((v) => v.voiceURI === activeUri)

  return (
    <div className={cn('flex w-full flex-col items-center gap-1.5', compact ? '' : 'max-w-xs', className)}>
      <p
        className={cn(
          'font-jarvis-mono uppercase tracking-[0.18em] text-[var(--color-text-dim)]',
          compact ? 'text-[7px]' : 'text-[8px]'
        )}
      >
        voz do jarvis · sistema · pt-BR
      </p>
      <div className="flex w-full items-center gap-1.5">
        <div ref={rootRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={!speechOk || voices.length === 0}
            className="flex w-full items-center justify-between gap-2 rounded bg-transparent px-2 py-1.5 font-jarvis-mono text-[10px] text-[var(--color-text-code)] hover:bg-[rgba(0,212,255,0.06)] focus:outline-none focus:ring-1 focus:ring-[var(--color-core)] disabled:opacity-40"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Selecionar voz do Jarvis"
          >
            <span className="truncate text-left">
              {activeOption?.label ?? liveLabel}
            </span>
            <IconChevronDown
              className={cn('h-3.5 w-3.5 shrink-0 text-[var(--color-text-dim)] transition-transform', open && 'rotate-180')}
              stroke={1.5}
            />
          </button>

          {open && voices.length > 0 ? (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-52 overflow-y-auto rounded bg-[var(--color-deep)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              {voices.map((v) => (
                <li key={v.voiceURI} role="option" aria-selected={v.voiceURI === activeUri}>
                  <button
                    type="button"
                    onClick={() => handleChange(v)}
                    className={cn(
                      'w-full px-2.5 py-1.5 text-left hover:bg-[rgba(0,212,255,0.08)]',
                      v.voiceURI === activeUri
                        ? 'text-[var(--color-core)]'
                        : 'text-[var(--color-text-primary)]'
                    )}
                  >
                    <span className="block font-jarvis-mono text-[10px]">
                      {v.label}
                      {v.voiceURI === activeUri ? ' · em uso' : ''}
                    </span>
                    {v.isSiri ? (
                      <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                        Siri · mesma ordem dos Ajustes do macOS/iOS
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handlePreview()}
          disabled={previewing || !activeUri || !speechOk}
          title="Ouvir amostra da voz em uso"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.06)] disabled:opacity-40"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.5} />
        </button>
      </div>
      {speechOk ? (
        <p
          className={cn(
            'text-center font-jarvis-mono uppercase tracking-wider text-[var(--color-online)]',
            compact ? 'text-[7px]' : 'text-[7px]'
          )}
        >
          em uso nas respostas · {liveLabel}
        </p>
      ) : (
        <p
          className={cn(
            'text-center font-jarvis-mono leading-snug text-[rgba(255,180,80,0.95)]',
            compact ? 'text-[7px] sm:text-[8px]' : 'text-[8px]'
          )}
          role="status"
        >
          Este navegador não oferece síntese de voz pt-BR. Use Safari no Mac/iPhone ou Chrome com vozes
          brasileiras instaladas.
        </p>
      )}
    </div>
  )
}
