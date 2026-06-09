/**
 * Mapeia vozes pt-BR do macOS para a numeração dos Ajustes do Siri (Voz 1, Voz 2…).
 * A ordem segue o índice de registro em speechSynthesis.getVoices() — igual ao menu do sistema.
 */

const SIRI_PERSONALITY_HINTS = [
  'luciana',
  'eddy',
  'eddie',
  'flo',
  'reed',
  'rocko',
  'sandy',
  'shelley',
  'grandma',
  'grandpa',
]

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace('_', '-')
}

function baseVoiceName(name: string): string {
  return name.split('(')[0]?.trim() || name.trim()
}

export function isSiriBrazilVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = normalizeLang(voice.lang)
  if (!lang.startsWith('pt-br')) return false

  const uri = voice.voiceURI.toLowerCase()
  if (uri.includes('compact') || uri.includes('super-compact')) return false

  const base = baseVoiceName(voice.name).toLowerCase()
  if (SIRI_PERSONALITY_HINTS.some((hint) => base.includes(hint))) return true

  return uri.includes('com.apple') && voice.localService
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

  if (namesAreDistinct && base.length > 0) {
    return `Siri · Voz ${siriNumber} — ${base}`
  }
  return `Siri · Voz ${siriNumber}`
}
