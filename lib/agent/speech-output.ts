import {
  buildSiriVoiceLabel,
  getSiriBrazilVoicesInSystemOrder,
  getSiriVoiceByNumber,
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
  getJarvisTtsMode,
  getPreferredSiriVoiceNumber,
  getPreferredVoiceUri,
  resolvePreferredOpenAiVoice,
} from '@/lib/agent/voice-preference'

export { stripTextForNeuralSpeech, stripTextForSpeech }
export { OPENAI_TTS_VOICES }
export type { OpenAiTtsVoiceId }

export interface JarvisSpeechConfig {
  available: boolean
  defaultVoice: OpenAiTtsVoiceId
  model: string
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
}

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

  if (name.includes('luciana')) score += 28
  if (name.includes('joana')) score += 22
  if (name.includes('felipe')) score += 18
  if (name.includes('maria')) score += 14
  if (name.includes('daniel')) score += 12

  if (voice.localService && lang.startsWith('pt-br')) score += 18

  if (!voice.localService) score += 8

  if (name.includes('super-compact') || name.includes('super compact') || uri.includes('super-compact')) score -= 90
  if (name.includes('compact') || uri.includes('.compact')) score -= 65
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

function resolvePortugueseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const preferredUri = getPreferredVoiceUri()
  if (preferredUri) {
    const saved = voices.find((v) => v.voiceURI === preferredUri)
    if (saved) return saved
  }

  const siriNumber = getPreferredSiriVoiceNumber()
  if (siriNumber) {
    const byNumber = getSiriVoiceByNumber(voices, siriNumber)
    if (byNumber) return byNumber
  }

  const ranked = voices
    .filter((v) => v.lang.toLowerCase().startsWith('pt'))
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a))

  return ranked[0]
}

function pickPortugueseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return resolvePortugueseVoice(voices)
}

export async function listPortugueseVoices(): Promise<PortugueseVoiceOption[]> {
  if (!isSpeechSynthesisSupported()) return []
  const voices = await ensureVoicesLoaded()
  const siriOrdered = getSiriBrazilVoicesInSystemOrder(voices)
  const siriUris = new Set(siriOrdered.map((v) => v.voiceURI))

  const siriOptions: PortugueseVoiceOption[] = siriOrdered.map((v, index) => {
    const siriNumber = index + 1
    return {
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      label: buildSiriVoiceLabel(v, siriNumber, siriOrdered),
      score: voiceQualityScore(v),
      siriNumber,
      isSiri: true,
    }
  })

  const otherOptions: PortugueseVoiceOption[] = voices
    .filter((v) => v.lang.toLowerCase().startsWith('pt') && !siriUris.has(v.voiceURI))
    .map((v) => ({
      voiceURI: v.voiceURI,
      name: v.name,
      lang: v.lang,
      label: `Outra · ${formatVoiceLabel(v)}`,
      score: voiceQualityScore(v),
      siriNumber: null,
      isSiri: false,
    }))
    .sort((a, b) => b.score - a.score)

  return [...siriOptions, ...otherOptions]
}

export async function previewVoice(text: string, voiceURI: string): Promise<void> {
  if (!isSpeechSynthesisSupported()) return
  stopSpeaking()
  const voices = await ensureVoicesLoaded()
  const voice = voices.find((v) => v.voiceURI === voiceURI)
  if (!voice) return

  const utterance = new SpeechSynthesisUtterance(stripTextForSpeech(text))
  utterance.voice = voice
  utterance.lang = voice.lang || 'pt-BR'
  utterance.rate = 0.92
  utterance.pitch = 0.98
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
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
  releaseCurrentAudio()
}

export interface SpeakTextOptions {
  lang?: string
  rate?: number
  preferNeural?: boolean
  /** Um segmento por compromisso — fala com pausa entre cada item. */
  segments?: string[]
  onStart?: () => void
  onEnd?: () => void
  onError?: () => void
}

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
  currentAudio = audio
  let started = false

  audio.onplay = () => {
    if (!started) {
      started = true
      options.onStart?.()
    }
  }

  try {
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

export async function fetchJarvisSpeechConfig(): Promise<JarvisSpeechConfig> {
  if (cachedSpeechConfig) return cachedSpeechConfig

  try {
    const res = await fetch('/api/agent/speech', { cache: 'no-store' })
    if (!res.ok) {
      return { available: false, defaultVoice: 'coral', model: 'tts-1-hd' }
    }
    const data = (await res.json()) as JarvisSpeechConfig
    cachedSpeechConfig = data
    return data
  } catch {
    return { available: false, defaultVoice: 'coral', model: 'tts-1-hd' }
  }
}

export function getActiveJarvisVoiceLabel(voiceId: OpenAiTtsVoiceId): string {
  return getOpenAiVoiceLabel(voiceId)
}

async function fetchNeuralSpeechBlob(text: string, voice?: OpenAiTtsVoiceId): Promise<Blob | null> {
  const config = await fetchJarvisSpeechConfig()
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
  currentAudio = audio

  try {
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

  window.speechSynthesis.cancel()
  segmentSpeechCancelled = false

  const voices = await ensureVoicesLoaded()
  const voice = resolvePortugueseVoice(voices)
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
    utterance.pitch = 0.97
    if (voice) utterance.voice = voice

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

  window.speechSynthesis.cancel()

  const voices = await ensureVoicesLoaded()
  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.lang = options.lang ?? 'pt-BR'
  utterance.rate = options.rate ?? 0.9
  utterance.pitch = 0.97

  const voice = resolvePortugueseVoice(voices)
  if (voice) utterance.voice = voice

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
 * Fala o texto: prioriza OpenAI TTS (voz fixa em todos os dispositivos); Siri só como fallback.
 */
export async function speakText(text: string, options: SpeakTextOptions = {}): Promise<() => void> {
  stopSpeaking()

  const mode = typeof window !== 'undefined' ? getJarvisTtsMode() : 'openai'
  const tryOpenAiFirst = mode === 'openai' && options.preferNeural !== false

  if (tryOpenAiFirst) {
    const neural = await speakWithNeuralApi(text, options)
    if (neural) return neural
  }

  const browser = await speakWithBrowser(text, { ...options, rate: options.rate ?? 0.92 })
  if (browser) return browser

  if (!tryOpenAiFirst && options.preferNeural !== false) {
    const neural = await speakWithNeuralApi(text, options)
    if (neural) return neural
  }

  return () => {}
}

/** Voz selecionada no navegador (para diagnóstico/UI). */
export async function getSelectedBrowserVoiceLabel(): Promise<string | null> {
  if (!isSpeechSynthesisSupported()) return null
  const voices = await ensureVoicesLoaded()
  const voice = pickPortugueseVoice(voices)
  return voice?.name ?? null
}
