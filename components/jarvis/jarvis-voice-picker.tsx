'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconChevronDown, IconPlayerPlay } from '@tabler/icons-react'
import { unlockJarvisAudio } from '@/lib/agent/audio-unlock'
import { previewKokoroVoice } from '@/lib/agent/kokoro-engine'
import {
  DEFAULT_KOKORO_VOICE,
  getKokoroVoiceLabel,
  KOKORO_JARVIS_VOICES,
  type KokoroVoiceId,
} from '@/lib/agent/kokoro-voices'
import {
  getOpenAiVoiceLabel,
  listOpenAiVoicesForPicker,
  type OpenAiTtsVoiceId,
} from '@/lib/agent/openai-voices'
import {
  ensureJarvisSystemVoiceDefault,
  fetchJarvisSpeechConfig,
  formatElevenLabsVoiceLabel,
  getLiveJarvisSystemVoiceLabel,
  listElevenLabsVoices,
  MACOS_SIRI_VOICE_UNAVAILABLE_HINT,
  syncPreferredVoiceFromSiriNumber,
  isSpeechSynthesisSupported,
  listPortugueseVoices,
  previewElevenLabsVoice,
  previewOpenAiVoice,
  previewVoice,
  type PortugueseVoiceOption,
} from '@/lib/agent/speech-output'
import { isLikelyMacOs } from '@/lib/agent/system-default-voice'
import { MACOS_SYSTEM_DEFAULT_VOICE_URI } from '@/lib/agent/system-default-voice'
import {
  applyJarvisFelipeDefaultMigration,
  applyJarvisMacSystemVoiceMigration,
  applyJarvisSystemModeMigration,
  applyJarvisVoiceMigration,
  getJarvisTtsMode,
  getPreferredElevenLabsVoiceId,
  getPreferredKokoroVoice,
  getPreferredOpenAiVoice,
  getPreferredSiriVoiceNumber,
  getPreferredVoiceUri,
  setJarvisTtsMode,
  setPreferredElevenLabsVoiceId,
  setPreferredKokoroVoice,
  setPreferredOpenAiVoice,
  setPreferredSiriVoiceNumber,
  setPreferredVoiceUri,
  type JarvisTtsMode,
} from '@/lib/agent/voice-preference'
import { useKokoroTTS } from '@/hooks/useKokoroTTS'
import { pickJarvisGreetingLine } from '@/lib/agent/greeting-reply'
import { cn } from '@/lib/utils'
import './jarvis-neural.css'

function findActiveOption(
  options: PortugueseVoiceOption[],
  uri: string | null,
  siriNumber: number | null
): PortugueseVoiceOption | undefined {
  if (uri === MACOS_SYSTEM_DEFAULT_VOICE_URI) {
    return options.find((o) => o.isSystemDefault) ?? options[0]
  }
  if (siriNumber) {
    const bySiri = options.find((o) => o.siriNumber === siriNumber)
    if (bySiri) return bySiri
  }
  if (uri) {
    const byUri = options.find((o) => o.voiceURI === uri)
    if (byUri) return byUri
  }
  return options.find((o) => o.isSystemDefault) ?? options[0]
}

export function JarvisVoicePicker({
  className,
  compact = false,
  voiceOutputEnabled = true,
}: {
  className?: string
  compact?: boolean
  voiceOutputEnabled?: boolean
}) {
  const [ttsMode, setTtsMode] = useState<JarvisTtsMode>('system')
  const [voices, setVoices] = useState<PortugueseVoiceOption[]>([])
  const [activeUri, setActiveUri] = useState<string | null>(null)
  const [openAiVoice, setOpenAiVoice] = useState<OpenAiTtsVoiceId>('onyx')
  const [openAiAvailable, setOpenAiAvailable] = useState(false)
  const [elevenLabsAvailable, setElevenLabsAvailable] = useState(false)
  const [elevenLabsVoices, setElevenLabsVoices] = useState<
    Array<{
      voice_id: string
      name: string
      labels: Record<string, string>
      preview_url: string | null
      category: string | null
      freeTierApi: boolean
    }>
  >([])
  const [elevenLabsHint, setElevenLabsHint] = useState<string | null>(null)
  const [elevenVoiceId, setElevenVoiceId] = useState<string | null>(null)
  const [kokoroVoice, setKokoroVoice] = useState<KokoroVoiceId>(DEFAULT_KOKORO_VOICE)
  const [liveLabel, setLiveLabel] = useState('carregando…')
  const [speechOk, setSpeechOk] = useState(true)
  const [previewing, setPreviewing] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const kokoro = useKokoroTTS({ voice: kokoroVoice })

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

  const loadSystemVoices = useCallback(async () => {
    if (!isSpeechSynthesisSupported()) {
      setSpeechOk(false)
      setLiveLabel('não suportado neste navegador')
      return
    }

    await ensureJarvisSystemVoiceDefault()
    const rawVoices = window.speechSynthesis.getVoices()
    syncPreferredVoiceFromSiriNumber(rawVoices)
    const options = await listPortugueseVoices()
    setVoices(options)
    setSpeechOk(options.length > 0)
    await syncSelection(options)
  }, [syncSelection])

  useEffect(() => {
    applyJarvisVoiceMigration()
    applyJarvisSystemModeMigration()
    applyJarvisMacSystemVoiceMigration()
    applyJarvisFelipeDefaultMigration()
    const mode = getJarvisTtsMode()
    setTtsMode(mode)
    setKokoroVoice(getPreferredKokoroVoice())
    setOpenAiVoice(getPreferredOpenAiVoice() ?? 'onyx')
    setElevenVoiceId(getPreferredElevenLabsVoiceId())

    void fetchJarvisSpeechConfig().then((cfg) => {
      setOpenAiAvailable(Boolean(cfg.openaiAvailable ?? cfg.available))
      setElevenLabsAvailable(Boolean(cfg.elevenlabsAvailable ?? cfg.elevenlabs?.available))
      const modeAfter = getJarvisTtsMode()
      setTtsMode(modeAfter)
      const storedEleven = getPreferredElevenLabsVoiceId()
      if (storedEleven) setElevenVoiceId(storedEleven)
      else if (cfg.elevenlabs?.defaultVoiceId) {
        setPreferredElevenLabsVoiceId(cfg.elevenlabs.defaultVoiceId)
        setElevenVoiceId(cfg.elevenlabs.defaultVoiceId)
      }
    })

    void listElevenLabsVoices().then(({ voices, hint }) => {
      setElevenLabsVoices(voices)
      if (hint) setElevenLabsHint((prev) => prev ?? hint)
      const current = getPreferredElevenLabsVoiceId()
      const currentVoice = voices.find((v) => v.voice_id === current)
      if (currentVoice && !currentVoice.freeTierApi) {
        setElevenLabsHint('Voz atual exige plano pago na API. Escolha Adam ou Antoni (marcadas «free»).')
      }
    })

    if (mode === 'system') {
      void loadSystemVoices()
    } else if (mode === 'openai') {
      setSpeechOk(true)
      setLiveLabel(getOpenAiVoiceLabel(getPreferredOpenAiVoice() ?? 'onyx'))
    } else if (mode === 'elevenlabs') {
      setSpeechOk(true)
      const id = getPreferredElevenLabsVoiceId()
      setLiveLabel(id ? `ElevenLabs · ${id.slice(0, 8)}…` : 'ElevenLabs')
    } else {
      setSpeechOk(true)
      setLiveLabel(getKokoroVoiceLabel(getPreferredKokoroVoice()))
    }
  }, [loadSystemVoices])

  useEffect(() => {
    if (!isSpeechSynthesisSupported() || ttsMode !== 'system') return
    const onVoicesChanged = () => void loadSystemVoices()
    window.speechSynthesis?.addEventListener('voiceschanged', onVoicesChanged)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', onVoicesChanged)
  }, [loadSystemVoices, ttsMode])

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

  const selectSystemMode = () => {
    setJarvisTtsMode('system')
    setTtsMode('system')
    void loadSystemVoices()
  }

  const selectOpenAiMode = (voice: OpenAiTtsVoiceId) => {
    setJarvisTtsMode('openai')
    setPreferredOpenAiVoice(voice, true)
    setTtsMode('openai')
    setOpenAiVoice(voice)
    setLiveLabel(getOpenAiVoiceLabel(voice))
    setOpen(false)
  }

  const selectElevenLabsMode = (voiceId: string) => {
    setJarvisTtsMode('elevenlabs')
    setPreferredElevenLabsVoiceId(voiceId)
    setTtsMode('elevenlabs')
    setElevenVoiceId(voiceId)
    const match = elevenLabsVoices.find((v) => v.voice_id === voiceId)
    setLiveLabel(match ? formatElevenLabsVoiceLabel(match) : `ElevenLabs · ${voiceId.slice(0, 8)}…`)
    setOpen(false)
  }

  const selectKokoroMode = (voice: KokoroVoiceId) => {
    setJarvisTtsMode('kokoro')
    setPreferredKokoroVoice(voice)
    setTtsMode('kokoro')
    setKokoroVoice(voice)
    setLiveLabel(getKokoroVoiceLabel(voice))
    setOpen(false)
  }

  const handleSystemChange = (option: PortugueseVoiceOption) => {
    setPreferredVoiceUri(option.voiceURI)
    if (option.isSystemDefault) setPreferredSiriVoiceNumber(null)
    else if (option.siriNumber) setPreferredSiriVoiceNumber(option.siriNumber)
    else setPreferredSiriVoiceNumber(null)
    setJarvisTtsMode('system')
    setTtsMode('system')
    setActiveUri(option.voiceURI)
    setLiveLabel(option.label)
    setOpen(false)
  }

  const handlePreview = async () => {
    if (previewing || !voiceOutputEnabled) return
    unlockJarvisAudio()
    setPreviewing(true)
    try {
      const previewPhrase = pickJarvisGreetingLine()
      if (ttsMode === 'openai' && openAiAvailable) {
        await previewOpenAiVoice(previewPhrase, openAiVoice)
      } else if (ttsMode === 'elevenlabs' && elevenVoiceId) {
        await previewElevenLabsVoice(previewPhrase, elevenVoiceId)
      } else if (ttsMode === 'kokoro') {
        if (!kokoro.isReady && !kokoro.isLoading) await kokoro.warm()
        await previewKokoroVoice(previewPhrase, kokoroVoice)
      } else if (speechOk) {
        await previewVoice(previewPhrase, activeUri)
      }
    } finally {
      setPreviewing(false)
    }
  }

  const activeOption = voices.find((v) => v.voiceURI === activeUri)
  const openAiOptions = listOpenAiVoicesForPicker()
  const hasFelipeVoice = voices.some((v) => v.name.toLowerCase().includes('felipe'))
  const showSiriUnavailableHint = ttsMode === 'system' && isLikelyMacOs() && !hasFelipeVoice

  const activeElevenVoice = elevenLabsVoices.find((v) => v.voice_id === elevenVoiceId)

  const dropdownLabel =
    ttsMode === 'openai'
      ? `Neural · ${getOpenAiVoiceLabel(openAiVoice)}`
      : ttsMode === 'elevenlabs'
        ? activeElevenVoice
          ? `ElevenLabs · ${formatElevenLabsVoiceLabel(activeElevenVoice)}`
          : elevenVoiceId
            ? `ElevenLabs · ${elevenVoiceId.slice(0, 10)}…`
            : 'ElevenLabs · escolha uma voz'
      : ttsMode === 'kokoro'
        ? `Kokoro · ${getKokoroVoiceLabel(kokoroVoice)}`
        : (activeOption?.label ?? liveLabel)

  const canPreview =
    ttsMode === 'openai'
      ? openAiAvailable && !previewing
      : ttsMode === 'elevenlabs'
        ? elevenLabsAvailable && Boolean(elevenVoiceId) && !previewing
      : ttsMode === 'kokoro'
        ? !previewing
        : Boolean(speechOk && voices.length > 0 && !previewing)

  return (
    <div className={cn('flex w-full flex-col items-center gap-1.5', compact ? '' : 'max-w-xs', className)}>
      <div className="flex w-full gap-1">
        <button
          type="button"
          onClick={selectSystemMode}
          className={cn(
            'flex-1 rounded px-2 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider transition-colors',
            ttsMode === 'system'
              ? 'bg-[rgba(0,212,255,0.12)] text-[var(--color-core)]'
              : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]'
          )}
        >
          Sistema
        </button>
        {openAiAvailable ? (
          <button
            type="button"
            onClick={() => selectOpenAiMode(openAiVoice)}
            className={cn(
              'flex-1 rounded px-2 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider transition-colors',
              ttsMode === 'openai'
                ? 'bg-[rgba(0,212,255,0.12)] text-[var(--color-core)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]'
            )}
          >
            OpenAI
          </button>
        ) : null}
        {elevenLabsAvailable ? (
          <button
            type="button"
            onClick={() => {
              if (elevenVoiceId) selectElevenLabsMode(elevenVoiceId)
              else setJarvisTtsMode('elevenlabs')
            }}
            className={cn(
              'flex-1 rounded px-2 py-1 font-jarvis-mono text-[8px] uppercase tracking-wider transition-colors',
              ttsMode === 'elevenlabs'
                ? 'bg-[rgba(0,212,255,0.12)] text-[var(--color-core)]'
                : 'text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]'
            )}
          >
            ElevenLabs
          </button>
        ) : null}
      </div>

      <p
        className={cn(
          'font-jarvis-mono uppercase tracking-[0.18em] text-[var(--color-text-dim)]',
          compact ? 'text-[7px]' : 'text-[8px]'
        )}
      >
        {ttsMode === 'openai'
          ? 'openai tts · voz masculina estável em pt-br'
          : ttsMode === 'elevenlabs'
            ? 'elevenlabs flash v2.5 · teste vozes pt-br · plano free ~10k créditos/mês'
          : ttsMode === 'kokoro'
            ? 'experimental · inglês · qualidade ruim em pt'
            : 'siri voz 1/2 não aparecem no navegador · baixe felipe aprimorada'}
      </p>

      <div className="flex w-full items-center gap-1.5">
        <div ref={rootRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={
              (ttsMode === 'system' && (!speechOk || voices.length === 0)) ||
              (ttsMode === 'openai' && !openAiAvailable) ||
              (ttsMode === 'elevenlabs' && (!elevenLabsAvailable || elevenLabsVoices.length === 0))
            }
            className="flex w-full items-center justify-between gap-2 rounded bg-transparent px-2 py-1.5 font-jarvis-mono text-[10px] text-[var(--color-text-code)] hover:bg-[rgba(0,212,255,0.06)] focus:outline-none focus:ring-1 focus:ring-[var(--color-core)] disabled:opacity-40"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Selecionar voz do Jarvis"
          >
            <span className="truncate text-left">{dropdownLabel}</span>
            <IconChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-[var(--color-text-dim)] transition-transform',
                open && 'rotate-180'
              )}
              stroke={1.5}
            />
          </button>

          {open ? (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-52 overflow-y-auto rounded bg-[var(--color-deep)] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              {ttsMode === 'openai'
                ? openAiOptions.map((v) => (
                    <li key={v.id} role="option" aria-selected={v.id === openAiVoice}>
                      <button
                        type="button"
                        onClick={() => selectOpenAiMode(v.id)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-left hover:bg-[rgba(0,212,255,0.08)]',
                          v.id === openAiVoice
                            ? 'text-[var(--color-core)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        <span className="block font-jarvis-mono text-[10px]">
                          {v.label}
                          {v.id === openAiVoice ? ' · em uso' : ''}
                        </span>
                        <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                          {v.tone}
                        </span>
                      </button>
                    </li>
                  ))
                : ttsMode === 'elevenlabs'
                ? elevenLabsVoices.map((v) => (
                    <li key={v.voice_id} role="option" aria-selected={v.voice_id === elevenVoiceId}>
                      <button
                        type="button"
                        onClick={() => selectElevenLabsMode(v.voice_id)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-left hover:bg-[rgba(0,212,255,0.08)]',
                          v.voice_id === elevenVoiceId
                            ? 'text-[var(--color-core)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        <span className="block font-jarvis-mono text-[10px]">
                          {formatElevenLabsVoiceLabel(v)}
                          {v.voice_id === elevenVoiceId ? ' · em uso' : ''}
                        </span>
                        <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                          {v.freeTierApi
                            ? `${v.labels?.use || v.labels?.accent || v.category || 'premade'} · API free`
                            : `${v.category || 'biblioteca'} · plano pago na API`}
                        </span>
                      </button>
                    </li>
                  ))
                : ttsMode === 'kokoro'
                ? KOKORO_JARVIS_VOICES.map((v) => (
                    <li key={v.id} role="option" aria-selected={v.id === kokoroVoice}>
                      <button
                        type="button"
                        onClick={() => selectKokoroMode(v.id)}
                        className={cn(
                          'w-full px-2.5 py-1.5 text-left hover:bg-[rgba(0,212,255,0.08)]',
                          v.id === kokoroVoice
                            ? 'text-[var(--color-core)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                      >
                        <span className="block font-jarvis-mono text-[10px]">
                          {v.label}
                          {v.id === kokoroVoice ? ' · em uso' : ''}
                        </span>
                        <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                          inglês · qualidade {v.grade}
                        </span>
                      </button>
                    </li>
                  ))
                : voices.map((v) => (
                    <li key={v.voiceURI} role="option" aria-selected={v.voiceURI === activeUri}>
                      <button
                        type="button"
                        onClick={() => handleSystemChange(v)}
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
                        {v.isSystemDefault ? (
                          <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                            Costuma ser Luciana · Siri Voz 1 não é exposta ao navegador
                          </span>
                        ) : v.name.toLowerCase().includes('felipe') ? (
                          <span className="block font-jarvis-mono text-[8px] text-[var(--color-online)]">
                            Melhor masculina disponível no navegador · baixe Aprimorada nos Ajustes
                          </span>
                        ) : v.isSiri ? (
                          <span className="block font-jarvis-mono text-[8px] text-[var(--color-text-dim)]">
                            Eloquence no navegador · não é a Siri dos Ajustes
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
          disabled={!canPreview || !voiceOutputEnabled}
          title="Ouvir amostra da voz em uso"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-core)] hover:bg-[rgba(0,212,255,0.06)] disabled:opacity-40"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.5} />
        </button>
      </div>

      {ttsMode === 'kokoro' && kokoro.isLoading ? (
        <p className="text-center font-jarvis-mono text-[8px] text-[var(--color-core)]">
          Baixando modelo Kokoro… {kokoro.loadProgress ?? 0}%
          {kokoro.device ? ` · ${kokoro.device}` : ''}
        </p>
      ) : null}

      {ttsMode === 'kokoro' && kokoro.error ? (
        <p className="text-center font-jarvis-mono text-[8px] leading-snug text-[rgba(255,180,80,0.95)]">
          Kokoro indisponível: {kokoro.error}. Volte para Sistema pt-BR.
        </p>
      ) : null}

      {ttsMode === 'system' && speechOk ? (
        <p
          className={cn(
            'text-center font-jarvis-mono uppercase tracking-wider',
            voiceOutputEnabled ? 'text-[var(--color-online)]' : 'text-[var(--color-text-dim)]',
            compact ? 'text-[7px]' : 'text-[7px]'
          )}
        >
          {voiceOutputEnabled
            ? `em uso nas respostas · ${liveLabel}`
            : 'respostas só no painel · voz desligada'}
        </p>
      ) : ttsMode === 'elevenlabs' ? (
        <>
          <p
            className={cn(
              'text-center font-jarvis-mono uppercase tracking-wider',
              voiceOutputEnabled ? 'text-[var(--color-online)]' : 'text-[var(--color-text-dim)]',
              compact ? 'text-[7px]' : 'text-[7px]'
            )}
          >
            {voiceOutputEnabled
              ? activeElevenVoice
                ? `elevenlabs · ${formatElevenLabsVoiceLabel(activeElevenVoice)}`
                : 'elevenlabs · escolha uma voz na lista'
              : 'respostas só no painel · voz desligada'}
          </p>
          {elevenLabsHint ? (
            <p className="text-center font-jarvis-mono text-[7px] leading-snug text-[rgba(255,180,80,0.95)]">
              {elevenLabsHint}
            </p>
          ) : null}
        </>
      ) : ttsMode === 'openai' ? (
        <p
          className={cn(
            'text-center font-jarvis-mono uppercase tracking-wider',
            voiceOutputEnabled ? 'text-[var(--color-online)]' : 'text-[var(--color-text-dim)]',
            compact ? 'text-[7px]' : 'text-[7px]'
          )}
        >
          {voiceOutputEnabled
            ? `neural · ${getOpenAiVoiceLabel(openAiVoice)}`
            : 'respostas só no painel · voz desligada'}
        </p>
      ) : showSiriUnavailableHint ? (
        <p
          className={cn(
            'text-center font-jarvis-mono leading-snug text-[rgba(255,180,80,0.95)]',
            compact ? 'text-[6px]' : 'text-[7px]'
          )}
        >
          {MACOS_SIRI_VOICE_UNAVAILABLE_HINT}
        </p>
      ) : ttsMode === 'system' && !openAiAvailable ? (
        <p
          className={cn(
            'text-center font-jarvis-mono uppercase tracking-wider text-[var(--color-text-dim)]',
            compact ? 'text-[6px]' : 'text-[6px]'
          )}
        >
          voz masculina estável: configure OPENAI_API_KEY · aba neural M
        </p>
      ) : ttsMode === 'kokoro' && !kokoro.error ? (
        <p
          className={cn(
            'text-center font-jarvis-mono uppercase tracking-wider',
            voiceOutputEnabled ? 'text-[var(--color-online)]' : 'text-[var(--color-text-dim)]',
            compact ? 'text-[7px]' : 'text-[7px]'
          )}
        >
          {voiceOutputEnabled
            ? `kokoro · ${kokoro.isReady ? 'pronto' : 'carrega na 1ª fala'} · ${getKokoroVoiceLabel(kokoroVoice)}`
            : 'respostas só no painel · voz desligada'}
        </p>
      ) : ttsMode === 'system' ? (
        <p
          className={cn(
            'text-center font-jarvis-mono leading-snug text-[rgba(255,180,80,0.95)]',
            compact ? 'text-[7px] sm:text-[8px]' : 'text-[8px]'
          )}
          role="status"
        >
          Este navegador não oferece síntese de voz pt-BR. Use Kokoro local ou Chrome/Safari com vozes
          brasileiras.
        </p>
      ) : null}
    </div>
  )
}
