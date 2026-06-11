'use client'

import {
  configureJarvisAudioElement,
  primeSpeechSynthesis,
} from '@/lib/agent/audio-unlock'
import {
  DEFAULT_KOKORO_VOICE,
  getKokoroVoiceLabel,
  type KokoroVoiceId,
} from '@/lib/agent/kokoro-voices'
import { getPreferredKokoroVoice } from '@/lib/agent/voice-preference'
import { MAX_SPEAK_CHARS, stripTextForNeuralSpeech } from '@/lib/agent/speech-text'
import type { SpeakTextOptions } from '@/lib/agent/speech-types'

const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
const SEGMENT_PAUSE_MS = 700

type KokoroModule = typeof import('kokoro-js')
type KokoroTTSInstance = InstanceType<KokoroModule['KokoroTTS']>

let kokoroModulePromise: Promise<KokoroModule> | null = null
let ttsInstance: KokoroTTSInstance | null = null
let loadPromise: Promise<KokoroTTSInstance> | null = null
let speechCancelled = false

let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null

export type KokoroLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  progress: number | null
  device: 'webgpu' | 'wasm' | null
  error: string | null
}

let loadState: KokoroLoadState = {
  status: 'idle',
  progress: null,
  device: null,
  error: null,
}

const loadListeners = new Set<(state: KokoroLoadState) => void>()

function emitLoadState(): void {
  for (const listener of loadListeners) listener(loadState)
}

export function subscribeKokoroLoadState(listener: (state: KokoroLoadState) => void): () => void {
  loadListeners.add(listener)
  listener(loadState)
  return () => loadListeners.delete(listener)
}

export function getKokoroLoadState(): KokoroLoadState {
  return loadState
}

const KOKORO_BROWSER_MODULE_URL = '/kokoro/kokoro.web.js'

async function importKokoroModule(): Promise<KokoroModule> {
  if (!kokoroModulePromise) {
    kokoroModulePromise = (async () => {
      const mod = (await import(
        /* webpackIgnore: true */
        KOKORO_BROWSER_MODULE_URL
      )) as KokoroModule & {
        env?: { wasmPaths?: string | Record<string, string> }
      }
      if (mod.env && typeof window !== 'undefined') {
        const base = `${window.location.origin}/kokoro/`
        mod.env.wasmPaths = {
          wasm: `${base}ort-wasm-simd-threaded.jsep.wasm`,
          mjs: `${base}ort-wasm-simd-threaded.jsep.mjs`,
        }
      }
      return mod
    })()
  }
  return kokoroModulePromise
}

async function detectKokoroDevice(): Promise<'webgpu' | 'wasm'> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return 'wasm'
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<{ requestDevice?: () => Promise<unknown> } | null> }
    }
    const adapter = await nav.gpu?.requestAdapter()
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

function releaseCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl)
    currentAudioUrl = null
  }
}

export function stopKokoroSpeech(): void {
  speechCancelled = true
  releaseCurrentAudio()
}

async function playKokoroBlob(blob: Blob, options: SpeakTextOptions): Promise<boolean> {
  releaseCurrentAudio()
  const url = URL.createObjectURL(blob)
  currentAudioUrl = url

  const audio = new Audio(url)
  configureJarvisAudioElement(audio)
  currentAudio = audio
  let started = false

  audio.onplay = () => {
    if (!started) {
      started = true
      options.onStart?.()
    }
  }

  try {
    primeSpeechSynthesis()
    await audio.play()
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('kokoro playback failed'))
    })
    releaseCurrentAudio()
    return true
  } catch {
    options.onError?.('Falha ao reproduzir áudio Kokoro.')
    releaseCurrentAudio()
    return false
  }
}

export async function loadKokoroEngine(force = false): Promise<KokoroTTSInstance | null> {
  if (typeof window === 'undefined') return null
  if (ttsInstance && !force) return ttsInstance
  if (loadPromise && !force) return loadPromise

  loadPromise = (async () => {
    loadState = { status: 'loading', progress: 0, device: null, error: null }
    emitLoadState()

    try {
      const { KokoroTTS } = await importKokoroModule()
      const preferredDevice = await detectKokoroDevice()
      const devices: Array<'webgpu' | 'wasm'> =
        preferredDevice === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm']

      let instance: KokoroTTSInstance | null = null
      let activeDevice: 'webgpu' | 'wasm' = 'wasm'
      let lastError: unknown = null

      for (const device of devices) {
        loadState = { ...loadState, device }
        emitLoadState()
        try {
          instance = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
            dtype: device === 'webgpu' ? 'fp32' : 'q8',
            device,
            progress_callback: (data) => {
              if (data.status !== 'progress' || !data.total) return
              const progress = Math.round((data.loaded / data.total) * 100)
              loadState = { ...loadState, progress }
              emitLoadState()
            },
          })
          activeDevice = device
          break
        } catch (err) {
          lastError = err
          ttsInstance = null
        }
      }

      if (!instance) {
        throw lastError instanceof Error
          ? lastError
          : new Error('Não foi possível inicializar Kokoro (WebGPU nem WASM).')
      }

      ttsInstance = instance
      loadState = {
        status: 'ready',
        progress: 100,
        device: activeDevice,
        error: null,
      }
      emitLoadState()
      return instance
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível carregar o modelo Kokoro.'
      loadState = {
        status: 'error',
        progress: null,
        device: loadState.device,
        error: message,
      }
      emitLoadState()
      ttsInstance = null
      throw err
    } finally {
      loadPromise = null
    }
  })()

  return loadPromise
}

function stripKokoroSegment(text: string): string {
  return text
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEAK_CHARS)
}

async function speakChunk(
  tts: KokoroTTSInstance,
  text: string,
  voice: KokoroVoiceId,
  options: SpeakTextOptions
): Promise<boolean> {
  const cleaned = stripKokoroSegment(text)
  if (!cleaned) return true

  const audio = await tts.generate(cleaned, { voice, speed: 0.98 })
  const blob = await audio.toBlob()
  if (!blob.size) return false
  return playKokoroBlob(blob, options)
}

export async function speakWithKokoro(
  text: string,
  options: SpeakTextOptions = {},
  voice: KokoroVoiceId = getPreferredKokoroVoice()
): Promise<(() => void) | null> {
  if (typeof window === 'undefined') return null

  try {
    const tts = await loadKokoroEngine()
    if (!tts) return null

    speechCancelled = false
    const fullText = stripTextForNeuralSpeech(text)

    const segments =
      options.segments && options.segments.length > 0
        ? options.segments.map(stripKokoroSegment).filter(Boolean)
        : null

    if (segments && segments.length > 0) {
      for (let i = 0; i < segments.length; i += 1) {
        if (speechCancelled) return stopKokoroSpeech
        const ok = await speakChunk(tts, segments[i], voice, options)
        if (!ok || speechCancelled) return null
        if (i < segments.length - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, SEGMENT_PAUSE_MS)
          })
        }
      }
      if (!speechCancelled) options.onEnd?.()
      return stopKokoroSpeech
    }

    if (!fullText) return null

    let started = false
    for await (const { audio } of tts.stream(fullText, { voice, speed: 0.98 })) {
      if (speechCancelled) return stopKokoroSpeech
      const blob = await audio.toBlob()
      if (!blob.size) continue
      const ok = await playKokoroBlob(blob, {
        ...options,
        onStart: started ? undefined : options.onStart,
      })
      started = true
      if (!ok || speechCancelled) return null
    }

    if (!started) {
      const ok = await speakChunk(tts, fullText, voice, options)
      if (!ok || speechCancelled) return null
    }

    if (!speechCancelled) options.onEnd?.()
    return stopKokoroSpeech
  } catch {
    options.onError?.(`Kokoro indisponível (${getKokoroVoiceLabel(voice)}).`)
    options.onEnd?.()
    return null
  }
}

export async function previewKokoroVoice(
  text: string,
  voice: KokoroVoiceId = DEFAULT_KOKORO_VOICE
): Promise<boolean> {
  stopKokoroSpeech()
  const result = await speakWithKokoro(text, {}, voice)
  return Boolean(result)
}

export function isKokoroSupported(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly !== 'undefined'
}
