# Cockpit 2026 — Guia funcional por página (Jarvis)

Referência para desenvolvedores e para o agente Claude.  
**Fonte condensada no prompt:** `lib/agent/cockpit-app-knowledge.ts`

Legenda de handlers:

- **Regex** — `processUserQuery` ou detectores em `lib/agent/detect-*.ts`
- **Groq** — classificação → `server-tools` ou `clientQuery`
- **Claude** — análise/síntese (`shouldRouteToClaudeAnalysis`)
- **—** — sem consulta de dados por voz (só navegar)

---

## Visão Geral

**Rota:** `/dashboard`  
**pageKind:** `dashboard`

**O que é:** Shell do Jarvis (HUD voz + chat). KPIs globais no header quando disponíveis.

| Handler | Exemplos |
|---------|----------|
| Regex | «oi jarvis», «ajuda», «alertas críticos», «territórios frios» |
| Claude | Panorama se KPIs estiverem no contexto da UI |

**APIs:** nenhuma dedicada; contexto vem de props do cockpit.

---

## Resumo Operacional

**Rota:** `/dashboard/resumo-operacional`

**O que é:** Briefing consolidado (7, 14 ou 30 dias): visitas, cidades prioritárias, territórios frios.

| Handler | Exemplos |
|---------|----------|
| Regex | «quais cidades preciso visitar», prioridade de visitas |
| Groq | `enviar_whatsapp` com `conteudo=resumo_operacional` |
| Claude | Briefing operacional — gather: GET /api/resumo-operacional?days=14 |

**APIs:**
- `GET /api/resumo-operacional?days=7|14|30`
- `POST /api/dashboard/territorios-frios` (prioridade visitas)

---

## Estratégia (Narrativas)

**Rota:** `/dashboard/narrativas`

**O que é:** Bandeiras de campanha, fases, radar de posicionamento.

| Handler | Exemplos |
|---------|----------|
| Regex | contagem de bandeiras (HUD), «abrir estratégia» |
| — | consulta de performance de narrativa |

**APIs:** `/api/narrativas`, `/api/narrativas/performance`, `/api/fases`

---

## Agenda

**Rota:** `/dashboard/agenda`

**O que é:** Google Calendar integrado, presença e check-in em eventos.

| Handler | Exemplos |
|---------|----------|
| Groq/Regex | «agenda de hoje», «compromissos de amanhã», «agenda em Teresina» |

**APIs:**
- `GET /api/agenda/events`
- `GET/POST /api/agenda/google-calendar`
- `POST /api/agenda/attendance/*`

**Nota:** Jarvis lista compromissos; não controla check-in na UI.

---

## Campo & Agenda

**Rota:** `/dashboard/campo`  
**pageKind:** `campo`

**O que é:** Visitas de campo, check-in, mapa de presença, agendas do módulo campo.

| Handler | Exemplos |
|---------|----------|
| Regex (server) | «últimas visitas», «quantas viagens em março», «descreva a visita em X» |
| Regex | `isPrioridadeVisitasCampoQuery` → resumo operacional de prioridades |
| Groq | `consultar_visitas_campo`, `consultar_agendas` |
| Claude | Diagnóstico de presença em campo — gather: agendas + prioridade visitas × expectativa |

**APIs:**
- `GET /api/campo/agendas`
- `GET /api/campo/cities`
- `GET /api/campo/visits`
- `POST /api/dashboard/territorios-frios`

---

## Território & Base

**Rota:** `/dashboard/territorio`  
**pageKind:** `territorio`

**O que é:** Planilha Google Sheets — lideranças, expectativa 2026, promessas, KPIs, mapas, demandas por município.

| Handler | Exemplos |
|---------|----------|
| Regex | «expectativa em Parnaíba» (**só números**), «lideranças em X», «demandas em X» |
| **Claude** | «faça um diagnóstico territorial em X», «analise a base em X» |
| Groq | `consultar_expectativa`, `consultar_liderancas`, `consultar_demandas` → clientQuery |

**APIs:**
- `POST /api/territorio/expectativa-por-cidade` — JSON expectativa + lideranças
- `POST /api/territorio/google-sheets` — planilha completa
- `GET /api/territorio/config`
- `GET /api/territorio/kpis`

**Claude gather:** expectativa-por-cidade + pesquisas + visitas + demandas + prioridade visitas do município.

**Importante:** «Diagnóstico» ≠ repetir total de votos. Cruzar expectativa, lideranças, pesquisas, lacunas.

---

## Mapa dos TDs

**Rota:** `/dashboard/territorio/mapa-tds`

**O que é:** Mapa por Território de Desenvolvimento (12 TDs).

| Handler | Exemplos |
|---------|----------|
| Groq/Regex | «abrir mapa dos TDs», navegação |

**APIs:** mesma base do território (Sheets).

---

## Ficha de Atendimento

**Rota:** `/dashboard/ficha-atendimento`

**O que é:** Tetos MAC/PAP (SUAS), emendas por município, recorte eleitoral.

| Handler | — |
|---------|---|
| Jarvis | **sem integração** |

**APIs:**
- `/api/limites-tetos`
- `/api/emendas-suas`
- `/api/consultar-tetos`

---

## Pesquisa & Relato

**Rota:** `/dashboard/pesquisa`  
**pageKind:** `pesquisa`

**O que é:** Cadastro de pesquisas, gráficos, estimulada/espontânea, relatórios PDF.

| Handler | Exemplos |
|---------|----------|
| Regex (server) | «como evoluiu a intenção do Jadyel», «tendência em Teresina» |
| Regex (server) | «ranking estimulada dep federal» |
| Regex/Groq | «pesquisa em X», «pesquisa estimulada jadyel em X» |
| **Claude** | «analise as pesquisas em X», «compare institutos», relatório |

**APIs:**
- `GET /api/pesquisa`
- `GET /api/pesquisa/historico-intencao?candidato=&cidade=`
- `GET /api/pesquisa/ranking-estimulada`
- `GET /api/pesquisa/media-estimulada`
- `POST /api/pesquisa/reports` (PDF — OpenAI opcional)

**Claude gather:** pesquisas + histórico + ranking conforme a pergunta.

---

## Chapas (Federal / Estadual)

**Rotas:** `/dashboard/chapas`, `/dashboard/chapas-estaduais`

**O que é:** Simulador D'Hondt, cenários de vagas, projeção Republicanos.

| Handler | Exemplos |
|---------|----------|
| Regex/Groq | «projeção chapa federal», «republicanos vagas» |
| Claude | «analise o cenário de vagas», «viabilidade da chapa» |

**APIs:**
- `GET /api/chapas/projecao-republicanos`

---

## Resumo Eleições

**Rota:** `/dashboard/resumo-eleicoes`  
**pageKind:** `resumo-eleicoes`

**O que é:** Visão por município: expectativa, lideranças, pesquisas, simulação vereadores, modais de demandas.

| Handler | Exemplos |
|---------|----------|
| Regex (pageContext) | «Buscar Teresina», «atualizar» |
| Regex/Groq | «abrir demandas», «ver lideranças», «histórico de pesquisas», «fechar modais» |
| Claude | Análise integrada do município |

**APIs:**
- `GET /api/resumo-eleicoes`
- `POST /api/territorio/expectativa-por-cidade`
- `GET /api/pesquisa`

### Histórico federal

**Rota:** `/dashboard/resumo-eleicoes/historico`  
**API:** `/api/resumo-eleicoes/historico-federal`  
**Jarvis:** navegação.

### Por seção

**Rota:** `/dashboard/resumo-eleicoes/secao`  
**API:** `/api/resumo-eleicoes/votacao-secao`  
**Jarvis:** navegação.

---

## Presença & Conteúdo

**Hub:** `/dashboard/conteudo`

| Subpágina | Função | Jarvis |
|-----------|--------|--------|
| `/conteudo` | Hub pipeline | navegar |
| `/conteudo/redes` | Instagram métricas/posts | **regex** métricas/posts/tema |
| `/conteudo/obras` | Cards de obras | navegar |
| `/conteudo/agenda` | Agenda campo (conteúdo) | navegar |
| `/conteudo/cards` | Cards aprovados | navegar |
| `/conteudo/referencias` | Banco de imagens | navegar |
| `/conteudo/analise` | Análise de conteúdo | navegar |

**APIs Instagram (Jarvis):**
- `POST /api/instagram`
- `GET /api/instagram/snapshot`
- `GET /api/instagram/classifications`

**Comandos:** «métricas do instagram», «qual post com maior engajamento», «posts mais curtidos», «quantos seguidores ganhei por dia», «evolução diária de seguidores», «qual tema tem melhor performance»

**Claude gather:** snapshot 30d + classificações/temas (não chama POST /api/instagram ao vivo).

---

## Notícias & Crises

**Rota:** `/dashboard/noticias`

**O que é:** Inbox RSS, alertas ativos, filtros (sentimento, risco, destaque, busca), indicadores na barra.

| Indicador UI | Campo / cálculo |
|--------------|-----------------|
| Notícias hoje | `stats.hoje` — data de hoje após filtros |
| Risco alto | `stats.riscoAlto` — `risk_level === 'high'` |
| Destacadas | `stats.destacadas` — `dashboard_highlight === true` |

| Handler | Intent | Exemplos de pergunta |
|---------|--------|----------------------|
| Groq server | `consultar_noticias_resumo` | «quantas notícias hoje?», «como está o monitor?», «resumo das notícias» |
| Groq server | `consultar_noticias_criticas` | «tem notícia com alerta crítico?», «notícias de risco alto» (≠ destaque painel) |
| Groq server | `consultar_noticias_destaque` | «notícias em destaque», «destacadas no painel» |
| Groq server | `consultar_noticias_filtradas` | «notícias negativas», «risco médio», «notícias sobre saúde», «últimas notícias» |
| Regex cliente | — | «alertas críticos» sem «notícia» → KPI HUD (`consultar_alertas`) |

**APIs:** `GET /api/noticias`, `?dashboard_highlight=true`, `?risk_level=high|medium|low`, `?sentiment=`, `?q=`, `/api/noticias/metrics`

**Claude gather:** destaques do painel (`dashboard_highlight=true&limit=10`) em perguntas sobre notícias/crises/imprensa.

---

## Mobilização

| Rota | Função |
|------|--------|
| `/mobilizacao/detalhe` | Captação de leads |
| `/dashboard/mobilizacao/mapa-digital-ig` | Exército Digital (IG por TD) |
| `/dashboard/mobilizacao/config` | Coordenadores, import planilha |

**Jarvis:** navegação. **APIs:** `/api/mobilizacao/*` — sem consulta por voz.

---

## WhatsApp

**Rota:** `/dashboard/whatsapp`

**O que é:** Fila de envios, contatos, campanhas.

| Handler | Exemplos |
|---------|----------|
| Regex/Groq | «envia resumo operacional para o CEO», «briefing de Teresina para executivos» |

**APIs:** `/api/whatsapp/contacts`, fila via `tool-enviar-whatsapp`

---

## Operação & Equipe

**Rota:** `/dashboard/operacao`

**APIs:** `/api/operacao/tasks`, `/api/operacao/leaders`  
**Jarvis:** sem integração.

---

## Jurídico

**Rota:** `/dashboard/juridico`

**APIs:** `/api/juridico/processos`  
**Jarvis:** sem integração.

---

## Emendas

**Rota:** `/dashboard/emendas`

**APIs:** `/api/emendas`  
**Jarvis:** sem integração.

---

## Obras

**Rota:** `/dashboard/obras`

**APIs:** `/api/obras`, `/api/obras/sei-status`  
**Jarvis:** sem integração.

---

## Proposições

**Rota:** `/dashboard/proposicoes`

**APIs:** `/api/proposicoes`  
**Jarvis:** sem integração.

---

## Pesquisa SEI (teste)

**Rota:** `/dashboard/sei-pesquisa`  
**API:** `/api/sei-pesquisa`  
**Jarvis:** sem integração.

---

## Gestão de Pesquisas

**Rotas:** `/dashboard/gestao-pesquisas`, `/dashboard/gestao-pesquisas/configuracoes`  
**App campo:** `/pesquisador`

**APIs:** `/api/campo-pesquisa/config`, `/api/field-survey-settings`  
**Jarvis:** sem integração.

---

## Usuários

**Rota:** `/dashboard/usuarios`  
**APIs:** `/api/users`, `/api/auth/permissions`  
**Jarvis:** sem integração.

---

## Tabela rápida — intent → comando synthetic

| Intent Groq | Frase legado (`clientQuery`) |
|-------------|------------------------------|
| `consultar_expectativa` | `expectativa em [cidade]` |
| `consultar_liderancas` | `lideranças em [cidade]` |
| `consultar_demandas` | `demandas em [cidade]` |
| `consultar_pesquisas` | `pesquisa em [cidade]` |
| `consultar_pesquisa_tendencia` | `como evoluiu a intenção do Jadyel em [cidade]` |
| `consultar_ranking_estimulada_federal` | `ranking estimulada dep federal` |
| `consultar_chapa` | `projeção chapa federal` |
| `consultar_agendas` | `agenda de hoje` / `agenda de [data]` |
| `consultar_visitas_campo` | detectores em `detect-visitas-campo.ts` |
| `consultar_analise_claude` | *(não usa synthetic — resposta direta Claude)* |

---

## Lacunas conhecidas (roadmap)

Módulos **sem dados no Claude gather** hoje: emendas, jurídico, obras, mobilização, ficha-atendimento (tetos MAC/PAP), posts Instagram ao vivo, narrativas, histórico federal.

Ao integrar novo módulo: adicionar fetch em `claude-gather-context.ts` + seção neste guia.
