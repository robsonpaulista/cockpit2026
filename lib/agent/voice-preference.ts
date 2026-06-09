import {
  DEFAULT_OPENAI_TTS_VOICE,
  isValidOpenAiTtsVoice,
  type OpenAiTtsVoiceId,
  resolveOpenAiTtsVoice,
} from '@/lib/agent/openai-voices'

export type JarvisTtsMode = 'system' | 'openai'

const VOICE_URI_KEY = 'jarvis-voice-uri'
const SIRI_VOICE_NUM_KEY = 'jarvis-siri-voice-number'
const TTS_MODE_KEY = 'jarvis-tts-mode'
const OPENAI_VOICE_KEY = 'jarvis-openai-voice'

/** Padrão: TTS neural (OpenAI) — mesma voz em todos os dispositivos. */
export function getJarvisTtsMode(): JarvisTtsMode {
  if (typeof window === 'undefined') return 'openai'
  const stored = localStorage.getItem(TTS_MODE_KEY)
  if (stored === 'system') return 'system'
  return 'openai'
}

export function setJarvisTtsMode(mode: JarvisTtsMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TTS_MODE_KEY, mode)
}

export function getPreferredOpenAiVoice(): OpenAiTtsVoiceId | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(OPENAI_VOICE_KEY)
  if (!stored || !isValidOpenAiTtsVoice(stored)) return null
  return stored
}

export function setPreferredOpenAiVoice(voice: OpenAiTtsVoiceId | null): void {
  if (typeof window === 'undefined') return
  if (!voice) localStorage.removeItem(OPENAI_VOICE_KEY)
  else localStorage.setItem(OPENAI_VOICE_KEY, voice)
}

/** Voz efetiva: preferência do usuário ou padrão do servidor. */
export function resolvePreferredOpenAiVoice(serverDefault?: string | null): OpenAiTtsVoiceId {
  return getPreferredOpenAiVoice() ?? resolveOpenAiTtsVoice(serverDefault, DEFAULT_OPENAI_TTS_VOICE)
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
