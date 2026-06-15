import { isExpectativaLiderancaFollowUpQuery } from '@/lib/agent/expectativa-detalhe-followup'
import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'
import type { AgentClassifiedIntent } from '@/lib/agent/types'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Sinais de que a mensagem pede algo do Cockpit / Jarvis. */
const AGENT_INTENT_SIGNALS =
  /\b(agenda|compromisso|pesquisa|pesquisas|expectativa|lideranc|demanda|pedido|territorio|territorio|alerta|noticia|noticias|instagram|insta|chapa|federal|whatsapp|briefing|resumo operacional|visita|viagens?|campo|buscar|pesquisar|carregar|atualizar|eleic|eleicao|votos?|municipio|municipios|cidade|cidades|secao|secao|demandas|abrir|fechar|listar|navegar|historico|historico|destaque|bandeira|narrativa|projecao|projecao|republicanos|sincronizar|exportar|relatorio)\b/

const OFF_TOPIC_SIGNALS: RegExp[] = [
  /\b(sabia que|voce sabia|você sabia|me conta|me fala sobre|curiosidade)\b/,
  /\b(copa do mundo|mundial|futebol|selecao|seleção|campeonato|libertadores|brasileirao|brasileirão)\b/,
  /\b(previsao do tempo|previsão do tempo|vai chover|temperatura|clima hoje)\b/,
  /\b(receita de|como fazer (um |uma )?(bolo|comida|massa))\b/,
  /\b(netflix|serie|série|filme|novela)\b/,
  /\b(piada|conte uma piada|fala de futebol)\b/,
  /\b(quem ganhou o|placar do|jogo de ontem)\b/,
]

export function messageMentionsTerm(message: string, term: string): boolean {
  const m = normalize(message)
  const t = normalize(term)
  if (!t) return true
  if (m.includes(t)) return true
  if (t.length >= 4 && m.includes(t.slice(0, 4))) return true
  return false
}

/**
 * Pergunta conversacional / tema geral fora do escopo do painel político.
 * Não bloqueia cumprimentos, ajuda nem comandos com sinal claro de intenção do sistema.
 */
export function isOffTopicAgentQuery(message: string): boolean {
  const raw = message.trim()
  if (!raw || raw.length < 10) return false
  if (isGreetingQuery(raw) || isHelpQuery(raw)) return false
  if (isExpectativaLiderancaFollowUpQuery(raw)) return false

  const q = normalize(raw)
  if (AGENT_INTENT_SIGNALS.test(q)) return false

  if (OFF_TOPIC_SIGNALS.some((pattern) => pattern.test(q))) {
    return true
  }

  const parecePergunta =
    /\?/.test(raw) ||
    /^(voce|você|jarvis|me diz|me fala|sabia|sera que|será que)\b/.test(q)

  if (parecePergunta) {
    return true
  }

  return false
}

/** Evita que a LLM use cidade/termo só do contexto da página em mensagens sem relação. */
export function validateClassifiedIntentAgainstMessage(
  message: string,
  classified: AgentClassifiedIntent
): boolean {
  const q = normalize(message)
  const args = classified.args ?? {}

  switch (classified.intent) {
    case 'consultar_pesquisas': {
      if (!/\b(pesquisa|pesquisas|intencao|intencao|estimulada|espontanea)\b/.test(q)) {
        return false
      }
      const termo = args.cidade || args.termo || args.candidato || ''
      if (termo.trim().length >= 3) {
        return messageMentionsTerm(message, termo)
      }
      return true
    }
    case 'consultar_pesquisa_tendencia': {
      if (
        !/\b(tendencia|evolucao|grafico|historico|como\s+esta|como\s+está|subiu|caiu|cresceu)\b/.test(
          q
        )
      ) {
        return false
      }
      return /\b(pesquisa|pesquisas|intencao|intencao|voto|votos)\b/.test(q)
    }
    case 'consultar_ranking_estimulada_federal': {
      if (!/\b(ranking|colocacao|posicao|lugar)\b/.test(q) && !/\branking\s+estimulada\b/.test(q)) {
        return false
      }
      return /\b(estimulada|federal|dep\.?\s*federal|pesquisa|intencao|intencao)\b/.test(q)
    }
    case 'consultar_expectativa':
    case 'consultar_liderancas':
    case 'consultar_demandas': {
      if (isExpectativaLiderancaFollowUpQuery(message)) {
        return true
      }
      if (
        !/\b(expectativa|lideranc|demanda|pedido|votos?|2026|territorio|territorio|base)\b/.test(
          q
        )
      ) {
        return false
      }
      if (args.cidade?.trim()) {
        return messageMentionsTerm(message, args.cidade)
      }
      return true
    }
    case 'resumo_buscar_cidade': {
      if (args.cidade?.trim()) {
        const citouCidade = messageMentionsTerm(message, args.cidade)
        const pediuBusca = /\b(buscar|pesquisar|atualizar|carregar|mostrar|dados|exibir)\b/.test(
          q
        )
        return citouCidade || pediuBusca
      }
      return /\b(buscar|atualizar|carregar|mostrar|dados)\b/.test(q)
    }
    case 'consultar_visitas_campo': {
      if (
        !/\b(visita|visitar|viagens?|campo|check-?in|viaj|prioridad|preciso visitar)\b/.test(q)
      ) {
        return false
      }
      if (args.cidade?.trim()) {
        return messageMentionsTerm(message, args.cidade)
      }
      return true
    }
    case 'consultar_agendas': {
      if (!/\b(agenda|compromisso|reuniao|reunião|evento)\b/.test(q)) {
        return false
      }
      return true
    }
    default:
      return true
  }
}
