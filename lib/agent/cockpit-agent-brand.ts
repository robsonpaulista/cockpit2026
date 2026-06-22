/** Nome exibido do assistente de voz/chat do Cockpit 2026. */
export const COCKPIT_AGENT_NAME = 'IA Cockpit'

export function isCockpitAgentTitle(title: string): boolean {
  return title === COCKPIT_AGENT_NAME || title === 'Jarvis'
}
