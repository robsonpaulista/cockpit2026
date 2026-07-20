# Cockpit MCP (remoto)

Servidor MCP do Cockpit 2026 — Streamable HTTP para o Claude operar leitura de cidades, obras e agenda.

## Endpoint

```text
https://SEU_DOMINIO/api/mcp
```

Em local:

```text
http://localhost:3000/api/mcp
```

A rota dinâmica é `/api/mcp/[transport]` (`mcp` ou `sse`).

## Variável de ambiente

```bash
MCP_API_TOKEN=um-token-longo-e-secreto
```

Com `MCP_API_TOKEN` definido, todas as chamadas exigem:

```http
Authorization: Bearer um-token-longo-e-secreto
```

Sem a variável, o protótipo aceita conexões sem auth (apenas para desenvolvimento local).

Também é necessário:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Tools (fase 1 — leitura)

| Tool | Função |
|------|--------|
| `ping` | Health check |
| `listar_cidades` | Municípios + expectativa legado + lideranças |
| `buscar_obras` | Obras por município/tipo/status |
| `buscar_obras_sem_divulgacao` | Obras sem conteúdo publicado |
| `listar_agenda` | Visitas/eventos da agenda (padrão: planejadas a partir de hoje) |

## Claude (conector personalizado)

1. Claude → **Configurações** → **Conectores** → **Adicionar conector personalizado**
2. URL: `https://SEU_DOMINIO/api/mcp`
3. Se o cliente pedir header: `Authorization: Bearer MCP_API_TOKEN`

Se o Claude Desktop só aceitar stdio, use o proxy:

```json
{
  "mcpServers": {
    "cockpit": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://SEU_DOMINIO/api/mcp",
        "--header",
        "Authorization: Bearer SEU_TOKEN"
      ]
    }
  }
}
```

## Teste rápido (local)

Com o Next rodando e `MCP_API_TOKEN` setado:

```bash
curl -s -X POST "http://localhost:3000/api/mcp/mcp" \
  -H "Authorization: Bearer $MCP_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Próximas fases

- Escrita: criar `conteudos_planejados` / salvar arte
- Agenda → etapa Planejado do Fluxo Digital
- Canva Connector
- OAuth por usuário (substituir Bearer estático)
