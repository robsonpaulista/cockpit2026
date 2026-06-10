import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

function resolveModel(): string {
  return process.env.JARVIS_TTS_MODEL?.trim() || DEFAULT_MODEL
}

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const envVoice = process.env.JARVIS_TTS_VOICE?.trim()
  const defaultVoice = resolveOpenAiTtsVoice(envVoice || DEFAULT_OPENAI_TTS_VOICE, DEFAULT_OPENAI_TTS_VOICE)
  const model = resolveModel()

  return NextResponse.json({
    available: Boolean(apiKey),
    defaultVoice,
    voices: OPENAI_TTS_VOICES,
    model,
    supportsInstructions: modelSupportsTtsInstructions(model),
    crossDevice: true,
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

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS neural indisponível' }, { status: 503 })
    }

    const body = (await request.json()) as { text?: string; voice?: string }
    const cleaned = stripTextForNeuralSpeech(body.text ?? '')
    if (!cleaned) {
      return NextResponse.json({ error: 'Texto vazio' }, { status: 400 })
    }
    if (cleaned.length > MAX_CHARS) {
      return NextResponse.json({ error: 'Texto muito longo' }, { status: 400 })
    }

    const clientVoice = body.voice?.trim()
    const voice = clientVoice
      ? resolveOpenAiTtsVoice(clientVoice, DEFAULT_OPENAI_TTS_VOICE)
      : resolveOpenAiTtsVoice(process.env.JARVIS_TTS_VOICE, DEFAULT_OPENAI_TTS_VOICE)
    const primaryModel = resolveModel()
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
