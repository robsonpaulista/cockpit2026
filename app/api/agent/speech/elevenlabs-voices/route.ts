import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

import {

  ELEVENLABS_FREE_API_HINT,

  ELEVENLABS_PREMADE_FREE_API_VOICES,

  isElevenLabsVoiceFreeTierApi,

} from '@/lib/agent/elevenlabs-config'



export const dynamic = 'force-dynamic'



export interface ElevenLabsVoiceOption {

  voice_id: string

  name: string

  labels: Record<string, string>

  preview_url: string | null

  category: string | null

  freeTierApi: boolean

}



function normalizeLabels(labels: unknown): Record<string, string> {

  if (!labels || typeof labels !== 'object') return {}

  const out: Record<string, string> = {}

  for (const [key, value] of Object.entries(labels as Record<string, unknown>)) {

    if (typeof value === 'string' && value.trim()) out[key] = value.trim()

  }

  return out

}



function mapPremadeFreeVoices(): ElevenLabsVoiceOption[] {

  return ELEVENLABS_PREMADE_FREE_API_VOICES.map((v) => ({

    voice_id: v.voice_id,

    name: v.name,

    labels: { ...v.labels },

    preview_url: null,

    category: v.category,

    freeTierApi: true,

  }))

}



function mergeVoiceLists(

  accountVoices: ElevenLabsVoiceOption[],

  premadeFallback: ElevenLabsVoiceOption[]

): ElevenLabsVoiceOption[] {

  const byId = new Map<string, ElevenLabsVoiceOption>()

  for (const voice of premadeFallback) byId.set(voice.voice_id, voice)

  for (const voice of accountVoices) byId.set(voice.voice_id, voice)



  return [...byId.values()].sort((a, b) => {

    if (a.freeTierApi !== b.freeTierApi) return a.freeTierApi ? -1 : 1

    return a.name.localeCompare(b.name, 'pt-BR')

  })

}



/** Lista vozes da conta ElevenLabs — útil para escolher no picker. */

export async function GET() {

  try {

    const supabase = createClient()

    const {

      data: { user },

    } = await supabase.auth.getUser()



    if (!user) {

      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    }



    const apiKey = process.env.ELEVENLABS_API_KEY?.trim()

    const premadeFree = mapPremadeFreeVoices()



    if (!apiKey) {

      return NextResponse.json({ voices: [], available: false })

    }



    const res = await fetch('https://api.elevenlabs.io/v1/voices', {

      headers: { 'xi-api-key': apiKey },

      cache: 'no-store',

    })



    if (!res.ok) {

      const detail = await res.text().catch(() => '')

      console.error('[elevenlabs-voices]', res.status, detail.slice(0, 200))



      const envVoiceId = process.env.ELEVENLABS_VOICE_ID?.trim()

      const envVoice: ElevenLabsVoiceOption[] = envVoiceId

        ? [

            {

              voice_id: envVoiceId,

              name: 'Voz configurada (.env)',

              labels: { source: 'ELEVENLABS_VOICE_ID' },

              preview_url: null,

              category: 'configured',

              freeTierApi: false,

            },

          ]

        : []



      return NextResponse.json({

        voices: mergeVoiceLists(envVoice, premadeFree),

        available: true,

        listLimited: true,

        hint:

          res.status === 401

            ? 'Chave sem voices_read — use vozes premade abaixo (free API) ou habilite voices_read.'

            : ELEVENLABS_FREE_API_HINT,

      })

    }



    const data = (await res.json()) as {

      voices?: Array<{

        voice_id?: string

        name?: string

        labels?: unknown

        preview_url?: string | null

        category?: string | null

      }>

    }



    const accountVoices: ElevenLabsVoiceOption[] = (data.voices ?? [])

      .filter((v) => Boolean(v.voice_id && v.name))

      .map((v) => {

        const category = v.category ?? null

        return {

          voice_id: String(v.voice_id),

          name: String(v.name),

          labels: normalizeLabels(v.labels),

          preview_url: v.preview_url ?? null,

          category,

          freeTierApi: isElevenLabsVoiceFreeTierApi(category),

        }

      })



    return NextResponse.json({

      voices: mergeVoiceLists(accountVoices, premadeFree),

      available: true,

      hint: ELEVENLABS_FREE_API_HINT,

    })

  } catch (error) {

    console.error('[elevenlabs-voices]', error)

    return NextResponse.json({ error: 'Erro interno', voices: [], available: false }, { status: 500 })

  }

}


