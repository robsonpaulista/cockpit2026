export type JarvisTtsMode = 'system' | 'openai'

const VOICE_URI_KEY = 'jarvis-voice-uri'
const SIRI_VOICE_NUM_KEY = 'jarvis-siri-voice-number'
const TTS_MODE_KEY = 'jarvis-tts-mode'

export function getJarvisTtsMode(): JarvisTtsMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(TTS_MODE_KEY)
  return stored === 'openai' ? 'openai' : 'system'
}

export function setJarvisTtsMode(mode: JarvisTtsMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TTS_MODE_KEY, mode)
}

export function getPreferredVoiceUri(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(VOICE_URI_KEY)
}

export function setPreferredVoiceUri(uri: string | null): void {
  if (typeof window === 'undefined') return
  if (!uri) localStorage.removeItem(VOICE_URI_KEY)
  else localStorage.setItem(VOICE_URI_KEY, uri)
}

/** Número da voz nos Ajustes do Siri (1 = Voz 1, 2 = Voz 2…). */
export function getPreferredSiriVoiceNumber(): number | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(SIRI_VOICE_NUM_KEY)
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null
}

export function setPreferredSiriVoiceNumber(number: number | null): void {
  if (typeof window === 'undefined') return
  if (!number) localStorage.removeItem(SIRI_VOICE_NUM_KEY)
  else localStorage.setItem(SIRI_VOICE_NUM_KEY, String(number))
}
