/** Desbloqueio de áudio/TTS em mobile (iOS exige gesto do usuário). */

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

let audioUnlocked = false
let speechKeepAliveId: ReturnType<typeof setInterval> | null = null

export function isMobileLikeDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  return ios || android || navigator.maxTouchPoints > 1
}

function configureInlinePlayback(audio: HTMLAudioElement): void {
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  audio.preload = 'auto'
}

/**
 * Chamar de forma síncrona no clique do microfone (antes de qualquer await).
 * Libera `HTMLAudioElement.play()` e `speechSynthesis` após respostas assíncronas.
 */
export function unlockJarvisAudio(): void {
  if (typeof window === 'undefined') return

  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (Ctx) {
      const ctx = new Ctx()
      void ctx.resume()
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
    }
  } catch {
    /* ignore */
  }

  try {
    const audio = new Audio(SILENT_WAV)
    configureInlinePlayback(audio)
    audio.volume = 0.02
    void audio.play().then(() => {
      audio.pause()
      audioUnlocked = true
    }).catch(() => {})
  } catch {
    /* ignore */
  }

  primeSpeechSynthesis()
  audioUnlocked = true
}

export function primeSpeechSynthesis(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.resume()
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }
}

/** Evita que o iOS congele speechSynthesis durante escuta longa. */
export function startSpeechKeepAlive(): void {
  stopSpeechKeepAlive()
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  speechKeepAliveId = setInterval(() => {
    window.speechSynthesis.resume()
  }, 8000)
}

export function stopSpeechKeepAlive(): void {
  if (speechKeepAliveId != null) {
    clearInterval(speechKeepAliveId)
    speechKeepAliveId = null
  }
}

export function isJarvisAudioUnlocked(): boolean {
  return audioUnlocked
}

export function configureJarvisAudioElement(audio: HTMLAudioElement): void {
  configureInlinePlayback(audio)
}
