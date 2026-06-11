/** URI sentinela: não fixa utterance.voice (no Mac costuma cair na Luciana — Siri Voz 1 não é exposta). */
export const MACOS_SYSTEM_DEFAULT_VOICE_URI = 'jarvis:macos-system-voice'

export function isMacOsSystemDefaultVoiceUri(uri: string | null | undefined): boolean {
  return uri === MACOS_SYSTEM_DEFAULT_VOICE_URI
}

export function isLikelyMacOs(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.platform ?? ''
  const ua = navigator.userAgent ?? ''
  return /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(ua)
}

export const MACOS_SYSTEM_DEFAULT_VOICE_LABEL =
  'Automática do navegador · Siri Voz 1/2 não aparecem aqui'

/** Texto fixo — limitação da Apple no Web Speech API. */
export const MACOS_SIRI_VOICE_UNAVAILABLE_HINT =
  'Siri Voz 1 e Voz 2 dos Ajustes não são expostas ao navegador. Para voz masculina: baixe Felipe (Aprimorada) na mesma tela e use Chrome.'
