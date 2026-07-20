import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

/**
 * Token estático para o protótipo do Cockpit MCP.
 * Defina `MCP_API_TOKEN` no ambiente (nunca commitar o valor).
 */
export async function verifyMcpBearerToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  const expected = process.env.MCP_API_TOKEN?.trim()
  if (!expected || !bearerToken) return undefined
  if (bearerToken !== expected) return undefined

  return {
    token: bearerToken,
    clientId: 'cockpit-mcp-client',
    scopes: ['cockpit:read'],
  }
}

export function mcpAuthRequired(): boolean {
  return Boolean(process.env.MCP_API_TOKEN?.trim())
}
