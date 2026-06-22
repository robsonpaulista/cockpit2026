import type { AgentChatMessage, AgentClassifiedIntent, AgentContextPayload } from '@/lib/agent/types'
import { sidebarNavTargetListForPrompt } from '@/lib/sidebar-nav-routes'

/** Modelo rápido e gratuito — mesma escolha do módulo de Conteúdo. */
export const GROQ_AGENT_MODEL = 'llama-3.1-8b-instant'

const MAX_HISTORY_MESSAGES = 4
const MAX_TOKENS_CLASSIFY = 220
const TEMPERATURE = 0.1

const INTENT_LIST = [
  'ajuda',
  'resposta_direta',
  'consultar_pesquisas',
  'consultar_pesquisa_tendencia',
  'consultar_ranking_estimulada_federal',
  'consultar_demandas',
  'consultar_agendas',
  'consultar_visitas_campo',
  'consultar_expectativa',
  'consultar_liderancas',
  'consultar_chapa',
  'consultar_instagram_metricas',
  'consultar_instagram_seguidores_diario',
  'consultar_instagram_posts',
  'consultar_instagram_tipo',
  'consultar_instagram_tema',
  'consultar_territorio',
  'consultar_alertas',
  'consultar_noticias_destaque',
  'consultar_noticias_criticas',
  'consultar_noticias_resumo',
  'consultar_noticias_filtradas',
  'consultar_territorios_frios',
  'enviar_whatsapp',
  'navegar',
  'resumo_buscar_cidade',
  'resumo_abrir_demandas',
  'resumo_abrir_liderancas',
  'resumo_abrir_pesquisas',
  'resumo_fechar_modais',
  'desconhecido',
] as const

function buildSystemPrompt(context?: AgentContextPayload): string {
  const ctxLines: string[] = []
  if (context?.pageKind) ctxLines.push(`Página atual: ${context.pageKind}`)
  if (context?.pageKind === 'campo') {
    ctxLines.push('O usuário está em Campo & Agenda — priorize consultar_visitas_campo para visitas/viagens/check-in.')
  }
  if (context?.pageKind === 'resumo-eleicoes') {
    ctxLines.push(
      'O usuário está em Resumo Eleições — para buscar/selecionar município no dropdown (ex.: «Buscar Teresina», «Picos», «atualizar»), use resumo_buscar_cidade com args.cidade. NÃO use consultar_expectativa nem consultar_liderancas só porque citou um município.'
    )
  }
  if (context?.pageKind === 'pesquisa') {
    ctxLines.push(
      'O usuário está em Pesquisa & Relato — priorize consultar_pesquisa_tendencia (evolução/gráfico) e consultar_ranking_estimulada_federal (ranking estimulada dep. federal).'
    )
  }
  if (context?.cidadeAtual) ctxLines.push(`Cidade selecionada: ${context.cidadeAtual}`)
  if (context?.buscaIniciada) ctxLines.push('Busca de município já iniciada na página.')
  if (context?.candidatoPadrao) ctxLines.push(`Candidato foco: ${context.candidatoPadrao}`)
  if (context?.alertsCriticosCount != null) {
    ctxLines.push(`Alertas críticos no painel: ${context.alertsCriticosCount}`)
  }
  if (context?.territoriosFriosCount != null) {
    ctxLines.push(`Territórios frios: ${context.territoriosFriosCount}`)
  }
  if (context?.cidadesDisponiveis?.length) {
    const sample = context.cidadesDisponiveis.slice(0, 25).join(', ')
    ctxLines.push(`Municípios no dropdown (amostra): ${sample}`)
  }

  return [
    'Você é o classificador de intenções do assistente Jarvis do Cockpit 2026 (gestão política eleitoral no Piauí).',
    'Analise a mensagem do usuário e retorne APENAS um JSON válido (sem markdown).',
    'Formato: {"intent":"<nome>","args":{},"direct_reply":null}',
    `Intents válidos: ${INTENT_LIST.join(', ')}`,
    'Regras:',
    '- Use args.cidade quando mencionar município; args.data quando citar data/período (hoje, amanhã, 15/05/2026); args.termo para busca em pesquisas; args.candidato quando citar candidato (ex.: Jadyel Alencar); args.tipo = estimulada|espontanea quando o usuário especificar o tipo.',
    '- Em consultar_agendas, use a agenda do Google Calendar; preencha args.data com hoje/amanhã/manhã/tarde/noite/data quando o usuário especificar.',
    '- Em consultar_visitas_campo, use visitas/viagens do módulo Campo & Agenda (não Google Calendar). args.modo = prioridade_visitas («quais cidades preciso visitar», «alta expectativa e visitei poucas vezes», «expectativa de votos e poucas visitas» — NÃO é lista de últimas visitas) | ultima | ultimas | contagem_mes | descricao | lista_cidade | cidades | cidade_mais_visitada | cidade_menos_visitadas. args.cidade quando citar município; args.mes (01-12) e args.ano para contagem mensal; args.termo com trecho da pergunta.',
    '- visitas/viagens/check-in de cidade → consultar_visitas_campo. compromissos/agenda do dia → consultar_agendas.',
    '- Em consultar_pesquisas sobre Jadyel Alencar, preencha args.candidato com "Jadyel Alencar" (e args.cidade se houver município).',
    '- consultar_pesquisa_tendencia: evolução/tendência («como evoluiu a intenção do Jadyel», «tendência em Teresina»). args.candidato quando citar nome; args.cidade SEMPRE que mencionar município (em/na/no Teresina, Picos, etc.).',
    '- consultar_ranking_estimulada_federal: top candidatos na estimulada dep. federal (média de intenção, top 10). Inclui «pesquisas estimuladas + quem seria eleito», «10 eleitos dep federal» — NÃO é simulador de chapa/D\'Hondt. args.candidato quando citar nome; senão Candidato foco.',
    '- Use args.label com o nome da página da sidebar (ex.: «Agenda», «Território & Base», «WhatsApp»). args.url só se souber o caminho exato (/dashboard/...).',
    `- navegar: quando pedir abrir/ir/acessar/mostrar uma página do sistema (não confundir com consulta de dados). Páginas: ${sidebarNavTargetListForPrompt(28)}.`,
    '- resumo_* só quando pageKind for resumo-eleicoes. resumo_buscar_cidade: selecionar município e acionar Buscar (nome da cidade ou «buscar/atualizar/mostrar dados de X»). Em **atendimento presencial** («estou com o prefeito de Picos», «abra o painel da cidade de Teresina», «mostre o resumo da cidade»), use resumo_buscar_cidade com args.cidade — boas-vindas + busca automática.',
    '- consultar_liderancas: lideranças da planilha Território. args.cidade só quando citar município («lideranças em Teresina»). Resumo/quadro/totais **por cargo** (sem cidade) → args.modo=por_cargo; NÃO invente args.cidade a partir do histórico.',
    '- consultar_noticias_criticas: notícias na base com **risco alto / alerta crítico** (risk_level=high). Ex.: «tem notícia com alerta crítico?», «notícias de risco alto». NÃO é destaque do painel.',
    '- consultar_noticias_destaque: APENAS notícias marcadas manualmente como **destaque no painel** (dashboard_highlight). Ex.: «notícias em destaque». NÃO use para risco alto nem alerta crítico na classificação.',
    '- consultar_noticias_resumo: indicadores do monitor (barra superior): quantas notícias hoje, risco alto, destacadas. Ex.: «quantas notícias hoje?», «como está o radar de imprensa?», «resumo das notícias». NÃO liste matérias — só números.',
    '- consultar_noticias_filtradas: listar notícias com filtro. args.filtro = sentimento|risco|busca|recentes; args.sentimento = positive|negative|neutral; args.risco = medium|low; args.termo_busca para «notícias sobre saúde». NÃO use para risco alto (é consultar_noticias_criticas) nem destaque painel.',
    '- consultar_instagram_seguidores_diario: variação de seguidores **por dia** («quantos seguidores ganhei por dia», «evolução diária», «últimos 7 dias de seguidores»). args.dias = 7|14|30 quando citar período. NÃO use consultar_instagram_metricas.',
    '- consultar_instagram_posts: ranking de publicações («qual post com maior engajamento», «posts mais curtidos», «melhor reel»). args.metrica = engajamento|curtidas|comentarios|visualizacoes|compartilhamentos. args.modo = destaque quando pedir UM post campeão. NÃO use consultar_instagram_metricas.',
    '- consultar_instagram_metricas: resumo agregado do perfil (seguidores totais, soma de curtidas) **sem** identificar post específico nem quebra dia a dia.',
    '- consultar_instagram_tema: performance por **tema** de conteúdo («qual tema engaja mais»).',
    '- consultar_instagram_tipo: publicações por **formato** (imagem, vídeo, carrossel).',
    '- resposta_direta: cumprimentos (oi, bom dia, boa tarde, boa noite) — direct_reply só saudação curta e direta (ex.: "Fala." ou "Opa. Pode falar."). Máx. ~6 palavras. Sem "você". NUNCA narre processo ("buscando", "carregando") — use o intent correto (enviar_whatsapp, consultar_*). Nunca interprete "cockpit" ou "jarvis" como cidade.',
    '- ajuda: quando pedir ajuda, comandos, exemplos ou "o que você pode fazer/responder".',
    '- enviar_whatsapp: envio por WhatsApp SOMENTE para destinatários explícitos. args.conteudo = resumo_operacional | briefing_territorio. args.cidade (briefing). args.dias (resumo). args.destinatario = nome ou padrao/ceo. args.destinatarios = «Maria, João» (máx. poucas pessoas). args.grupo_categoria = executivo|assessoria|territorio APENAS se pedir «para os executivos» etc. args.enviar_todos=sim só se pedir «todos os contatos». NUNCA envie para todos sem pedido explícito. Se faltar destinatário, use desconhecido.',
    '- desconhecido: quando não houver intenção clara OU a pergunta for conversa geral fora do sistema (futebol, Copa do Mundo, clima, curiosidades, entretenimento). NÃO use cidade do contexto se o usuário não citou esse município na mensagem.',
    '- Análise, diagnóstico territorial, panorama, estratégia, relatório ou síntese («faça um diagnóstico em X», «analise o cenário») → desconhecido. NÃO use consultar_expectativa nem consultar_territorio para isso — outro módulo responde.',
    '- NUNCA preencha args.cidade/args.termo só com «Cidade selecionada» do contexto se a mensagem não mencionar esse município nem pedir dado dele.',
    '- Nunca invente números de pesquisa ou território.',
    ctxLines.length ? `Contexto:\n${ctxLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function extractJsonObject(text: string): string | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return clean.slice(start, end + 1)
}

function normalizeIntent(raw: string): AgentClassifiedIntent['intent'] {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, '_')
  if ((INTENT_LIST as readonly string[]).includes(normalized)) {
    return normalized as AgentClassifiedIntent['intent']
  }
  return 'desconhecido'
}

export async function classifyAgentIntent(
  message: string,
  history: AgentChatMessage[] = [],
  context?: AgentContextPayload
): Promise<AgentClassifiedIntent | null> {
  const key = process.env.GROQ_API_KEY?.trim()
  if (!key) return null

  const recentHistory = history.slice(-MAX_HISTORY_MESSAGES)
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...recentHistory.map((m) => ({ role: m.role, content: m.content.slice(0, 600) })),
    { role: 'user', content: message.slice(0, 800) },
  ]

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_AGENT_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS_CLASSIFY,
      messages,
    }),
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) return null

  const jsonStr = extractJsonObject(raw)
  if (!jsonStr) return null

  try {
    const parsed = JSON.parse(jsonStr) as {
      intent?: string
      args?: Record<string, unknown>
      direct_reply?: string | null
    }
    const args: Record<string, string> = {}
    if (parsed.args && typeof parsed.args === 'object') {
      for (const [k, v] of Object.entries(parsed.args)) {
        if (v != null) args[k] = String(v).slice(0, 120)
      }
    }
    return {
      intent: normalizeIntent(String(parsed.intent ?? 'desconhecido')),
      args,
      direct_reply:
        typeof parsed.direct_reply === 'string' ? parsed.direct_reply.slice(0, 1200) : null,
    }
  } catch {
    return null
  }
}
