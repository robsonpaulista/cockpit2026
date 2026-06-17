/** Modelo fixo — não trocar por Sonnet/Opus sem revisar custos (ver docs do projeto). */
export const ANTHROPIC_AGENT_MODEL = 'claude-haiku-4-5-20251001'

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export const ANTHROPIC_API_VERSION = '2023-06-01'

/** Resposta analítica — suficiente para relatórios curtos sem inflar OTPM. */
export const ANTHROPIC_MAX_OUTPUT_TOKENS = 900

/** Histórico mínimo na chamada analítica (economia de input). */
export const ANTHROPIC_MAX_HISTORY_MESSAGES = 4

/** Retentativas em 429/529. */
export const ANTHROPIC_MAX_RETRIES = 2

export function isAnthropicAgentEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim())
}

export function getAnthropicApiKey(): string | null {
  const key = process.env.ANTHROPIC_API_KEY?.trim()
  return key || null
}
