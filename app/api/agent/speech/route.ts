import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripTextForNeuralSpeech } from '@/lib/agent/speech-output'

export const dynamic = 'force-dynamic'

const MAX_CHARS = 900

const OPENAI_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'])

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

    const body = (await request.json()) as { text?: string }
    const cleaned = stripTextForNeuralSpeech(body.text ?? '')
    if (!cleaned) {
      return NextResponse.json({ error: 'Texto vazio' }, { status: 400 })
    }
    if (cleaned.length > MAX_CHARS) {
      return NextResponse.json({ error: 'Texto muito longo' }, { status: 400 })
    }

    const voiceRaw = (process.env.JARVIS_TTS_VOICE || 'nova').toLowerCase()
    const voice = OPENAI_VOICES.has(voiceRaw) ? voiceRaw : 'nova'
    const model = process.env.JARVIS_TTS_MODEL?.trim() || 'tts-1-hd'
    const speed = Number(process.env.JARVIS_TTS_SPEED ?? '0.96')
    const safeSpeed = Number.isFinite(speed) ? Math.min(1.2, Math.max(0.8, speed)) : 0.96

    const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input: cleaned,
        speed: safeSpeed,
        response_format: 'mp3',
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => '')
      console.error('[agent/speech] OpenAI TTS error:', openaiRes.status, errText.slice(0, 200))
      return NextResponse.json({ error: 'Falha ao sintetizar voz' }, { status: 502 })
    }

    const audioBuffer = await openaiRes.arrayBuffer()
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[agent/speech]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
