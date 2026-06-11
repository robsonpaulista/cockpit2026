import { isBrazilianBrowserVoice } from '@/lib/agent/brazil-browser-voice'
import { isSiriBrazilVoice } from '@/lib/agent/siri-voices'

/** Vozes que o Jarvis pode usar via speechSynthesis do navegador. */
export function isJarvisBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  return isBrazilianBrowserVoice(voice) || isSiriBrazilVoice(voice)
}

/** Pitch levemente mais grave para personalidades masculinas Siri. */
export function jarvisBrowserVoicePitch(voice: SpeechSynthesisVoice | undefined): number {
  if (!voice) return 0.97
  const n = voice.name.toLowerCase()
  if (['felipe', 'eddy', 'eddie', 'reed', 'rocko', 'grandpa', 'daniel'].some((h) => n.includes(h))) {
    return 0.88
  }
  return 0.97
}
