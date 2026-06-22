/** Vozes fixas do OpenAI TTS — mesmas em qualquer máquina/navegador. */
export const OPENAI_TTS_VOICES = [
  { id: 'onyx', label: 'Onyx', tone: 'Masculina, grave — padrão IA Cockpit' },
  { id: 'echo', label: 'Echo', tone: 'Masculina, direta, assistente' },
  { id: 'ash', label: 'Ash', tone: 'Masculina, casual' },
  { id: 'cedar', label: 'Cedar', tone: 'Masculina, calma e confiante' },
  { id: 'fable', label: 'Fable', tone: 'Masculina, narrativa' },
  { id: 'alloy', label: 'Alloy', tone: 'Neutra, versátil' },
  { id: 'verse', label: 'Verse', tone: 'Expressiva, dinâmica' },
  { id: 'marin', label: 'Marin', tone: 'Feminina, natural' },
  { id: 'coral', label: 'Coral', tone: 'Feminina, conversacional' },
  { id: 'sage', label: 'Sage', tone: 'Feminina, calma' },
  { id: 'nova', label: 'Nova', tone: 'Feminina, jovem' },
  { id: 'shimmer', label: 'Shimmer', tone: 'Feminina, suave' },
  { id: 'ballad', label: 'Ballad', tone: 'Quente, melodiosa' },
] as const

export type OpenAiTtsVoiceId = (typeof OPENAI_TTS_VOICES)[number]['id']

/** Voz padrão do Jarvis — masculina, grave, estilo assistente. */
export const DEFAULT_OPENAI_TTS_VOICE: OpenAiTtsVoiceId = 'onyx'

const VOICE_ID_SET = new Set<string>(OPENAI_TTS_VOICES.map((v) => v.id))

/** Vozes que eram padrão antigo (femininas) — migra para Onyx automaticamente. */
export const LEGACY_FEMININE_AUTO_VOICES = new Set(['marin', 'coral', 'shimmer', 'nova', 'sage'])

export function isValidOpenAiTtsVoice(value: string): value is OpenAiTtsVoiceId {
  return VOICE_ID_SET.has(value.toLowerCase())
}

export function resolveOpenAiTtsVoice(
  value: string | undefined | null,
  fallback: OpenAiTtsVoiceId = DEFAULT_OPENAI_TTS_VOICE
): OpenAiTtsVoiceId {
  const normalized = value?.trim().toLowerCase()
  if (normalized && isValidOpenAiTtsVoice(normalized)) {
    return normalized
  }
  return fallback
}

export function getOpenAiVoiceLabel(voiceId: OpenAiTtsVoiceId): string {
  const found = OPENAI_TTS_VOICES.find((v) => v.id === voiceId)
  return found ? `${found.label} — ${found.tone}` : voiceId
}

const MASCULINE_OPENAI_IDS = new Set<OpenAiTtsVoiceId>([
  'onyx',
  'echo',
  'ash',
  'cedar',
  'fable',
])

export function isMasculineOpenAiVoice(voiceId: OpenAiTtsVoiceId): boolean {
  return MASCULINE_OPENAI_IDS.has(voiceId)
}

type OpenAiVoicePickerEntry = (typeof OPENAI_TTS_VOICES)[number]

/** Vozes masculinas primeiro — ideal para Jarvis. */
export function listOpenAiVoicesForPicker(): OpenAiVoicePickerEntry[] {
  const masculine = OPENAI_TTS_VOICES.filter((v) => isMasculineOpenAiVoice(v.id))
  const others = OPENAI_TTS_VOICES.filter((v) => !isMasculineOpenAiVoice(v.id))
  return [...masculine, ...others]
}
