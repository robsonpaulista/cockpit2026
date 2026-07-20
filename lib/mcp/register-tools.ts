import { z } from 'zod'
import { listarCidadesMcp } from '@/lib/mcp/data/cidades'
import { listarAgendaMcp } from '@/lib/mcp/data/agenda'
import { buscarObrasMcp, buscarObrasSemDivulgacaoMcp } from '@/lib/mcp/data/obras'
import { mcpErrorText, mcpJsonText } from '@/lib/mcp/format'

type McpServerLike = {
  registerTool: (
    name: string,
    config: {
      title?: string
      description?: string
      inputSchema?: Record<string, z.ZodTypeAny>
    },
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ) => void
}

export function registerCockpitMcpTools(server: McpServerLike): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Health check do Cockpit MCP. Retorna pong.',
      inputSchema: {},
    },
    async () => mcpJsonText({ ok: true, service: 'cockpit-mcp', message: 'pong' })
  )

  server.registerTool(
    'listar_cidades',
    {
      title: 'Listar cidades',
      description:
        'Lista municípios do Piauí com expectativa 2026 (legado), lideranças e eleitorado. Use para priorizar cobertura e peças.',
      inputSchema: {
        q: z.string().optional().describe('Filtro por nome do município'),
        minExpectativa: z
          .number()
          .optional()
          .describe('Expectativa legado mínima (votos). Ex.: 800'),
        limite: z.number().int().min(1).max(224).optional().describe('Máximo de linhas (padrão 50)'),
      },
    },
    async (args) => {
      try {
        const result = await listarCidadesMcp({
          q: typeof args.q === 'string' ? args.q : undefined,
          minExpectativa:
            typeof args.minExpectativa === 'number' ? args.minExpectativa : undefined,
          limite: typeof args.limite === 'number' ? args.limite : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(e instanceof Error ? e.message : 'Erro ao listar cidades')
      }
    }
  )

  server.registerTool(
    'buscar_obras',
    {
      title: 'Buscar obras',
      description:
        'Busca obras cadastradas no Cockpit por município, tipo, status ou texto livre.',
      inputSchema: {
        municipio: z.string().optional().describe('Nome do município'),
        tipo: z.string().optional().describe('Tipo da obra (ex.: asfalto, saúde)'),
        status: z.string().optional().describe('Status da obra'),
        q: z.string().optional().describe('Busca em obra/município/tipo'),
        limite: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const result = await buscarObrasMcp({
          municipio: typeof args.municipio === 'string' ? args.municipio : undefined,
          tipo: typeof args.tipo === 'string' ? args.tipo : undefined,
          status: typeof args.status === 'string' ? args.status : undefined,
          q: typeof args.q === 'string' ? args.q : undefined,
          limite: typeof args.limite === 'number' ? args.limite : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(e instanceof Error ? e.message : 'Erro ao buscar obras')
      }
    }
  )

  server.registerTool(
    'buscar_obras_sem_divulgacao',
    {
      title: 'Obras sem divulgação',
      description:
        'Lista obras sem conteúdo publicado no pipeline de peças (conteudos_planejados). Ideal para gerar arte pendente.',
      inputSchema: {
        municipio: z.string().optional(),
        tipo: z.string().optional().describe('Ex.: asfalto'),
        limite: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const result = await buscarObrasSemDivulgacaoMcp({
          municipio: typeof args.municipio === 'string' ? args.municipio : undefined,
          tipo: typeof args.tipo === 'string' ? args.tipo : undefined,
          limite: typeof args.limite === 'number' ? args.limite : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(
          e instanceof Error ? e.message : 'Erro ao buscar obras sem divulgação'
        )
      }
    }
  )

  server.registerTool(
    'listar_agenda',
    {
      title: 'Listar agenda',
      description:
        'Lista eventos da agenda (visitas, reuniões, etc.) que alimentam o planejamento do Fluxo Digital. Padrão: visitas planejadas a partir de hoje.',
      inputSchema: {
        tipo: z
          .enum(['visita', 'evento', 'reuniao', 'outro', 'todos'])
          .optional()
          .describe('Tipo do evento (padrão: visita)'),
        status: z
          .enum(['planejada', 'concluida', 'cancelada', 'todos'])
          .optional()
          .describe('Status (padrão: planejada)'),
        municipio: z.string().optional(),
        de: z.string().optional().describe('Data início YYYY-MM-DD (padrão: hoje)'),
        ate: z.string().optional().describe('Data fim YYYY-MM-DD'),
        limite: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const result = await listarAgendaMcp({
          tipo:
            args.tipo === 'visita' ||
            args.tipo === 'evento' ||
            args.tipo === 'reuniao' ||
            args.tipo === 'outro' ||
            args.tipo === 'todos'
              ? args.tipo
              : undefined,
          status:
            args.status === 'planejada' ||
            args.status === 'concluida' ||
            args.status === 'cancelada' ||
            args.status === 'todos'
              ? args.status
              : undefined,
          municipio: typeof args.municipio === 'string' ? args.municipio : undefined,
          de: typeof args.de === 'string' ? args.de : undefined,
          ate: typeof args.ate === 'string' ? args.ate : undefined,
          limite: typeof args.limite === 'number' ? args.limite : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(e instanceof Error ? e.message : 'Erro ao listar agenda')
      }
    }
  )
}
