/**
 * Vozes expostas pelo Web Speech API no macOS (Reed, Eddy, Luciana…).
 * São do pacote Eloquence — NÃO são a voz neural Siri dos Ajustes (Voz 1 / Voz 2).
 * Para a Siri real, use MACOS_SYSTEM_DEFAULT_VOICE_URI (sem utterance.voice).
 */

/** Personalidades Siri pt-BR (macOS) — usado também em brazil-browser-voice. */
export const SIRI_PERSONALITY_HINTS = [
  'luciana',
  'felipe',
  'eddy',
  'eddie',
  'flo',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'grandma',
  'grandpa',
] as const

export const SIRI_MASCULINE_HINTS = ['felipe', 'eddy', 'eddie', 'reed', 'rocko', 'grandpa'] as const

export const SIRI_FEMININE_HINTS = ['luciana', 'flo', 'sandy', 'shelley', 'grandma'] as const

export function siriVoiceGenderHint(name: string): 'masculina' | 'feminina' | null {
  const n = name.toLowerCase()
  if (SIRI_MASCULINE_HINTS.some((h) => n.includes(h))) return 'masculina'
  if (SIRI_FEMININE_HINTS.some((h) => n.includes(h))) return 'feminina'
  return null
}

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace('_', '-')
}

function baseVoiceName(name: string): string {
  return name.split('(')[0]?.trim() || name.trim()
}

function isCompactSiriVoice(uri: string): boolean {
  return uri.includes('compact') || uri.includes('super-compact')
}

export function isSiriBrazilVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = normalizeLang(voice.lang)
  const uri = voice.voiceURI.toLowerCase()
  const base = baseVoiceName(voice.name).toLowerCase()
  const isPersonality = SIRI_PERSONALITY_HINTS.some((hint) => base.includes(hint))
  const isAppleLocal = uri.includes('com.apple') && voice.localService
  const isApplePtBr =
    uri.includes('pt-br') || uri.includes('pt_br') || uri.includes('portuguese (brazil)')

  if (lang.startsWith('pt-br')) {
    if (isPersonality || isAppleLocal || isApplePtBr) return true
    if (base.includes('siri')) return true
    return false
  }

  // Alguns macOS reportam só "pt" para personalidades Siri brasileiras (ex.: Reed, Eddy).
  if ((lang === 'pt' || lang.startsWith('pt-')) && (isPersonality || isApplePtBr || isAppleLocal)) {
    return true
  }

  return false
}

export function isPremiumSiriBrazilVoice(voice: SpeechSynthesisVoice): boolean {
  if (!isSiriBrazilVoice(voice)) return false
  return !isCompactSiriVoice(voice.voiceURI.toLowerCase())
}

/**
 * Vozes Siri pt-BR na ordem do sistema (Voz 1 = primeira, Voz 2 = segunda…).
 */
export function getSiriBrazilVoicesInSystemOrder(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice[] {
  return voices
    .map((voice, registrationIndex) => ({ voice, registrationIndex }))
    .filter(({ voice }) => isSiriBrazilVoice(voice))
    .sort((a, b) => a.registrationIndex - b.registrationIndex)
    .map(({ voice }) => voice)
}

export function getSiriVoiceByNumber(
  voices: SpeechSynthesisVoice[],
  number: number
): SpeechSynthesisVoice | undefined {
  if (number < 1) return undefined
  return getSiriBrazilVoicesInSystemOrder(voices)[number - 1]
}

export function getSiriVoiceNumber(
  voices: SpeechSynthesisVoice[],
  voiceURI: string
): number | null {
  const ordered = getSiriBrazilVoicesInSystemOrder(voices)
  const index = ordered.findIndex((v) => v.voiceURI === voiceURI)
  return index >= 0 ? index + 1 : null
}

export function buildSiriVoiceLabel(
  voice: SpeechSynthesisVoice,
  siriNumber: number,
  allSiriVoices: SpeechSynthesisVoice[]
): string {
  const base = baseVoiceName(voice.name)
  const allNames = allSiriVoices.map((v) => baseVoiceName(v.name))
  const namesAreDistinct = new Set(allNames).size === allNames.length

  const gender = siriVoiceGenderHint(base)
  const genderTag = gender === 'masculina' ? ' · M' : gender === 'feminina' ? ' · F' : ''
  const compactTag = isCompactSiriVoice(voice.voiceURI.toLowerCase()) ? ' · compact' : ''

  if (namesAreDistinct && base.length > 0) {
    return `Navegador · ${base}${genderTag}${compactTag}`
  }
  return `Navegador · opção ${siriNumber}${genderTag}${compactTag}`
}
