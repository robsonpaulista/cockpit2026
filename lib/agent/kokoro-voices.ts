/** Vozes Kokoro recomendadas para o Jarvis (modelo em inglês, boa para frases curtas). */
export const KOKORO_JARVIS_VOICES = [
  { id: 'af_nova', label: 'Nova — feminina, natural', gender: 'f' as const, grade: 'C' },
  { id: 'af_heart', label: 'Heart — feminina, expressiva', gender: 'f' as const, grade: 'A' },
  { id: 'am_adam', label: 'Adam — masculina, comando', gender: 'm' as const, grade: 'F+' },
  { id: 'am_fenrir', label: 'Fenrir — masculina, firme', gender: 'm' as const, grade: 'C+' },
  { id: 'af_bella', label: 'Bella — feminina, alta qualidade', gender: 'f' as const, grade: 'A-' },
] as const

export type KokoroVoiceId = (typeof KOKORO_JARVIS_VOICES)[number]['id']

export const DEFAULT_KOKORO_VOICE: KokoroVoiceId = 'af_nova'

const KOKORO_VOICE_IDS = new Set<string>(KOKORO_JARVIS_VOICES.map((v) => v.id))

export function isValidKokoroVoiceId(id: string): id is KokoroVoiceId {
  return KOKORO_VOICE_IDS.has(id)
}

export function getKokoroVoiceLabel(id: KokoroVoiceId): string {
  return KOKORO_JARVIS_VOICES.find((v) => v.id === id)?.label ?? id
}
