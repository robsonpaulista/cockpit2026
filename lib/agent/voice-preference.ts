import {
  DEFAULT_OPENAI_TTS_VOICE,
  isValidOpenAiTtsVoice,
  LEGACY_FEMININE_AUTO_VOICES,
  resolveOpenAiTtsVoice,
  type OpenAiTtsVoiceId,
} from '@/lib/agent/openai-voices'

import {
  DEFAULT_KOKORO_VOICE,
  isValidKokoroVoiceId,
  type KokoroVoiceId,
} from '@/lib/agent/kokoro-voices'
import {
  isLikelyMacOs,
  isMacOsSystemDefaultVoiceUri,
  MACOS_SYSTEM_DEFAULT_VOICE_URI,
} from '@/lib/agent/system-default-voice'

export type JarvisTtsMode = 'system' | 'openai' | 'kokoro'

const VOICE_URI_KEY = 'jarvis-voice-uri'
const SIRI_VOICE_NUM_KEY = 'jarvis-siri-voice-number'
const TTS_MODE_KEY = 'jarvis-tts-mode'
const OPENAI_VOICE_KEY = 'jarvis-openai-voice'
const OPENAI_VOICE_EXPLICIT_KEY = 'jarvis-openai-voice-explicit'
const VOICE_MIGRATION_KEY = 'jarvis-voice-migration-v4'
const SYSTEM_MODE_MIGRATION_KEY = 'jarvis-voice-migration-v5'
const MAC_SYSTEM_VOICE_MIGRATION_KEY = 'jarvis-voice-migration-v6'
const FELIPE_DEFAULT_MIGRATION_KEY = 'jarvis-voice-migration-v7'
const VOICE_OUTPUT_KEY = 'jarvis-voice-output-enabled'
const KOKORO_VOICE_KEY = 'jarvis-kokoro-voice'

/** Respostas faladas (TTS) — independente do microfone. Padrão: ligado. */
export function getJarvisVoiceOutputEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(VOICE_OUTPUT_KEY)
  if (stored === '0' || stored === 'false') return false
  return true
}

export function setJarvisVoiceOutputEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(VOICE_OUTPUT_KEY, enabled ? '1' : '0')
}

export function isFeminineOpenAiVoice(voice: OpenAiTtsVoiceId): boolean {
  return LEGACY_FEMININE_AUTO_VOICES.has(voice) || voice === 'ballad' || voice === 'verse'
}

/** Padrão: voz do sistema/navegador (Siri, pt-BR). OpenAI só se configurado e escolhido. */
export function getJarvisTtsMode(): JarvisTtsMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(TTS_MODE_KEY)
  if (stored === 'openai') return 'openai'
  if (stored === 'kokoro') return 'kokoro'
  return 'system'
}

export function hasExplicitOpenAiVoicePick(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(OPENAI_VOICE_EXPLICIT_KEY) === '1'
}

/** Volta ao modo sistema (sem OpenAI) quem foi migrado para openai sem escolha explícita. */
export function applyJarvisSystemModeMigration(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(SYSTEM_MODE_MIGRATION_KEY) === '1') return
  if (getJarvisTtsMode() === 'openai' && !hasExplicitOpenAiVoicePick()) {
    setJarvisTtsMode('system')
  }
  localStorage.setItem(SYSTEM_MODE_MIGRATION_KEY, '1')
}

/** v6 legado — mantido para não reexecutar em instalações antigas. */
export function applyJarvisMacSystemVoiceMigration(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MAC_SYSTEM_VOICE_MIGRATION_KEY) === '1') return
  localStorage.setItem(MAC_SYSTEM_VOICE_MIGRATION_KEY, '1')
}

/**
 * Sai do modo "automática" (caía na Luciana) e de URIs Eloquence enganosas.
 * A preferência explícita passa a ser definida por ensureJarvisSystemVoiceDefault (Felipe se instalado).
 */
export function applyJarvisFelipeDefaultMigration(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(FELIPE_DEFAULT_MIGRATION_KEY) === '1') return
  if (!isLikelyMacOs() || getJarvisTtsMode() !== 'system') {
    localStorage.setItem(FELIPE_DEFAULT_MIGRATION_KEY, '1')
    return
  }

  const uri = getPreferredVoiceUri()
  const siriNum = getPreferredSiriVoiceNumber()
  const shouldReset =
    isMacOsSystemDefaultVoiceUri(uri) ||
    Boolean(siriNum) ||
    (uri &&
      ['reed', 'eddy', 'eddie', 'rocko', 'luciana', 'flo', 'shelley', 'sandy', 'grandma', 'grandpa'].some(
        (h) => uri.toLowerCase().includes(h)
      ))

  if (shouldReset) {
    setPreferredVoiceUri(null)
    setPreferredSiriVoiceNumber(null)
  }

  localStorage.setItem(FELIPE_DEFAULT_MIGRATION_KEY, '1')
}

/** Uma vez por navegador: remove vozes femininas antigas (Coral, Marin…) → Onyx. */
export function applyJarvisVoiceMigration(): void {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(VOICE_MIGRATION_KEY) === '1') return

  const stored = getPreferredOpenAiVoice()
  if (!stored || isFeminineOpenAiVoice(stored)) {
    setPreferredOpenAiVoice(DEFAULT_OPENAI_TTS_VOICE, false)
  }
  localStorage.setItem(VOICE_MIGRATION_KEY, '1')
}

/** Alinha com Onyx até o usuário escolher outra voz explicitamente no seletor. */
export function ensureJarvisNeuralVoicePreference(serverDefault?: string): void {
  if (typeof window === 'undefined') return
  applyJarvisVoiceMigration()
  if (getJarvisTtsMode() !== 'openai') return

  const jarvisDefault = DEFAULT_OPENAI_TTS_VOICE
  const stored = getPreferredOpenAiVoice()
  const explicit = hasExplicitOpenAiVoicePick()

  if (!stored || isFeminineOpenAiVoice(stored)) {
    setPreferredOpenAiVoice(jarvisDefault, false)
    return
  }

  if (!explicit) {
    const serverNorm = resolveOpenAiTtsVoice(serverDefault, jarvisDefault)
    if (stored !== serverNorm && serverNorm === jarvisDefault) {
      setPreferredOpenAiVoice(jarvisDefault, false)
    }
  }
}

export function setJarvisTtsMode(mode: JarvisTtsMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TTS_MODE_KEY, mode)
}

export function getPreferredKokoroVoice(): KokoroVoiceId {
  if (typeof window === 'undefined') return DEFAULT_KOKORO_VOICE
  const stored = localStorage.getItem(KOKORO_VOICE_KEY)
  if (stored && isValidKokoroVoiceId(stored)) return stored
  return DEFAULT_KOKORO_VOICE
}

export function setPreferredKokoroVoice(voice: KokoroVoiceId): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KOKORO_VOICE_KEY, voice)
}

export function getPreferredOpenAiVoice(): OpenAiTtsVoiceId | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(OPENAI_VOICE_KEY)
  if (!stored || !isValidOpenAiTtsVoice(stored)) return null
  return stored
}

export function setPreferredOpenAiVoice(
  voice: OpenAiTtsVoiceId | null,
  userExplicitPick = true
): void {
  if (typeof window === 'undefined') return
  if (!voice) {
    localStorage.removeItem(OPENAI_VOICE_KEY)
    localStorage.removeItem(OPENAI_VOICE_EXPLICIT_KEY)
    return
  }
  localStorage.setItem(OPENAI_VOICE_KEY, voice)
  if (userExplicitPick) {
    localStorage.setItem(OPENAI_VOICE_EXPLICIT_KEY, '1')
  } else {
    localStorage.removeItem(OPENAI_VOICE_EXPLICIT_KEY)
  }
}

/** Voz usada no TTS — sempre leia do localStorage (fonte única). */
export function resolvePreferredOpenAiVoice(serverDefault?: string | null): OpenAiTtsVoiceId {
  return getPreferredOpenAiVoice() ?? resolveOpenAiTtsVoice(serverDefault, DEFAULT_OPENAI_TTS_VOICE)
}

export function getActiveJarvisOpenAiVoice(serverDefault?: string | null): OpenAiTtsVoiceId {
  return resolvePreferredOpenAiVoice(serverDefault)
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
