import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  ELEVENLABS_FREE_API_HINT,
  ELEVENLABS_PREMADE_FREE_API_VOICES,
  formatElevenLabsApiErrorMessage,
  resolveElevenLabsHttpStatus,
  resolveElevenLabsModel,
  resolveElevenLabsVoiceId,
  resolveElevenLabsVoiceSettings,
} from '@/lib/agent/elevenlabs-config'
import {
  DEFAULT_OPENAI_TTS_VOICE,
  OPENAI_TTS_VOICES,
  resolveOpenAiTtsVoice,
} from '@/lib/agent/openai-voices'
import { stripTextForNeuralSpeech } from '@/lib/agent/speech-text'
import {
  modelSupportsTtsInstructions,
  resolveJarvisTtsInstructions,
} from '@/lib/agent/tts-instructions'

export const dynamic = 'force-dynamic'

const MAX_CHARS = 900
const DEFAULT_MODEL = 'gpt-4o-mini-tts'
const FALLBACK_MODEL = 'tts-1-hd'

type JarvisTtsProvider = 'openai' | 'elevenlabs'

function resolveOpenAiModel(): string {
  return process.env.JARVIS_TTS_MODEL?.trim() || DEFAULT_MODEL
}

function resolveServerTtsProvider(): JarvisTtsProvider | null {
  const raw = process.env.JARVIS_TTS_PROVIDER?.trim().toLowerCase()
  if (raw === 'elevenlabs' || raw === '11labs') return 'elevenlabs'
  if (raw === 'openai') return 'openai'
  return null
}

function pickProvider(requested?: string | null): JarvisTtsProvider {
  const normalized = requested?.trim().toLowerCase()
  if (normalized === 'elevenlabs' || normalized === '11labs') return 'elevenlabs'
  if (normalized === 'openai') return 'openai'

  const envDefault = resolveServerTtsProvider()
  if (envDefault) return envDefault

  const hasEleven = Boolean(process.env.ELEVENLABS_API_KEY?.trim())
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim())
  if (hasEleven && !hasOpenAi) return 'elevenlabs'
  return 'openai'
}

export async function GET() {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim()
  const envVoice = process.env.JARVIS_TTS_VOICE?.trim()
  const defaultVoice = resolveOpenAiTtsVoice(envVoice || DEFAULT_OPENAI_TTS_VOICE, DEFAULT_OPENAI_TTS_VOICE)
  const openAiModel = resolveOpenAiModel()
  const elevenModel = resolveElevenLabsModel(process.env.ELEVENLABS_MODEL)
  const elevenVoiceId = resolveElevenLabsVoiceId(
    process.env.ELEVENLABS_VOICE_ID,
    null
  )
  const providerDefault = resolveServerTtsProvider()

  return NextResponse.json({
    available: Boolean(openAiKey || elevenKey),
    openaiAvailable: Boolean(openAiKey),
    elevenlabsAvailable: Boolean(elevenKey),
    defaultProvider: providerDefault ?? (elevenKey && !openAiKey ? 'elevenlabs' : 'openai'),
    defaultVoice,
    voices: OPENAI_TTS_VOICES,
    model: openAiModel,
    supportsInstructions: modelSupportsTtsInstructions(openAiModel),
    crossDevice: true,
    elevenlabs: {
      available: Boolean(elevenKey),
      defaultVoiceId: elevenVoiceId,
      model: elevenModel,
      freeTierHint: ELEVENLABS_FREE_API_HINT,
      suggestedFreeVoiceId: ELEVENLABS_PREMADE_FREE_API_VOICES[0]?.voice_id ?? null,
    },
  })
}

async function requestOpenAiSpeech(
  apiKey: string,
  payload: Record<string, unknown>
): Promise<Response> {
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function requestElevenLabsSpeech(
  apiKey: string,
  voiceId: string,
  text: string,
  model: string,
  voiceSettings: ReturnType<typeof resolveElevenLabsVoiceSettings>
): Promise<Response> {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: voiceSettings,
    }),
  })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as {
      text?: string
      voice?: string
      provider?: string
      elevenVoiceId?: string
    }

    const cleaned = stripTextForNeuralSpeech(body.text ?? '')
    if (!cleaned) {
      return NextResponse.json({ error: 'Texto vazio' }, { status: 400 })
    }
    if (cleaned.length > MAX_CHARS) {
      return NextResponse.json({ error: 'Texto muito longo' }, { status: 400 })
    }

    const provider = pickProvider(body.provider)

    if (provider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
      if (!apiKey) {
        return NextResponse.json({ error: 'ElevenLabs indisponível' }, { status: 503 })
      }

      const voiceId = resolveElevenLabsVoiceId(
        body.elevenVoiceId ?? body.voice,
        process.env.ELEVENLABS_VOICE_ID
      )
      if (!voiceId) {
        return NextResponse.json(
          { error: 'Configure ELEVENLABS_VOICE_ID ou escolha uma voz no seletor' },
          { status: 400 }
        )
      }

      const model = resolveElevenLabsModel(process.env.ELEVENLABS_MODEL)
      const voiceSettings = resolveElevenLabsVoiceSettings()
      const elevenRes = await requestElevenLabsSpeech(
        apiKey,
        voiceId,
        cleaned,
        model,
        voiceSettings
      )

      if (!elevenRes.ok) {
        const detail = await elevenRes.text().catch(() => '')
        const message = formatElevenLabsApiErrorMessage(detail, elevenRes.status)
        const status = resolveElevenLabsHttpStatus(detail, elevenRes.status)
        console.error('[agent/speech] ElevenLabs error:', elevenRes.status, detail.slice(0, 300))
        return NextResponse.json({ error: message }, { status })
      }

      const audioBuffer = await elevenRes.arrayBuffer()
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      })
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS neural indisponível' }, { status: 503 })
    }

    const clientVoice = body.voice?.trim()
    const voice = clientVoice
      ? resolveOpenAiTtsVoice(clientVoice, DEFAULT_OPENAI_TTS_VOICE)
      : resolveOpenAiTtsVoice(process.env.JARVIS_TTS_VOICE, DEFAULT_OPENAI_TTS_VOICE)
    const primaryModel = resolveOpenAiModel()
    const instructions = resolveJarvisTtsInstructions(process.env.JARVIS_TTS_INSTRUCTIONS)

    const modelsToTry = primaryModel === FALLBACK_MODEL
      ? [FALLBACK_MODEL]
      : [primaryModel, FALLBACK_MODEL]

    let lastError = ''

    for (const model of modelsToTry) {
      const payload: Record<string, unknown> = {
        model,
        voice,
        input: cleaned,
        response_format: 'mp3',
      }

      if (modelSupportsTtsInstructions(model) && instructions) {
        payload.instructions = instructions
      } else {
        const speed = Number(process.env.JARVIS_TTS_SPEED ?? '0.96')
        const safeSpeed = Number.isFinite(speed) ? Math.min(1.2, Math.max(0.8, speed)) : 0.96
        payload.speed = safeSpeed
      }

      const openaiRes = await requestOpenAiSpeech(apiKey, payload)

      if (openaiRes.ok) {
        const audioBuffer = await openaiRes.arrayBuffer()
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-store',
          },
        })
      }

      lastError = await openaiRes.text().catch(() => '')
      console.error('[agent/speech] OpenAI TTS error:', model, openaiRes.status, lastError.slice(0, 200))

      if (openaiRes.status !== 400 && openaiRes.status !== 404) {
        break
      }
    }

    return NextResponse.json({ error: 'Falha ao sintetizar voz' }, { status: 502 })
  } catch (error) {
    console.error('[agent/speech]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
