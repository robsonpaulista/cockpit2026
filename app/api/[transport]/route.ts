import { createMcpHandler } from 'mcp-handler'
import { registerCockpitMcpTools } from '@/lib/mcp/register-tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * MCP Streamable HTTP em /api/mcp (padrão mcp-handler / Claude).
 *
 * Sem `withMcpAuth`: o Claude web tenta OAuth DCR quando recebe
 * WWW-Authenticate + resource_metadata, e nosso protótipo ainda não tem OAuth.
 * Auth Bearer/OAuth volta na próxima fase; até lá proteger por rede/Vercel se necessário.
 */
const handler = createMcpHandler(
  (server) => {
    registerCockpitMcpTools(server as Parameters<typeof registerCockpitMcpTools>[0])
  },
  {
    serverInfo: {
      name: 'cockpit-mcp',
      version: '0.2.0',
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
)

export { handler as GET, handler as POST, handler as DELETE }
