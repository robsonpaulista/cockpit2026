/** Utilitários de texto para TTS — sem dependências de navegador (seguro para API routes). */

export const MAX_SPEAK_CHARS = 900

/** Texto para voz do navegador — mais normalizado para engines básicas. */
export function stripTextForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`>|]/g, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/(\d),(\d)%/g, '$1 vírgula $2 por cento')
    .replace(/(\d)%/g, '$1 por cento')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPEAK_CHARS)
}

/** Texto para TTS neural — preserva pontuação e números naturais. */
export function stripTextForNeuralSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_SPEAK_CHARS)
}
