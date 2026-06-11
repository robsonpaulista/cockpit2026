'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getKokoroLoadState,
  loadKokoroEngine,
  speakWithKokoro,
  stopKokoroSpeech,
  subscribeKokoroLoadState,
  type KokoroLoadState,
} from '@/lib/agent/kokoro-engine'
import {
  DEFAULT_KOKORO_VOICE,
  type KokoroVoiceId,
} from '@/lib/agent/kokoro-voices'
import { getPreferredKokoroVoice } from '@/lib/agent/voice-preference'

export interface UseKokoroTTSOptions {
  voice?: KokoroVoiceId
  /** Pré-carrega o modelo ao montar (após gesto do usuário, se possível). */
  preload?: boolean
}

export function useKokoroTTS(options: UseKokoroTTSOptions = {}) {
  const voice = options.voice ?? getPreferredKokoroVoice() ?? DEFAULT_KOKORO_VOICE
  const [loadState, setLoadState] = useState<KokoroLoadState>(getKokoroLoadState)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => subscribeKokoroLoadState(setLoadState), [])

  const warm = useCallback(async () => {
    try {
      await loadKokoroEngine()
    } catch {
      /* estado em loadState.error */
    }
  }, [])

  useEffect(() => {
    if (!options.preload) return
    void warm()
  }, [options.preload, warm])

  const speak = useCallback(
    async (text: string) => {
      setIsSpeaking(true)
      try {
        await speakWithKokoro(
          text,
          {
            onEnd: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
          },
          voice
        )
      } finally {
        setIsSpeaking(false)
      }
    },
    [voice]
  )

  const stop = useCallback(() => {
    stopKokoroSpeech()
    setIsSpeaking(false)
  }, [])

  return {
    speak,
    stop,
    warm,
    voice,
    isSpeaking,
    isLoading: loadState.status === 'loading',
    isReady: loadState.status === 'ready',
    loadProgress: loadState.progress,
    device: loadState.device,
    error: loadState.error,
    loadState,
  }
}
