/** Instruções padrão — voz natural em português brasileiro (mesma em todos os dispositivos). */
export const DEFAULT_JARVIS_TTS_INSTRUCTIONS =
  'Fale em português brasileiro (Brasil), com voz masculina, tom calmo e profissional, como o assistente Jarvis. ' +
  'Evite sotaque de Portugal. Ritmo moderado, entonação firme e clara, pausas naturais, sem soar robótico.'

export function resolveJarvisTtsInstructions(envValue?: string | null): string | undefined {
  const custom = envValue?.trim()
  if (custom) return custom.slice(0, 500)
  return DEFAULT_JARVIS_TTS_INSTRUCTIONS
}

export function modelSupportsTtsInstructions(model: string): boolean {
  const m = model.toLowerCase()
  return m.includes('gpt-4o-mini-tts') || m.includes('gpt-4o-audio')
}
