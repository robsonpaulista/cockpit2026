import {
  pickBestBrazilianBrowserVoice,
  pickPreferredMasculineBrazilVoice,
  scoreBrazilianBrowserVoice,
} from '@/lib/agent/brazil-browser-voice'
import {
  isJarvisBrowserVoice,
  jarvisBrowserVoicePitch,
} from '@/lib/agent/jarvis-browser-voice'
import {
  buildSiriVoiceLabel,
  getSiriBrazilVoicesInSystemOrder,
  getSiriVoiceByNumber,
  getSiriVoiceNumber,
  SIRI_MASCULINE_HINTS,
} from '@/lib/agent/siri-voices'
import {
  getOpenAiVoiceLabel,
  OPENAI_TTS_VOICES,
  type OpenAiTtsVoiceId,
} from '@/lib/agent/openai-voices'
import {
  MAX_SPEAK_CHARS,
  stripTextForNeuralSpeech,
  stripTextForSpeech,
} from '@/lib/agent/speech-text'
import {
  configureJarvisAudioElement,
  primeSpeechSynthesis,
  unlockJarvisAudio,
} from '@/lib/agent/audio-unlock'
import {
  isLikelyMacOs,
  isMacOsSystemDefaultVoiceUri,
  MACOS_SIRI_VOICE_UNAVAILABLE_HINT,
  MACOS_SYSTEM_DEFAULT_VOICE_LABEL,
  MACOS_SYSTEM_DEFAULT_VOICE_URI,
} from '@/lib/agent/system-default-voice'

export { MACOS_SIRI_VOICE_UNAVAILABLE_HINT }
import {
  getJarvisTtsMode,
  getPreferredSiriVoiceNumber,
  getPreferredVoiceUri,
  setJarvisTtsMode,
  setPreferredSiriVoiceNumber,
  setPreferredVoiceUri,
} from '@/lib/agent/voice-preference'
import type { SpeakTextOptions } from '@/lib/agent/speech-types'

function isKokoroSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined'
}

export { unlockJarvisAudio, primeSpeechSynthesis }

export { stripTextForNeuralSpeech, stripTextForSpeech }
export { OPENAI_TTS_VOICES }
export type { OpenAiTtsVoiceId }

export interface JarvisSpeechConfig {
  available: boolean
  defaultVoice: OpenAiTtsVoiceId
  model: string
  supportsInstructions?: boolean
  crossDevice?: boolean
}

/** Pausa entre compromissos da agenda (ms). */
const SPEECH_SEGMENT_PAUSE_MS = 700

export interface PortugueseVoiceOption {
  voiceURI: string
  name: string
  lang: string
  label: string
  score: number
  siriNumber: number | null
  isSiri: boolean
  isSystemDefault?: boolean
}

type ResolvedBrowserVoice =
  | { mode: 'system-default' }
  | { mode: 'explicit'; voice: SpeechSynthesisVoice }

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase()
  const uri = voice.voiceURI.toLowerCase()
  let score = 0

  if (lang.startsWith('pt-br')) score += 120
  else if (lang.startsWith('pt')) score += 70

  // Vozes Siri / Apple neural (ex.: "Voz 1" do macOS após download ~450 MB)
  if (name.includes('siri')) score += 70
  if (uri.includes('com.apple') && !uri.includes('compact')) score += 25
  if (uri.includes('com.apple.voice.premium') || uri.includes('com.apple.speech.synthesis.voice')) score += 45

  if (name.includes('premium')) score += 55
  if (name.includes('enhanced') || name.includes('melhorada') || name.includes('aprimorada')) score += 45
  if (name.includes('neural')) score += 40
  if (name.includes('natural')) score += 30
  if (name.includes('online')) score += 28
  if (name.includes('google') && name.includes('portugu')) score += 35
  if (name.includes('microsoft') && lang.startsWith('pt')) score += 30

  if (name.includes('aprimorada') || name.includes('enhanced') || name.includes('melhorada')) score += 65
  if (name.includes('felipe')) score += 95
  if (name.includes('luciana')) score += 8
  if (name.includes('joana')) score -= 200
  if (name.includes('maria')) score += 14
  if (name.includes('daniel')) score += 12

  if (voice.localService && lang.startsWith('pt-br')) score += 18

  if (!voice.localService) score += 8

  if (name.includes('super-compact') || name.includes('super compact') || uri.includes('super-compact')) score -= 50
  if (name.includes('compact') || uri.includes('.compact')) score -= 30
  if (SIRI_MASCULINE_HINTS.some((h) => name.includes(h))) score += 42
  if (name.includes('cellos')) score -= 35
  if (name.includes('samantha') && !name.includes('premium')) score -= 20

  return score
}

function formatVoiceLabel(voice: SpeechSynthesisVoice): string {
  const name = voice.name.trim()
  const lang = voice.lang.replace('_', '-')
  if (name.toLowerCase().includes('premium') || name.toLowerCase().includes('enhanced')) {
    return name
  }
  return `${name} (${lang})`
}

function buildBrowserVoicePickerLabel(voice: SpeechSynthesisVoice): string {
  const base = formatVoiceLabel(voice)
  const n = voice.name.toLowerCase()
  if (n.includes('felipe')) return `Masculina · ${base} · recomendada no Mac`
  if (SIRI_MASCULINE_HINTS.some((h) => n.includes(h))) return `Masculina · ${base} · Eloquence`
  if (n.includes('luciana') || n.includes('fernanda')) return `Feminina · ${base}`
  return base
}

function isListablePtBrVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase().replace('_', '-')
  if (lang.startsWith('pt-pt')) return false
  if (lang.startsWith('pt-br')) return true
  return isJarvisBrowserVoice(voice)
}

function applyBrowserUtteranceVoice(
  utterance: SpeechSynthesisUtterance,
  resolved: ResolvedBrowserVoice
): void {
  if (resolved.mode === 'system-default') return
  utterance.voice = resolved.voice
  utterance.lang = resolved.voice.lang?.startsWith('pt') ? resolved.voice.lang : 'pt-BR'
  utterance.pitch = jarvisBrowserVoicePitch(resolved.voice)
}

/** Alinha voiceURI salva com o número Siri (Voz 1, 2…) após atualização do macOS/navegador. */
export function syncPreferredVoiceFromSiriNumber(voices: SpeechSynthesisVoice[]): void {
  if (isMacOsSystemDefaultVoiceUri(getPreferredVoiceUri())) return
  const siriNumber = getPreferredSiriVoiceNumber()
  if (!siriNumber) return
  const byNumber = getSiriVoiceByNumber(voices, siriNumber)
  if (!byNumber || !isJarvisBrowserVoice(byNumber)) return
  const storedUri = getPreferredVoiceUri()
  if (storedUri !== byNumber.voiceURI) {
    setPreferredVoiceUri(byNumber.voiceURI)
  }
}

function resolveBrowserVoice(voices: SpeechSynthesisVoice[]): ResolvedBrowserVoice | null {
  if (isMacOsSystemDefaultVoiceUri(getPreferredVoiceUri())) {
    return { mode: 'system-default' }
  }

  syncPreferredVoiceFromSiriNumber(voices)

  const siriNumber = getPreferredSiriVoiceNumber()
  if (siriNumber) {
    const byNumber = getSiriVoiceByNumber(voices, siriNumber)
    if (byNumber && isJarvisBrowserVoice(byNumber)) return { mode: 'explicit', voice: byNumber }
  }

  const preferredUri = getPreferredVoiceUri()
  if (preferredUri) {
    const saved = voices.find((v) => v.voiceURI === preferredUri)
    if (saved && isListablePtBrVoice(saved)) return { mode: 'explicit', voice: saved }
  }

  const auto = pickBestBrazilianBrowserVoice(voices)
  return auto ? { mode: 'explicit', voice: auto } : null
}

function resolvePortugueseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const resolved = resolveBrowserVoice(voices)
  return resolved?.mode === 'explicit' ? resolved.voice : undefined
}

export async function listPortugueseVoices(): Promise<PortugueseVoiceOption[]> {
  if (!isSpeechSynthesisSupported()) return []
  const voices = await ensureVoicesLoaded()
  const siriOrdered = getSiriBrazilVoicesInSystemOrder(voices)

  const browserOptions: PortugueseVoiceOption[] = voices
    .filter(isListablePtBrVoice)
    .map((v) => {
      const siriNumber = getSiriVoiceNumber(voices, v.voiceURI)
      const isEloquence = siriNumber !== null
      return {
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        label: isEloquence
          ? buildSiriVoiceLabel(v, siriNumber, siriOrdered)
          : buildBrowserVoicePickerLabel(v),
        score: Math.max(voiceQualityScore(v), scoreBrazilianBrowserVoice(v)),
        siriNumber,
        isSiri: isEloquence,
      }
    })
    .sort((a, b) => b.score - a.score)

  if (!isLikelyMacOs()) return browserOptions

  const systemDefault: PortugueseVoiceOption = {
    voiceURI: MACOS_SYSTEM_DEFAULT_VOICE_URI,
    name: 'Automática',
    lang: 'pt-BR',
    label: MACOS_SYSTEM_DEFAULT_VOICE_LABEL,
    score: -100,
    siriNumber: null,
    isSiri: false,
    isSystemDefault: true,
  }

  return [...browserOptions, systemDefault]
}

export async function previewVoice(text: string, voiceURI?: string | null): Promise<void> {
  if (!isSpeechSynthesisSupported()) return
  stopSpeaking()
  const voices = await ensureVoicesLoaded()

  let resolved: ResolvedBrowserVoice | null = null
  if (voiceURI && isMacOsSystemDefaultVoiceUri(voiceURI)) {
    resolved = { mode: 'system-default' }
  } else if (voiceURI) {
    const voice = voices.find((v) => v.voiceURI === voiceURI)
    if (voice) resolved = { mode: 'explicit', voice }
  } else {
    resolved = resolveBrowserVoice(voices)
  }
  if (!resolved) return

  const utterance = new SpeechSynthesisUtterance(stripTextForSpeech(text))
  utterance.lang = 'pt-BR'
  utterance.rate = 0.92
  if (resolved.mode === 'system-default') {
    utterance.pitch = 1
  } else {
    applyBrowserUtteranceVoice(utterance, resolved)
  }
  window.speechSynthesis.speak(utterance)
}

let voicesReady = false

function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve([])
  }

  const existing = window.speechSynthesis.getVoices()
  if (existing.length > 0) {
    voicesReady = true
    return Promise.resolve(existing)
  }

  if (voicesReady) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const finish = () => {
      voicesReady = true
      resolve(window.speechSynthesis.getVoices())
    }

    window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true })
    window.setTimeout(finish, 600)
  })
}

function releaseCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }
}

export function stopSpeaking(): void {
  segmentSpeechCancelled = true
  if (typeof window !== 'undefined') {
    void import('@/lib/agent/kokoro-engine')
      .then((m) => m.stopKokoroSpeech())
      .catch(() => {})
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  releaseCurrentAudio()
}

export type { SpeakTextOptions } from '@/lib/agent/speech-types'

function stripSpeechSegment(text: string): string {
  return text
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function waitForAudioEnd(audio: HTMLAudioElement): Promise<void> {
  return new Promise((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('audio playback failed'))
  })
}

async function playNeuralBlob(blob: Blob, options: SpeakTextOptions): Promise<boolean> {
  releaseCurrentAudio()
  const url = URL.createObjectURL(blob)
  currentAudioUrl = url

  const audio = new Audio(url)
  configureJarvisAudioElement(audio)
  currentAudio = audio
  let started = false

  audio.onplay = () => {
    if (!started) {
      started = true
      options.onStart?.()
    }
  }

  try {
    primeSpeechSynthesis()
    await audio.play()
    await waitForAudioEnd(audio)
    releaseCurrentAudio()
    return true
  } catch {
    options.onError?.()
    releaseCurrentAudio()
    return false
  }
}

let cachedSpeechConfig: JarvisSpeechConfig | null = null

export function invalidateJarvisSpeechConfigCache(): void {
  cachedSpeechConfig = null
}

export async function fetchJarvisSpeechConfig(): Promise<JarvisSpeechConfig> {
  if (cachedSpeechConfig) return cachedSpeechConfig

  try {
    const res = await fetch('/api/agent/speech', { cache: 'no-store' })
    if (!res.ok) {
      return { available: false, defaultVoice: 'onyx', model: 'tts-1-hd' }
    }
    const data = (await res.json()) as JarvisSpeechConfig
    cachedSpeechConfig = data
    if (!data.available) setJarvisTtsMode('system')
    return data
  } catch {
    return { available: false, defaultVoice: 'onyx', model: 'tts-1-hd' }
  }
}

export function getActiveJarvisVoiceLabel(voiceId: OpenAiTtsVoiceId): string {
  return getOpenAiVoiceLabel(voiceId)
}

/** Padrão Jarvis no Mac: Felipe (Aprimorada) se o navegador expuser; senão melhor masculina pt-BR. */
export async function ensureJarvisSystemVoiceDefault(): Promise<void> {
  if (!isSpeechSynthesisSupported()) return
  if (getPreferredVoiceUri() || getPreferredSiriVoiceNumber()) return

  const voices = await ensureVoicesLoaded()
  const pick = isLikelyMacOs()
    ? pickPreferredMasculineBrazilVoice(voices)
    : pickBestBrazilianBrowserVoice(voices)
  if (!pick) return

  setPreferredVoiceUri(pick.voiceURI)
  setJarvisTtsMode('system')
}

/** Nome da voz do sistema em uso. */
export async function getLiveJarvisSystemVoiceLabel(): Promise<string> {
  if (!isSpeechSynthesisSupported()) return 'indisponível'
  await ensureJarvisSystemVoiceDefault()
  if (isMacOsSystemDefaultVoiceUri(getPreferredVoiceUri())) {
    return MACOS_SYSTEM_DEFAULT_VOICE_LABEL
  }
  const voices = await ensureVoicesLoaded()
  const voice = resolvePortugueseVoice(voices)
  return voice?.name ?? 'pt-BR automática'
}

async function fetchNeuralSpeechBlob(text: string, voice?: OpenAiTtsVoiceId): Promise<Blob | null> {
  const config = await fetchJarvisSpeechConfig()
  const { resolvePreferredOpenAiVoice } = await import('@/lib/agent/voice-preference')
  const effectiveVoice = voice ?? resolvePreferredOpenAiVoice(config.defaultVoice)

  const res = await fetch('/api/agent/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: effectiveVoice }),
    cache: 'no-store',
  })
  if (!res.ok) return null
  const blob = await res.blob()
  return blob.size ? blob : null
}

export async function previewOpenAiVoice(text: string, voiceId: OpenAiTtsVoiceId): Promise<boolean> {
  if (typeof window === 'undefined') return false

  stopSpeaking()
  const blob = await fetchNeuralSpeechBlob(text, voiceId)
  if (!blob) return false

  releaseCurrentAudio()
  const url = URL.createObjectURL(blob)
  currentAudioUrl = url
  const audio = new Audio(url)
  configureJarvisAudioElement(audio)
  currentAudio = audio

  try {
    primeSpeechSynthesis()
    await audio.play()
    await waitForAudioEnd(audio)
    releaseCurrentAudio()
    return true
  } catch {
    releaseCurrentAudio()
    return false
  }
}

async function speakWithNeuralApi(
  text: string,
  options: SpeakTextOptions
): Promise<(() => void) | null> {
  if (typeof window === 'undefined') return null
  if (options.preferNeural === false) return null

  try {
    if (options.segments && options.segments.length > 0) {
      segmentSpeechCancelled = false

      for (let i = 0; i < options.segments.length; i += 1) {
        if (segmentSpeechCancelled) return stopSpeaking

        const chunk = stripSpeechSegment(options.segments[i]).slice(0, MAX_SPEAK_CHARS)
        if (!chunk) continue

        const blob = await fetchNeuralSpeechBlob(chunk)
        if (!blob) return null

        const ok = await playNeuralBlob(blob, options)
        if (!ok) return null

        const isLast = i === options.segments.length - 1
        if (!isLast && !segmentSpeechCancelled) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, SPEECH_SEGMENT_PAUSE_MS)
          })
        }
      }

      if (!segmentSpeechCancelled) options.onEnd?.()
      return stopSpeaking
    }

    const blob = await fetchNeuralSpeechBlob(stripTextForNeuralSpeech(text))
    if (!blob) return null

    const ok = await playNeuralBlob(blob, options)
    if (!ok) return null
    options.onEnd?.()
    return stopSpeaking
  } catch {
    return null
  }
}

let segmentSpeechCancelled = false

async function speakWithBrowserSegments(
  segments: string[],
  options: SpeakTextOptions
): Promise<() => void> {
  const noop = () => {}

  if (!isSpeechSynthesisSupported()) return noop

  const cleanedSegments = segments
    .map((s) => stripSpeechSegment(s))
    .filter(Boolean)
    .map((s) => s.slice(0, MAX_SPEAK_CHARS))

  if (cleanedSegments.length === 0) return noop

  primeSpeechSynthesis()
  window.speechSynthesis.cancel()
  segmentSpeechCancelled = false

  const voices = await ensureVoicesLoaded()
  const resolved = resolveBrowserVoice(voices)
  if (!resolved) return noop
  let index = 0
  let started = false

  const cancel = () => {
    segmentSpeechCancelled = true
    stopSpeaking()
  }

  const speakNext = () => {
    if (segmentSpeechCancelled || index >= cleanedSegments.length) {
      if (!segmentSpeechCancelled) options.onEnd?.()
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleanedSegments[index])
    utterance.lang = options.lang ?? 'pt-BR'
    utterance.rate = options.rate ?? 0.9
    if (resolved.mode === 'system-default') {
      utterance.pitch = 1
    } else {
      applyBrowserUtteranceVoice(utterance, resolved)
    }

    utterance.onstart = () => {
      if (!started) {
        started = true
        options.onStart?.()
      }
    }
    utterance.onend = () => {
      if (segmentSpeechCancelled) return
      index += 1
      if (index < cleanedSegments.length) {
        window.setTimeout(speakNext, SPEECH_SEGMENT_PAUSE_MS)
      } else {
        options.onEnd?.()
      }
    }
    utterance.onerror = () => {
      options.onError?.()
      options.onEnd?.()
    }

    window.speechSynthesis.speak(utterance)
  }

  speakNext()
  return cancel
}

async function speakWithBrowser(
  text: string,
  options: SpeakTextOptions
): Promise<() => void> {
  if (options.segments && options.segments.length > 0) {
    return speakWithBrowserSegments(options.segments, options)
  }

  const noop = () => {}

  if (!isSpeechSynthesisSupported()) return noop

  const cleaned = stripTextForSpeech(text)
  if (!cleaned) return noop

  primeSpeechSynthesis()
  window.speechSynthesis.cancel()

  const voices = await ensureVoicesLoaded()
  const resolved = resolveBrowserVoice(voices)
  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.lang = options.lang ?? 'pt-BR'
  utterance.rate = options.rate ?? 0.9
  if (!resolved) {
    options.onError?.()
    options.onEnd?.()
    return noop
  }
  if (resolved.mode === 'system-default') {
    utterance.pitch = 1
  } else {
    applyBrowserUtteranceVoice(utterance, resolved)
  }

  utterance.onstart = () => options.onStart?.()
  utterance.onend = () => options.onEnd?.()
  utterance.onerror = () => {
    options.onError?.()
    options.onEnd?.()
  }

  window.speechSynthesis.speak(utterance)
  return stopSpeaking
}

/**
 * Fala o texto com voz do sistema (padrão) ou OpenAI TTS se modo «openai» e API configurada.
 */
async function warmAudioOutput(): Promise<void> {
  if (typeof window === 'undefined') return
  primeSpeechSynthesis()
  try {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    )
    configureJarvisAudioElement(audio)
    audio.volume = 0.01
    await audio.play()
    audio.pause()
  } catch {
    /* sessão pode ainda estar bloqueada — fallback para speechSynthesis */
  }
}

export async function speakText(text: string, options: SpeakTextOptions = {}): Promise<() => void> {
  await warmAudioOutput()
  stopSpeaking()

  const mode = typeof window !== 'undefined' ? getJarvisTtsMode() : 'system'
  const config = typeof window !== 'undefined' ? await fetchJarvisSpeechConfig() : null
  const neuralAvailable = config?.available ?? false
  const useKokoro = mode === 'kokoro' && isKokoroSupported() && options.preferNeural !== false
  const useOpenAi = mode === 'openai' && neuralAvailable && options.preferNeural !== false

  if (useKokoro) {
    try {
      const { speakWithKokoro } = await import('@/lib/agent/kokoro-engine')
      const kokoro = await speakWithKokoro(text, options)
      if (kokoro) return kokoro
    } catch {
      /* fallback para voz do sistema */
    }
  }

  if (useOpenAi) {
    const neural = await speakWithNeuralApi(text, options)
    if (neural) return neural
  }

  const browser = await speakWithBrowser(text, { ...options, rate: options.rate ?? 0.9, lang: 'pt-BR' })
  if (browser) return browser

  options.onError?.('Nenhuma voz pt-BR disponível neste dispositivo.')
  options.onEnd?.()
  return () => {}
}

/** Voz selecionada no navegador (para diagnóstico/UI). */
export async function getSelectedBrowserVoiceLabel(): Promise<string | null> {
  if (!isSpeechSynthesisSupported()) return null
  if (isMacOsSystemDefaultVoiceUri(getPreferredVoiceUri())) {
    return MACOS_SYSTEM_DEFAULT_VOICE_LABEL
  }
  const voices = await ensureVoicesLoaded()
  const voice = resolvePortugueseVoice(voices)
  return voice?.name ?? null
}
