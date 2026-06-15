/** ElevenLabs TTS — configuração compartilhada (API + cliente). */

export const DEFAULT_ELEVENLABS_MODEL = 'eleven_flash_v2_5'

/** Vozes premade conhecidas — funcionam na API do plano free (não são da biblioteca paga). */
export const ELEVENLABS_PREMADE_FREE_API_VOICES = [
  {
    voice_id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    labels: { gender: 'male', accent: 'american', use: 'Jarvis masculino · free API' },
    category: 'premade',
  },
  {
    voice_id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    labels: { gender: 'male', accent: 'american', use: 'masculino · free API' },
    category: 'premade',
  },
  {
    voice_id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh',
    labels: { gender: 'male', accent: 'american', use: 'masculino · free API' },
    category: 'premade',
  },
  {
    voice_id: 'JBFqnCBsd6RMkjVDRZzb',
    name: 'George',
    labels: { gender: 'male', accent: 'british', use: 'multilíngue · free API' },
    category: 'premade',
  },
] as const

export const ELEVENLABS_FREE_API_HINT =
  'Plano free: vozes da biblioteca não funcionam na API. Use premade (Adam, Antoni…) ou faça upgrade.'

const FREE_API_CATEGORIES = new Set(['premade', 'cloned', 'generated'])

export function isElevenLabsVoiceFreeTierApi(category: string | null | undefined): boolean {
  if (!category) return true
  return FREE_API_CATEGORIES.has(category.toLowerCase())
}

export function formatElevenLabsApiErrorMessage(
  detail: string,
  httpStatus?: number
): string {
  const lower = detail.toLowerCase()
  if (
    httpStatus === 402 ||
    lower.includes('library voices') ||
    lower.includes('paid_plan_required') ||
    lower.includes('upgrade your subscription') ||
    lower.includes('not available for free')
  ) {
    return `${ELEVENLABS_FREE_API_HINT} Sugestão: Adam (pNInz6obpgDQGcFmaJgB) no .env ou no seletor.`
  }

  try {
    const parsed = JSON.parse(detail) as {
      detail?: { message?: string; status?: string; code?: string }
      message?: string
    }
    const msg = parsed.detail?.message || parsed.message
    if (msg?.trim()) {
      return formatElevenLabsApiErrorMessage(msg, httpStatus)
    }
  } catch {
    /* texto bruto abaixo */
  }

  if (detail.trim()) return detail.trim().slice(0, 240)
  return 'Falha ao sintetizar voz (ElevenLabs)'
}

export function resolveElevenLabsHttpStatus(detail: string, upstreamStatus: number): number {
  const lower = detail.toLowerCase()
  if (
    upstreamStatus === 402 ||
    lower.includes('paid_plan_required') ||
    lower.includes('library voices')
  ) {
    return 402
  }
  if (upstreamStatus === 401) return 401
  return upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502
}

export const ELEVENLABS_MODELS = [
  {
    id: 'eleven_flash_v2_5',
    label: 'Flash v2.5',
    hint: 'Recomendado · baixa latência · 0,5 crédito/caractere',
  },
  {
    id: 'eleven_multilingual_v2',
    label: 'Multilingual v2',
    hint: 'Mais natural · 1 crédito/caractere · use só para comparar',
  },
] as const

export type ElevenLabsModelId = (typeof ELEVENLABS_MODELS)[number]['id']

const MODEL_ID_SET = new Set<string>(ELEVENLABS_MODELS.map((m) => m.id))

export function resolveElevenLabsModel(value: string | undefined | null): ElevenLabsModelId {
  const normalized = value?.trim()
  if (normalized && MODEL_ID_SET.has(normalized)) {
    return normalized as ElevenLabsModelId
  }
  return DEFAULT_ELEVENLABS_MODEL
}

export function resolveElevenLabsVoiceId(
  value: string | undefined | null,
  fallback?: string | null
): string | null {
  const normalized = value?.trim()
  if (normalized && normalized.length >= 8) return normalized
  const fb = fallback?.trim()
  return fb && fb.length >= 8 ? fb : null
}

export interface ElevenLabsVoiceSettings {
  stability: number
  similarity_boost: number
  style?: number
  use_speaker_boost?: boolean
}

export function resolveElevenLabsVoiceSettings(
  env?: Partial<Record<'stability' | 'similarity' | 'style', string>>
): ElevenLabsVoiceSettings {
  const stability = Number(env?.stability ?? process.env.ELEVENLABS_STABILITY ?? '0.48')
  const similarity_boost = Number(env?.similarity ?? process.env.ELEVENLABS_SIMILARITY ?? '0.78')
  const style = Number(env?.style ?? process.env.ELEVENLABS_STYLE ?? '0.15')

  return {
    stability: Number.isFinite(stability) ? Math.min(1, Math.max(0, stability)) : 0.48,
    similarity_boost: Number.isFinite(similarity_boost)
      ? Math.min(1, Math.max(0, similarity_boost))
      : 0.78,
    style: Number.isFinite(style) ? Math.min(1, Math.max(0, style)) : 0.15,
    use_speaker_boost: true,
  }
}

export function getElevenLabsModelLabel(modelId: string): string {
  const found = ELEVENLABS_MODELS.find((m) => m.id === modelId)
  return found?.label ?? modelId
}
