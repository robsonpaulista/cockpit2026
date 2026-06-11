/**
 * Seleção de voz do navegador — apenas pt-BR.
 * Evita Joana / pt-PT quando o fallback local for inevitável.
 */

import { SIRI_PERSONALITY_HINTS, SIRI_MASCULINE_HINTS } from '@/lib/agent/siri-voices'

const PORTUGAL_HINTS = ['joana', 'portugal', 'pt-pt', 'pt_pt']

function matchesSiriPersonality(name: string): boolean {
  const n = name.toLowerCase()
  return SIRI_PERSONALITY_HINTS.some((hint) => n.includes(hint))
}

function normLang(lang: string): string {
  return lang.toLowerCase().replace('_', '-')
}

export function isBrazilianBrowserVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = normLang(voice.lang)
  if (lang.startsWith('pt-pt')) return false
  if (lang.startsWith('pt-br')) return true

  const name = voice.name.toLowerCase()
  if (PORTUGAL_HINTS.some((h) => name.includes(h))) return false

  // Alguns macOS reportam só "pt" para vozes Siri brasileiras (Luciana, Reed, Eddy…)
  if (lang === 'pt' || lang.startsWith('pt-')) {
    const uri = voice.voiceURI.toLowerCase()
    if (uri.includes('pt-br') || uri.includes('pt_br')) return true
    if (matchesSiriPersonality(name) || name.includes('siri')) return true
    return false
  }

  return false
}

function isEnhancedPtBrVoice(name: string, uri: string): boolean {
  const n = name.toLowerCase()
  const u = uri.toLowerCase()
  return (
    n.includes('aprimorada') ||
    n.includes('enhanced') ||
    n.includes('premium') ||
    n.includes('melhorada') ||
    u.includes('premium') ||
    u.includes('enhanced')
  )
}

export function scoreBrazilianBrowserVoice(voice: SpeechSynthesisVoice): number {
  if (!isBrazilianBrowserVoice(voice)) return -1000

  const name = voice.name.toLowerCase()
  const uri = voice.voiceURI.toLowerCase()
  let score = 100

  if (normLang(voice.lang).startsWith('pt-br')) score += 80
  if (isEnhancedPtBrVoice(name, uri)) score += 70
  if (name.includes('felipe')) score += 90
  if (SIRI_MASCULINE_HINTS.some((h) => name.includes(h))) score += 20
  if (name.includes('luciana')) score += 8
  if (name.includes('fernanda')) score += 6
  if (name.includes('joana')) score -= 200
  if (uri.includes('com.apple') && !uri.includes('compact')) score += 25
  if (voice.localService) score += 15
  if (name.includes('compact') || uri.includes('compact')) score -= 45
  // Eloquence (Reed, Sandy…) — baixa qualidade, não é Siri neural
  if (['reed', 'eddy', 'rocko', 'sandy', 'shelley', 'flo', 'grandma', 'grandpa'].some((h) => name.includes(h))) {
    score -= 30
  }

  return score
}

export function pickPreferredMasculineBrazilVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  const ptBr = voices.filter(isBrazilianBrowserVoice)
  const felipe = ptBr
    .filter((v) => v.name.toLowerCase().includes('felipe'))
    .sort((a, b) => scoreBrazilianBrowserVoice(b) - scoreBrazilianBrowserVoice(a))[0]
  if (felipe) return felipe

  const masculine = ptBr
    .filter((v) => SIRI_MASCULINE_HINTS.some((h) => v.name.toLowerCase().includes(h)))
    .sort((a, b) => scoreBrazilianBrowserVoice(b) - scoreBrazilianBrowserVoice(a))[0]
  if (masculine) return masculine

  return pickBestBrazilianBrowserVoice(voices)
}

export function pickBestBrazilianBrowserVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  return voices
    .filter(isBrazilianBrowserVoice)
    .sort((a, b) => scoreBrazilianBrowserVoice(b) - scoreBrazilianBrowserVoice(a))[0]
}
