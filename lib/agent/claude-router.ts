import { extractCityNameFromQuery } from '@/lib/agent/city-extract'

import { isCampoVisitasQuery } from '@/lib/agent/detect-visitas-campo'

import { isPrioridadeVisitasCampoQuery } from '@/lib/agent/detect-prioridade-visitas'

import { detectSidebarNavigate } from '@/lib/agent/detect-sidebar-navigate'

import {

  isPesquisaTendenciaQuery,

  isRankingEstimuladaFederalQuery,

} from '@/lib/agent/detect-pesquisa-avancada'

import { isComparativoExpectativa2022Query } from '@/lib/agent/detect-comparativo-expectativa-2022'

import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'

import { isAnthropicAgentEnabled } from '@/lib/agent/claude-config'

import { detectWhatsAppSendIntent } from '@/lib/agent/detect-whatsapp-send'



function normalize(text: string): string {

  return text

    .toLowerCase()

    .normalize('NFD')

    .replace(/[\u0300-\u036f]/g, '')

    .trim()

}



/** Comandos que o regex/tools resolvem sem síntese LLM. */

const EXPLICIT_STRUCTURED_COMMAND =

  /^(pesquisa(s)?\s+(em|de)\b|expectativa\s+(em|de)\b|lideranc(as?)?\s+(em|de)\b|demandas?\s+(em|de)\b|agenda\s+(de|em)\b|abrir\b|ir para\b|mostrar\b|ver\b|fechar\b|voltar\b|ranking\s+estimulada\b|tendencia\s+(de\s+)?pesquisa\b|como\s+evoluiu\s+a\s+intenc)/



const ELECTORAL_DOMAIN =

  /\b(pesquisa|intencao|voto|votos|eleic|municipio|municipal|cidade|territorio|territorial|chapa|federal|expectativa|projec|jadyel|piaui|pi\b|republicanos|lideranc|campanha|campo|alerta|diagnostico|panorama|situac)\b/



/** Pedidos de análise / relatório / síntese — vão ao Claude Haiku. */

const ANALYSIS_SIGNAL =

  /\b(analis[ae]r?|interpret|explique|explicar|compare|comparar|relat[oó]rio|cen[aá]rio|panorama|diagn[oó]stico|estrat[eé]gi|recomend|sintetiz|avali[ae]|viabil|probabil|chance[s]?|significa|implicac|interpretac|resum[ao].*situa|o que fazer|pr[oó]ximos passos|leitura|conclus[oõ]es)\b/



/** Pergunta aberta de projeção (não o comando curto «expectativa em X»). */

const OPEN_PROJECTION_QUESTION =

  /\b(qual|quanto|como)\b.*\b(projec|projet|estimativa|votos?|eleitos?|cenario)\b/



function passesJarvisAnalysisGuards(message: string): boolean {

  const raw = message.trim()

  if (!raw || raw.length < 12) return false

  if (isGreetingQuery(raw) || isHelpQuery(raw)) return false

  if (detectWhatsAppSendIntent(raw)) return false

  if (isPrioridadeVisitasCampoQuery(raw)) return false

  if (isCampoVisitasQuery(raw)) return false

  if (isPesquisaTendenciaQuery(raw)) return false

  if (isRankingEstimuladaFederalQuery(raw)) return false
  if (isComparativoExpectativa2022Query(raw)) return false

  if (detectSidebarNavigate(raw)) return false



  const q = normalize(raw)

  if (EXPLICIT_STRUCTURED_COMMAND.test(q)) return false



  const hasAnalysis = ANALYSIS_SIGNAL.test(q) || OPEN_PROJECTION_QUESTION.test(q)

  if (!hasAnalysis) return false



  if (ELECTORAL_DOMAIN.test(q)) return true

  if (extractCityNameFromQuery(raw)) return true

  if (/\b(piaui|piau[ií]|campanha|deputad|republicanos|cockpit)\b/.test(q)) return true



  return false

}



/** Análise/síntese — independente de API key (bloqueio do regex legado no cliente). */

export function isJarvisAnalysisQuery(message: string): boolean {

  return passesJarvisAnalysisGuards(message)

}



export function shouldRouteToClaudeAnalysis(message: string): boolean {

  if (!isAnthropicAgentEnabled()) return false

  return passesJarvisAnalysisGuards(message)

}



/** Groq não deve mandar análise para tools de dado bruto. */

export function isMisclassifiedAnalysisIntent(

  message: string,

  intent: string

): boolean {

  if (!isJarvisAnalysisQuery(message)) return false

  return (

    intent === 'consultar_expectativa' ||

    intent === 'consultar_territorio' ||

    intent === 'consultar_liderancas'

  )

}


