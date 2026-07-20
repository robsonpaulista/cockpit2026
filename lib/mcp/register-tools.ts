import { z } from 'zod'
import { listarCidadesMcp } from '@/lib/mcp/data/cidades'
import { listarAgendaMcp } from '@/lib/mcp/data/agenda'
import { buscarObrasMcp, buscarObrasSemDivulgacaoMcp } from '@/lib/mcp/data/obras'
import {
  criarPacoteConteudoMcp,
  listarConteudosFluxoMcp,
  listarPendentesProducaoMcp,
  registrarArteGeradaMcp,
} from '@/lib/mcp/data/conteudos'
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

  server.registerTool(
    'listar_pendentes_producao',
    {
      title: 'Pendentes de produção',
      description:
        'Lista visitas do Fluxo Digital (incluir_fluxo_digital) que ainda não têm pacote de templates. Use antes de criar_pacote_conteudo.',
      inputSchema: {
        limite: z.number().int().min(1).max(80).optional(),
      },
    },
    async (args) => {
      try {
        const result = await listarPendentesProducaoMcp(
          typeof args.limite === 'number' ? args.limite : undefined
        )
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(
          e instanceof Error ? e.message : 'Erro ao listar pendentes de produção'
        )
      }
    }
  )

  server.registerTool(
    'criar_pacote_conteudo',
    {
      title: 'Criar pacote de conteúdo',
      description:
        'Cria o pacote de 6 templates (antes/durante/depois) em conteudos_planejados para uma agenda do Fluxo Digital. Idempotente se o pacote já existir. Depois o operador pode gerar arte no Cockpit ou no Canva.',
      inputSchema: {
        agendaId: z.string().uuid().describe('ID da agenda (visita) no Cockpit'),
      },
    },
    async (args) => {
      try {
        const agendaId = typeof args.agendaId === 'string' ? args.agendaId : ''
        if (!agendaId) return mcpErrorText('agendaId é obrigatório')
        const result = await criarPacoteConteudoMcp(agendaId)
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(e instanceof Error ? e.message : 'Erro ao criar pacote')
      }
    }
  )

  server.registerTool(
    'listar_conteudos_fluxo',
    {
      title: 'Listar conteúdos do Fluxo',
      description:
        'Lista peças (conteudos_planejados) ligadas às agendas do Fluxo Digital, com status rascunho/gerado/aprovado/publicado.',
      inputSchema: {
        status: z
          .enum(['rascunho', 'gerado', 'aprovado', 'publicado', 'todos'])
          .optional(),
        municipio: z.string().optional(),
        limite: z.number().int().min(1).max(100).optional(),
      },
    },
    async (args) => {
      try {
        const result = await listarConteudosFluxoMcp({
          status: typeof args.status === 'string' ? args.status : undefined,
          municipio: typeof args.municipio === 'string' ? args.municipio : undefined,
          limite: typeof args.limite === 'number' ? args.limite : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(e instanceof Error ? e.message : 'Erro ao listar conteúdos')
      }
    }
  )

  server.registerTool(
    'registrar_arte_gerada',
    {
      title: 'Registrar arte gerada',
      description:
        'Após criar a peça no Canva, registre aqui a URL (export/preview ou link do design). Atualiza conteudos_planejados: imagem_url, fundo_origem=canva, status=gerado. Assim o KPI Produzido do Fluxo Digital sobe.',
      inputSchema: {
        conteudoId: z.string().uuid().describe('ID da peça em conteudos_planejados'),
        imagemUrl: z
          .string()
          .url()
          .describe('URL do export/preview da arte ou link do design no Canva'),
        canvaEditUrl: z
          .string()
          .url()
          .optional()
          .describe('Link de edição no Canva (opcional)'),
        titulo: z.string().optional(),
        textoArte: z.string().optional().describe('Texto principal da arte'),
        legenda: z.string().optional().describe('Legenda para rede social'),
      },
    },
    async (args) => {
      try {
        const result = await registrarArteGeradaMcp({
          conteudoId: typeof args.conteudoId === 'string' ? args.conteudoId : '',
          imagemUrl: typeof args.imagemUrl === 'string' ? args.imagemUrl : '',
          canvaEditUrl:
            typeof args.canvaEditUrl === 'string' ? args.canvaEditUrl : undefined,
          titulo: typeof args.titulo === 'string' ? args.titulo : undefined,
          textoArte: typeof args.textoArte === 'string' ? args.textoArte : undefined,
          legenda: typeof args.legenda === 'string' ? args.legenda : undefined,
        })
        return mcpJsonText(result)
      } catch (e) {
        return mcpErrorText(
          e instanceof Error ? e.message : 'Erro ao registrar arte gerada'
        )
      }
    }
  )
}
