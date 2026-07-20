# Fluxo Digital: Planejado → Produzido → Canva

## Modelo operacional

```text
Claude (operador)
    │  MCP Cockpit
    ▼
Cockpit 2026
  1. Planejado  → agendas.incluir_fluxo_digital
  2. Produzido  → pacote em conteudos_planejados (templates)
  3. Arte       → Canva (via Claude Connector) OU gerador PNG interno
  4. Aprovar / publicar → status gerado → aprovado → publicado
```

## Templates do pacote (6 peças)

Definidos em `lib/conteudo/agenda-pack.ts`:

| Fase | Formato | Template |
|------|---------|----------|
| antes | story | cidade_beneficiada |
| antes | card | obra_impacto |
| durante | card | agenda_chegada |
| durante | reels_capa | cidade_beneficiada |
| depois | card | prestacao_contas |
| depois | story | frase_local |

## Como produzir a partir de uma visita

### No Cockpit (UI)

1. `/dashboard/fluxo-digital` → Programação
2. Em cada visita: **Gerar peças**
3. Seção **Produção (templates)** lista status
4. Abrir `/dashboard/conteudo/cards` para gerar/aprovar arte (PNG interno)

### Via Claude + MCP

1. `listar_pendentes_producao` — visitas sem pacote
2. `criar_pacote_conteudo` com `agendaId`
3. `listar_conteudos_fluxo` — acompanhar status
4. (próxima fase) Claude usa o **Canva Connector** com título/cidade/template e devolve o link/export; o Cockpit grava `imagem_url` / status `gerado`

## Canva → Cockpit (já disponível)

Depois de criar a arte no Canva:

1. `listar_conteudos_fluxo` (status `rascunho`) para pegar o `id` da peça
2. `registrar_arte_gerada` com:
   - `conteudoId`
   - `imagemUrl` (export/preview ou link do design)
   - opcional: `canvaEditUrl`, `titulo`, `textoArte`, `legenda`

API HTTP equivalente:

```http
POST /api/conteudo/planejados/{id}/registrar-arte
Content-Type: application/json

{ "imagemUrl": "https://...", "canvaEditUrl": "https://www.canva.com/design/..." }
```

Isso define `fundo_origem=canva`, `status=gerado` e sobe o KPI **Produzido**.

## APIs

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/fluxo-digital/planejamento` | Visitas na programação |
| GET/POST | `/api/fluxo-digital/producao` | Listar KPI Produzido / criar pacote |

## Canva (fase seguinte)

Ainda **sem** OAuth/API Canva no Cockpit. O caminho previsto:

1. Manter `conteudos_planejados` como fonte de verdade (template + status)
2. Claude conectado ao Canva cria a arte a partir do brief (cidade, obra, template)
3. Tool MCP `registrar_arte_gerada` salva URL/export no Cockpit (`status=gerado`)

Para gerar PNG interno sem Canva: Conteúdo → Cards (`/api/conteudo/planejados/[id]/generate`).
