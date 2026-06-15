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

/** Tempo para falar o comando (ou saudação) após só dizer «Jarvis». */
export const JARVIS_ARMED_LISTEN_MS = 9000

export function resolveJarvisVoiceInput(
  transcript: string,
  options: { armed: boolean; armedExpired: boolean }
): {
  active: boolean
  command: string
  arm: boolean
  disarm: boolean
} {
  const { triggered, command } = extractJarvisVoiceCommand(transcript)

  if (triggered) {
    if (command) {
      return { active: true, command, arm: false, disarm: true }
    }
    return { active: true, command: '', arm: true, disarm: false }
  }

  if (options.armed && !options.armedExpired) {
    const fallback = normalizeWakeText(transcript)
      .replace(/^[,.\s!?;:—-]+/, '')
      .trim()
    if (fallback) {
      return { active: true, command: fallback, arm: false, disarm: true }
    }
    return { active: true, command: '', arm: true, disarm: false }
  }

  return { active: false, command: '', arm: false, disarm: false }
}

export function jarvisWakeHint(): string {
  return 'Diga «Jarvis» + comando ou saudação (ex.: boa noite)'
}
