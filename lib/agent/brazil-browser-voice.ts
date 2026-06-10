/**
 * Seleção de voz do navegador — apenas pt-BR.
 * Evita Joana / pt-PT quando o fallback local for inevitável.
 */

const PORTUGAL_HINTS = ['joana', 'portugal', 'pt-pt', 'pt_pt']

function normLang(lang: string): string {
  return lang.toLowerCase().replace('_', '-')
}

export function isBrazilianBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = normLang(voice.lang)
  if (lang.startsWith('pt-pt')) return false
  if (lang.startsWith('pt-br')) return true

  const name = voice.name.toLowerCase()
  if (PORTUGAL_HINTS.some((h) => name.includes(h))) return false

  // Alguns macOS reportam só "pt" para vozes Siri brasileiras (Luciana etc.)
  if (lang === 'pt' || lang.startsWith('pt-')) {
    const uri = voice.voiceURI.toLowerCase()
    if (uri.includes('pt-br') || uri.includes('pt_br')) return true
    if (name.includes('luciana') || name.includes('felipe') || name.includes('siri')) return true
    return false
  }

  return false
}

export function scoreBrazilianBrowserVoice(voice: SpeechSynthesisVoice): number {
  if (!isBrazilianBrowserVoice(voice)) return -1000

  const name = voice.name.toLowerCase()
  const uri = voice.voiceURI.toLowerCase()
  let score = 100

  if (normLang(voice.lang).startsWith('pt-br')) score += 80
  if (name.includes('siri')) score += 60
  if (uri.includes('com.apple') && !uri.includes('compact')) score += 40
  if (name.includes('felipe')) score += 55
  if (name.includes('luciana')) score += 20
  if (name.includes('joana')) score -= 200
  if (name.includes('premium') || name.includes('enhanced')) score += 30
  if (voice.localService) score += 15
  if (name.includes('compact') || uri.includes('compact')) score -= 80

  return score
}

export function pickBestBrazilianBrowserVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  return voices
    .filter(isBrazilianBrowserVoice)
    .sort((a, b) => scoreBrazilianBrowserVoice(b) - scoreBrazilianBrowserVoice(a))[0]
}
