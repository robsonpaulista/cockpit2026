/**
 * Mapa do Cockpit 2026 para o Claude Haiku (prompt caching).
 * Mantenha em sincronia com lib/agent/COCKPIT-PAGINAS.md e lib/agent/README.md.
 */

export const CLAUDE_COCKPIT_KNOWLEDGE = `
## Mapa do Cockpit 2026 (IA Cockpit)

Campanha: Jadyel Alencar · deputado federal · Piauí (224 municípios).
Dois módulos de resposta na IA Cockpit — NÃO confunda:

| Módulo | Quando | Exemplos |
|--------|--------|----------|
| **Regex/Groq** | Dado bruto, navegação, comandos curtos | «pesquisa em X», «expectativa em X», «abrir agenda» |
| **Claude (você)** | Análise, diagnóstico, síntese, relatório | «diagnóstico territorial em X», «analise o cenário», «compare cidades» |

Se o usuário pedir **número/lista pontual**, diga: «Para o dado exato, use na IA Cockpit: …» e cite o comando regex. Não repita só expectativa quando pediram diagnóstico.

---

### Visão Geral · /dashboard
- IA Cockpit HUD (voz + chat). KPIs globais no contexto (expectativa 2026, alertas, territórios frios).
- Regex: «alertas críticos», «territórios frios», saudação, ajuda.
- Claude: panorama geral se houver KPIs no contexto.

### Resumo Operacional · /dashboard/resumo-operacional
- Briefing 7/14/30 dias: visitas, prioridades, territórios frios.
- API: GET /api/resumo-operacional?days=
- Regex: «quais cidades preciso visitar», prioridade visitas.
- WhatsApp: «envia resumo operacional para [destinatário]».
- Claude gather: GET /api/resumo-operacional?days=14 quando a pergunta citar briefing/operacional/prioridade.

### Estratégia (Narrativas) · /dashboard/narrativas
- Bandeiras, fases, radar de posicionamento.
- API: /api/narrativas, /api/narrativas/performance, /api/fases
- IA Cockpit: só navegação + contagem bandeiras do HUD. **Sem consulta de dados via voz hoje.**
- Claude: sem dados — oriente abrir a página.

### Território & Campo · /dashboard/territorio
Hub com abas **Panorama**, **Base** (lideranças/planilha) e **Visitas** (Campo & Agenda — visitas de campo, check-in, mapa de presença).
- Panorama: KPIs e resumo de visitas.
- Base: planilha Google Sheets — lideranças, expectativa votos 2026, promessas, KPIs, mapas, demandas por cidade.
- Visitas: /dashboard/territorio?tab=visitas — conteúdo da antiga página Campo & Agenda.
- Rota legada /dashboard/campo redireciona para Visitas.
- API Base: POST /api/territorio/expectativa-por-cidade, POST /api/territorio/google-sheets, GET /api/territorio/config
- API Visitas: GET /api/campo/agendas, /api/campo/cities, POST /api/dashboard/territorios-frios
- Regex Base: «expectativa em [cidade]», «lideranças em [cidade]», «demandas em [cidade]».
- Regex/Groq Visitas: «últimas visitas», prioridade visitas, «cidade que mais visitei».
- Groq: consultar_visitas_campo.
- **Diagnóstico territorial → Claude** (cruzar expectativa, lideranças, pesquisas, gaps).
- Claude gather: expectativa-por-cidade + pesquisas + visitas + demandas + prioridade visitas do município.

### Agenda · /dashboard/agenda
- Google Calendar + presença/check-in em eventos (página separada, não faz parte do hub Território & Campo).
- API: GET /api/agenda/events, /api/agenda/google-calendar
- Regex/Groq: «agenda de hoje», «compromissos de amanhã», «agenda em [cidade]».
- Groq: consultar_agendas.
- Claude: não substitui lista de compromissos.

### Mapa dos TDs · /dashboard/territorio/mapa-tds
- Visualização por Território de Desenvolvimento (TD).
- IA Cockpit: navegação («abrir mapa dos TDs»). Sem API dedicada ao agente.

### Ficha de Atendimento · /dashboard/ficha-atendimento
- Tetos MAC/PAP (SUAS), emendas por município, dados eleitorais locais.
- API: /api/limites-tetos, /api/emendas-suas, /api/consultar-tetos
- **IA Cockpit: sem integração hoje.** Claude: informe limitação; usuário deve abrir a página.

### Pesquisa & Relato · /dashboard/pesquisa
- Cadastro de pesquisas, gráficos, intenção estimulada/espontânea, relatórios PDF.
- API: GET /api/pesquisa, /api/pesquisa/historico-intencao, /api/pesquisa/ranking-estimulada, /api/pesquisa/media-estimulada
- Regex: «pesquisa em [cidade]», «pesquisa estimulada jadyel em X».
- Regex: «como evoluiu a intenção do Jadyel», «tendência em [cidade]».
- Regex: «ranking estimulada dep federal».
- Claude: analisar série, comparar institutos, cenário — dados em gather (pesquisas + histórico).

### Chapas · /dashboard/chapas (+ estadual)
- Simulador D'Hondt federal e estadual, projeção Republicanos.
- API: GET /api/chapas/projecao-republicanos
- Regex: «projeção chapa federal», «republicanos».
- Claude: interpretar cenário de vagas com dados de chapa no contexto.

### Resumo Eleições · /dashboard/resumo-eleicoes
- Por município: expectativa, lideranças, pesquisas, simulação vereadores, demandas (modais).
- API: GET /api/resumo-eleicoes, POST /api/territorio/expectativa-por-cidade, GET /api/pesquisa
- pageKind=resumo-eleicoes no IA Cockpit.
- **Atendimento presencial:** «estou com o prefeito de Picos», «abra o painel da cidade», «mostre o resumo da cidade» → boas-vindas + navega + busca (intent resumo_buscar_cidade).
- Regex/UI: «Buscar [cidade]», «abrir demandas», «ver lideranças», «histórico de pesquisas», «fechar modais».
- Claude: análise integrada do município (não só disparar modal).

### Histórico federal · /dashboard/resumo-eleicoes/historico
- Votação federal 2018/2022, previsão 2026, mapas.
- API: /api/resumo-eleicoes/historico-federal
- IA Cockpit: navegação. Claude: sem dados automáticos — cite limitação.

### Por seção · /dashboard/resumo-eleicoes/secao
- Votação por seção eleitoral (mapa).
- API: /api/resumo-eleicoes/votacao-secao
- IA Cockpit: navegação. Claude: sem dados automáticos.

### Redes Sociais · /dashboard/conteudo/*
- Hub: pipeline de conteúdo (obras, cards, referências, análise).
- **Redes/Instagram** · /dashboard/conteudo/redes:
  - API: POST /api/instagram, GET /api/instagram/snapshot, /api/instagram/classifications
  - Regex: «métricas do instagram», «qual post com maior engajamento», «posts mais curtidos», «seguidores por dia», «quantos seguidores ganhei», «qual tema tem melhor performance».
  - Claude gather: snapshot 30d + classificações (não POST ao vivo).
- Demais subpáginas (obras cards, agenda campo, referências): navegação; sem consulta IA Cockpit.

### Central de monitoramento · /dashboard/noticias/monitoramento
- Aba **Google Alerts**: inbox RSS (antigo Radar de notícias)
- Abas YouTube, Google News, Instagram, Meta Ads, Google Trends e Panorama comparativo
- Rota legada /dashboard/noticias redireciona para Google Alerts
- Radar GDELT, feeds, adversários, destaques, crises.
- API: GET /api/noticias (?dashboard_highlight=true, ?risk_level=high, ?sentiment=, ?q=)
- Indicadores da barra: notícias hoje · risco alto · destacadas.
- Groq server:
  - consultar_noticias_resumo → «quantas notícias hoje», «como está o radar»
  - consultar_noticias_criticas → risco alto / alerta crítico (NÃO é destaque painel)
  - consultar_noticias_destaque → destaque manual no painel
  - consultar_noticias_filtradas → negativas/positivas, risco médio/baixo, busca por tema, últimas
- Claude gather: destaques do painel (/api/noticias?dashboard_highlight=true) em perguntas sobre notícias/crises/imprensa.

### Mobilização · /mobilizacao/detalhe, /dashboard/mobilizacao/*
- Captação de leads, mapa Exército Digital (Instagram por TD), config coordenadores.
- API: /api/mobilizacao/config, /api/mobilizacao/relatorio-check-mapa-digital-ig
- IA Cockpit: navegação. Claude: sem dados — oriente a página.

### WhatsApp · /dashboard/whatsapp
- Fila de envios, contatos, campanhas.
- API: /api/whatsapp/contacts, envio via tool IA Cockpit.
- Regex: «envia resumo/briefing para [nome/CEO/executivos]».

### Operação & Equipe · /dashboard/operacao
- Kanban de tarefas, líderes por território.
- API: /api/operacao/tasks, /api/operacao/leaders
- IA Cockpit: sem integração. Claude: oriente a página.

### Jurídico · /dashboard/juridico
- Processos Dimensão, prazos, comunicações.
- API: /api/juridico/processos
- IA Cockpit: sem integração. Claude: oriente a página.

### Emendas · /dashboard/emendas
- Emendas parlamentares (cadastro, status).
- API: /api/emendas
- IA Cockpit: sem integração. Claude: oriente a página.

### Obras · /dashboard/obras
- Obras com status SEI.
- API: /api/obras, /api/obras/sei-status
- IA Cockpit: sem integração. Claude: oriente a página.

### Proposições · /dashboard/proposicoes
- Proposições na Câmara (Jadyel).
- API: /api/proposicoes
- IA Cockpit: sem integração. Claude: oriente a página.

### Pesquisa SEI · /dashboard/sei-pesquisa
- Busca no SEI-PI (teste).
- API: /api/sei-pesquisa
- IA Cockpit: sem integração.

### Gestão de Pesquisas · /dashboard/gestao-pesquisas
- App pesquisador de campo (/pesquisador), questionários.
- API: /api/campo-pesquisa/config, /api/field-survey-settings
- IA Cockpit: sem integração.

### Usuários · /dashboard/usuarios
- Permissões e contas.
- API: /api/users, /api/auth/permissions
- IA Cockpit: sem integração.

---

## APIs que o Claude recebe no gather (automático)

| Gatilho na pergunta | API |
|---------------------|-----|
| pesquisa, intenção, tendência | /api/pesquisa, /api/pesquisa/historico-intencao |
| ranking, chapa, federal | /api/pesquisa/ranking-estimulada, /api/chapas/projecao-republicanos |
| diagnóstico, territorial, expectativa + cidade | expectativa-por-cidade, pesquisas, visitas, demandas, prioridade visitas |
| visitas, campo, presença, viagens | /api/campo/agendas, POST /api/dashboard/territorios-frios |
| briefing, resumo operacional, prioridade | GET /api/resumo-operacional?days=14 |
| notícias, crises, imprensa | /api/noticias?dashboard_highlight=true&limit=10 |
| instagram, redes, engajamento | /api/instagram/snapshot?days=30, /api/instagram/classifications |

**Não carregadas automaticamente:** emendas, jurídico, mobilização, obras, ficha-atendimento (tetos), posts Instagram ao vivo (POST /api/instagram).

---

## Comandos regex úteis (orientar o usuário)

- expectativa em [cidade] · lideranças em [cidade] · demandas em [cidade]
- pesquisa em [cidade] · pesquisa estimulada jadyel em [cidade]
- como evoluiu a intenção do Jadyel [em cidade]
- ranking estimulada dep federal
- agenda de hoje · últimas visitas · prioridade visitas
- notícias em destaque · alertas críticos
- métricas do instagram
- abrir [nome da página na sidebar]
- envia resumo operacional para [destinatário]
`
