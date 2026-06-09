/** Vozes fixas do OpenAI TTS — mesmas em qualquer máquina/navegador. */
export const OPENAI_TTS_VOICES = [
  { id: 'coral', label: 'Coral', tone: 'Casual, feminina, conversacional' },
  { id: 'sage', label: 'Sage', tone: 'Calma, neutra, assistente' },
  { id: 'nova', label: 'Nova', tone: 'Jovem, clara, equilibrada' },
  { id: 'shimmer', label: 'Shimmer', tone: 'Suave, amigável' },
  { id: 'alloy', label: 'Alloy', tone: 'Neutra, versátil' },
  { id: 'echo', label: 'Echo', tone: 'Masculina, direta' },
  { id: 'fable', label: 'Fable', tone: 'Expressiva, narrativa' },
  { id: 'onyx', label: 'Onyx', tone: 'Masculina, grave' },
  { id: 'ash', label: 'Ash', tone: 'Masculina, casual' },
  { id: 'ballad', label: 'Ballad', tone: 'Quente, melodiosa' },
] as const

export type OpenAiTtsVoiceId = (typeof OPENAI_TTS_VOICES)[number]['id']

export const DEFAULT_OPENAI_TTS_VOICE: OpenAiTtsVoiceId = 'coral'

const VOICE_ID_SET = new Set<string>(OPENAI_TTS_VOICES.map((v) => v.id))

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
