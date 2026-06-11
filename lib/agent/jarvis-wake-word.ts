/** Variantes comuns do reconhecimento de voz para "Jarvis". */
const WAKE_ALIASES = [
  'jarvis',
  'javis',
  'jarvi',
  'jarves',
  'jarviz',
  'jarvys',
  'gervis',
  'jarvice',
  'jarvís',
] as const

function normalizeWakeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrai o comando após a última menção ao nome do assistente.
 * Retorna triggered=false se o nome não foi dito (ignora ruído ambiente).
 */
export function extractJarvisVoiceCommand(transcript: string): {
  triggered: boolean
  command: string
} {
  const norm = normalizeWakeText(transcript)
  if (!norm) return { triggered: false, command: '' }

  let wakeEnd = -1
  for (const alias of WAKE_ALIASES) {
    const idx = norm.lastIndexOf(alias)
    if (idx >= 0) {
      const end = idx + alias.length
      if (end > wakeEnd) wakeEnd = end
    }
  }

  if (wakeEnd < 0) return { triggered: false, command: '' }

  const command = norm
    .slice(wakeEnd)
    .replace(/^[,.\s!?;:—-]+/, '')
    .trim()

  return { triggered: true, command }
}

export function jarvisWakeHint(): string {
  return 'Diga «Jarvis» + o que precisa'
}
