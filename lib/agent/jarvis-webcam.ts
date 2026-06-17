import { isJarvisWebcamSupported } from '@/lib/agent/voice-preference'

export type JarvisWebcamFailureKind =
  | 'unsupported'
  | 'denied'
  | 'not_found'
  | 'in_use'
  | 'aborted'
  | 'unknown'

export type JarvisWebcamAcquireResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; kind: JarvisWebcamFailureKind; message: string }

function classifyGetUserMediaError(
  err: unknown
): Extract<JarvisWebcamAcquireResult, { ok: false }> {
  const name = err instanceof DOMException ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err)

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      ok: false,
      kind: 'denied',
      message:
        'Permissão negada. Confira o cadeado do site e Ajustes do Sistema → Privacidade → Câmera.',
    }
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { ok: false, kind: 'not_found', message: 'Nenhuma câmera detectada neste dispositivo.' }
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      ok: false,
      kind: 'in_use',
      message: 'Câmera em uso por outro app ou sem sinal. Feche FaceTime/Meet e tente de novo.',
    }
  }
  if (name === 'AbortError') {
    return { ok: false, kind: 'aborted', message: 'Abertura da câmera interrompida.' }
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      ok: false,
      kind: 'unknown',
      message: 'Câmera não atende ao formato pedido. Tentando modo compatível…',
    }
  }

  return {
    ok: false,
    kind: 'unknown',
    message: msg || 'Não foi possível abrir a câmera.',
  }
}

const CONSTRAINT_ATTEMPTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: 'user',
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 },
    },
    audio: false,
  },
  { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
  { video: true, audio: false },
]

/** Abre a webcam com fallbacks de constraint (Continuity Camera, desktops sem facingMode). */
export async function acquireJarvisWebcamStream(): Promise<JarvisWebcamAcquireResult> {
  if (!isJarvisWebcamSupported()) {
    return { ok: false, kind: 'unsupported', message: 'Navegador sem suporte a câmera.' }
  }

  let lastFailure: JarvisWebcamAcquireResult = {
    ok: false,
    kind: 'unknown',
    message: 'Não foi possível abrir a câmera.',
  }

  for (const constraints of CONSTRAINT_ATTEMPTS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const videoTrack = stream.getVideoTracks()[0]
      if (!videoTrack || videoTrack.readyState === 'ended') {
        stream.getTracks().forEach((t) => t.stop())
        lastFailure = {
          ok: false,
          kind: 'in_use',
          message: 'Câmera bloqueada ou sem sinal.',
        }
        continue
      }
      return { ok: true, stream }
    } catch (err) {
      const failure = classifyGetUserMediaError(err)
      lastFailure = failure
      if (
        !failure.ok &&
        (failure.kind === 'denied' || failure.kind === 'not_found' || failure.kind === 'aborted')
      ) {
        return failure
      }
    }
  }

  return lastFailure
}

export async function attachStreamToVideoElement(
  video: HTMLVideoElement,
  stream: MediaStream
): Promise<boolean> {
  if (video.srcObject !== stream) {
    video.srcObject = stream
  }
  video.muted = true
  video.playsInline = true

  try {
    await video.play()
    return true
  } catch {
    try {
      await new Promise<void>((resolve, reject) => {
        const onReady = () => {
          video.removeEventListener('loadedmetadata', onReady)
          resolve()
        }
        video.addEventListener('loadedmetadata', onReady)
        window.setTimeout(() => {
          video.removeEventListener('loadedmetadata', onReady)
          reject(new Error('timeout'))
        }, 2000)
      })
      await video.play()
      return true
    } catch {
      return false
    }
  }
}
