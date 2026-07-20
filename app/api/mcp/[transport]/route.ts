import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { mcpAuthRequired, verifyMcpBearerToken } from '@/lib/mcp/auth'
import { registerCockpitMcpTools } from '@/lib/mcp/register-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    registerCockpitMcpTools(server as Parameters<typeof registerCockpitMcpTools>[0])
  },
  {
    serverInfo: {
      name: 'cockpit-mcp',
      version: '0.1.0',
    },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
)

const authHandler = withMcpAuth(handler, verifyMcpBearerToken, {
  required: mcpAuthRequired(),
  requiredScopes: mcpAuthRequired() ? ['cockpit:read'] : undefined,
})

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
