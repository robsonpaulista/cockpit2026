import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

/**
 * Token estático para o protótipo do Cockpit MCP.
 * Defina `MCP_API_TOKEN` no ambiente (nunca commitar o valor).
 *
 * `MCP_AUTH_REQUIRED=false` permite o Claude web vincular sem Request headers
 * (só use temporariamente; preferir Bearer em produção).
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
  const token = process.env.MCP_API_TOKEN?.trim()
  if (!token) return false
  const flag = process.env.MCP_AUTH_REQUIRED?.trim().toLowerCase()
  if (flag === 'false' || flag === '0' || flag === 'no') return false
  return true
}
