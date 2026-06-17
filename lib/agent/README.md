# Jarvis / Agente — `lib/agent`

Documentação do assistente de voz e chat do Cockpit 2026.

## Arquivos principais

| Arquivo | Função |
|---------|--------|
| [COCKPIT-PAGINAS.md](./COCKPIT-PAGINAS.md) | **Guia por página** — o que cada tela faz, APIs, comandos de voz |
| [cockpit-app-knowledge.ts](./cockpit-app-knowledge.ts) | Mesmo mapa **condensado** no system prompt do Claude (cache) |
| [claude-router.ts](./claude-router.ts) | O que vai para Anthropic vs regex/Groq |
| [groq-classify.ts](./groq-classify.ts) | Classificador de intents (Llama 3.1 8B) |
| [server-tools.ts](./server-tools.ts) | Tools executadas no servidor |
| [synthetic-query.ts](./synthetic-query.ts) | Intent Groq → frase do regex legado |
| `components/ai-agent.tsx` | UI Jarvis + `processUserQuery` (regex cliente) |

## Pipeline de uma mensagem

```
Usuário
  → POST /api/agent/chat
      1. Regex local (WhatsApp, visitas, tendência, ranking, saudação…)
      2. Claude Haiku — análise/síntese (se ANTHROPIC_API_KEY)
      3. Groq — classifica intent → server tool OU clientQuery
  → Se clientQuery: processUserQuery() no navegador (regex legado)
```

## Quem responde o quê

| Tipo de pergunta | Módulo | Exemplo |
|------------------|--------|---------|
| Dado pontual | Regex/Groq | «expectativa em Picos» |
| Navegação | Groq `navegar` | «abrir pesquisa» |
| Análise / diagnóstico | **Claude** | «diagnóstico territorial em Parnaíba» |
| Fora do escopo | Off-topic | futebol, clima |

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `ANTHROPIC_API_KEY` | Claude Haiku — análises |
| `GROQ_API_KEY` | Classificação de intents |
| `OPENAI_API_KEY` / `ELEVENLABS_API_KEY` | TTS (opcional) |

## Manutenção

Ao criar **nova página** ou **nova API** usada pelo Jarvis:

1. Atualize [COCKPIT-PAGINAS.md](./COCKPIT-PAGINAS.md) (seção da página).
2. Atualize [cockpit-app-knowledge.ts](./cockpit-app-knowledge.ts) (resumo para o Claude).
3. Se for intent novo: `types.ts`, `groq-classify.ts`, `synthetic-query.ts`, `server-tools.ts` conforme o caso.
4. Se for só dado bruto: regex em `ai-agent.tsx` ou detector em `lib/agent/detect-*.ts`.
5. Se for análise: padrão em `claude-router.ts` + dados em `claude-gather-context.ts`.

## pageKind (contexto enviado ao agente)

| pageKind | Página |
|----------|--------|
| `dashboard` | Visão geral / Jarvis |
| `territorio` | Território & Base |
| `pesquisa` | Pesquisa & Relato |
| `campo` | Campo & Agenda |
| `resumo-eleicoes` | Resumo Eleições |
| `other` | Demais |

Páginas registram contexto via `useRegisterJarvisHostProps` nas respectivas rotas.
