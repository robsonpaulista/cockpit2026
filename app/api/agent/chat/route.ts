import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { classifyAgentIntent } from '@/lib/agent/groq-classify'
import {
  buildGreetingReply,
  buildHelpReply,
  buildOutOfScopeReply,
  isGreetingQuery,
  isHelpQuery,
} from '@/lib/agent/greeting-reply'
import {
  isOffTopicAgentQuery,
  validateClassifiedIntentAgainstMessage,
} from '@/lib/agent/detect-off-topic-query'
import {
  detectExpectativaDetalheFollowUp,
  EXPECTATIVA_DETALHE_DISMISS_REPLY,
} from '@/lib/agent/expectativa-detalhe-followup'
import { isLiderancasResumoPorCargoQuery } from '@/lib/agent/detect-liderancas-resumo'
import { isPlanoVisitasCampoQuery } from '@/lib/agent/detect-plano-visitas'
import { isPrioridadeVisitasCampoQuery } from '@/lib/agent/detect-prioridade-visitas'
import { detectVisitasCampoIntent } from '@/lib/agent/detect-visitas-campo'
import { isInvalidCityCandidate } from '@/lib/agent/city-extract'
import { checkAgentRateLimit, AGENT_RATE_LIMITS } from '@/lib/agent/rate-limit'
import { intentToSyntheticQuery, isClientOnlyIntent } from '@/lib/agent/synthetic-query'
import {
  detectWhatsAppSendIntent,
  isFakeWhatsAppDirectReply,
} from '@/lib/agent/detect-whatsapp-send'
import {
  detectPesquisaTendenciaIntent,
  detectRankingEstimuladaFederalIntent,
} from '@/lib/agent/detect-pesquisa-avancada'
import { detectComparativoExpectativa2022Intent } from '@/lib/agent/detect-comparativo-expectativa-2022'
import {
  buildResumoBuscarCidadeSyntheticQuery,
  detectResumoBuscarCidadeIntent,
} from '@/lib/agent/resumo-eleicoes-city'
import { isAnthropicAgentEnabled } from '@/lib/agent/claude-config'
import { runClaudeAnalysis } from '@/lib/agent/claude-analyze'
import {
  isMisclassifiedAnalysisIntent,
  shouldRouteToClaudeAnalysis,
} from '@/lib/agent/claude-router'
import { buildNavigateAction, executeServerTool } from '@/lib/agent/server-tools'
import { detectInstagramFollowersDailyIntent } from '@/lib/agent/detect-instagram-followers-daily'
import { detectInstagramPostsIntent } from '@/lib/agent/detect-instagram-posts'
import { detectNoticiasIntent } from '@/lib/agent/detect-noticias-query'
import { detectResumoAtendimentoIntent } from '@/lib/agent/detect-resumo-atendimento'
import { formatJarvisResumoAtendimentoReply } from '@/lib/agent/jarvis-phrases'
import { buildResumoEleicoesNavigateUrl } from '@/lib/jarvis-resumo-pending'
import { toolConsultarInstagramSeguidoresDiario } from '@/lib/agent/tool-instagram-seguidores-diario'
import { toolConsultarInstagramPosts } from '@/lib/agent/tool-instagram-posts'
import { toolEnviarWhatsApp } from '@/lib/agent/tool-enviar-whatsapp'
import type { AgentChatRequest, AgentChatResponse } from '@/lib/agent/types'

export const dynamic = 'force-dynamic'

function fallbackResponse(reason?: string): AgentChatResponse {
  return {
    source: 'fallback',
    content: '',
    meta: {
      groqUnavailable: Boolean(reason),
    },
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as AgentChatRequest
    const message = body.message?.trim()
    if (!message || message.length > 1200) {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 })
    }

    const localWhatsappEarly = detectWhatsAppSendIntent(message)
    if (localWhatsappEarly) {
      const originEarly = new URL(request.url).origin
      const cookieEarly = request.headers.get('cookie') ?? ''
      const authEarly = { supabase, user: { id: user.id, email: user.email } }
      try {
        const content = await toolEnviarWhatsApp(
          localWhatsappEarly.args,
          originEarly,
          cookieEarly,
          supabase,
          authEarly.user
        )
        return NextResponse.json({
          source: 'groq',
          content,
          meta: { intent: 'enviar_whatsapp' },
        } satisfies AgentChatResponse)
      } catch (err) {
        console.error('[agent/chat] WhatsApp early:', err)
        return NextResponse.json({
          source: 'groq',
          content: err instanceof Error ? err.message : 'Não foi possível enviar o WhatsApp.',
          meta: { intent: 'enviar_whatsapp' },
        } satisfies AgentChatResponse)
      }
    }

    if (isGreetingQuery(message)) {
      return NextResponse.json({
        source: 'groq',
        content: buildGreetingReply(message),
        meta: { intent: 'resposta_direta' },
      } satisfies AgentChatResponse)
    }

    if (isHelpQuery(message)) {
      return NextResponse.json({
        source: 'groq',
        content: buildHelpReply(),
        meta: { intent: 'ajuda' },
      } satisfies AgentChatResponse)
    }

    const instagramFollowersDaily = detectInstagramFollowersDailyIntent(message)
    if (instagramFollowersDaily) {
      const origin = new URL(request.url).origin
      const cookie = request.headers.get('cookie') ?? ''
      const content = await toolConsultarInstagramSeguidoresDiario(
        origin,
        cookie,
        instagramFollowersDaily.args,
        message
      )
      return NextResponse.json({
        source: 'groq',
        content,
        action: {
          type: 'navigate',
          url: '/dashboard/conteudo/redes',
          label: 'Ver Histórico de Seguidores',
        },
        meta: { intent: 'consultar_instagram_seguidores_diario' },
      } satisfies AgentChatResponse)
    }

    const instagramPosts = detectInstagramPostsIntent(message)
    if (instagramPosts) {
      const content = await toolConsultarInstagramPosts(
        user.id,
        instagramPosts.args,
        message,
        {
          token: body.context?.instagramToken,
          businessAccountId: body.context?.instagramBusinessAccountId,
        }
      )

      if (content) {
        return NextResponse.json({
          source: 'groq',
          content,
          action: buildNavigateAction(instagramPosts),
          meta: { intent: 'consultar_instagram_posts' },
        } satisfies AgentChatResponse)
      }

      const clientQuery =
        intentToSyntheticQuery(instagramPosts.intent, instagramPosts.args) ?? message

      return NextResponse.json({
        source: 'groq',
        content: '',
        clientQuery,
        action: buildNavigateAction(instagramPosts),
        meta: { intent: 'consultar_instagram_posts' },
      } satisfies AgentChatResponse)
    }

    const noticiasIntent = detectNoticiasIntent(message)
    if (
      noticiasIntent &&
      (noticiasIntent.intent === 'consultar_noticias_criticas' ||
        noticiasIntent.intent === 'consultar_noticias_destaque' ||
        noticiasIntent.intent === 'consultar_noticias_resumo' ||
        noticiasIntent.intent === 'consultar_noticias_filtradas')
    ) {
      const origin = new URL(request.url).origin
      const cookie = request.headers.get('cookie') ?? ''
      const result = await executeServerTool(
        noticiasIntent,
        origin,
        cookie,
        body.context,
        { supabase, user: { id: user.id, email: user.email } },
        message
      )
      if (result) {
        const payload =
          typeof result === 'string'
            ? { content: result }
            : {
                content: result.content,
                speechSegments: result.speechSegments,
              }
        return NextResponse.json({
          source: 'groq',
          content: payload.content,
          speechSegments: payload.speechSegments,
          action: buildNavigateAction(noticiasIntent),
          meta: { intent: noticiasIntent.intent },
        } satisfies AgentChatResponse)
      }
    }

    const cidadesResumo = body.context?.cidadesDisponiveis ?? []
    const atendimentoResumo = detectResumoAtendimentoIntent(message, cidadesResumo)
    if (atendimentoResumo) {
      const onResumoPage = body.context?.pageKind === 'resumo-eleicoes'
      return NextResponse.json({
        source: 'groq',
        content: formatJarvisResumoAtendimentoReply({
          cidade: atendimentoResumo.cidade,
          liderancaCargo: atendimentoResumo.liderancaCargo,
          liderancaNome: atendimentoResumo.liderancaNome,
        }),
        clientQuery: `Buscar ${atendimentoResumo.cidade}`,
        action: onResumoPage
          ? undefined
          : {
              type: 'navigate',
              url: buildResumoEleicoesNavigateUrl(atendimentoResumo.cidade),
              label: 'Eleições por cidade',
            },
        meta: { intent: 'resumo_buscar_cidade' },
      } satisfies AgentChatResponse)
    }

    if (isLiderancasResumoPorCargoQuery(message)) {
      return NextResponse.json({
        source: 'groq',
        content: '',
        clientQuery: 'resumo lideranças por cargo',
        meta: { intent: 'consultar_liderancas' },
      } satisfies AgentChatResponse)
    }

    if (isPlanoVisitasCampoQuery(message)) {
      if (!isAnthropicAgentEnabled()) {
        return NextResponse.json({
          source: 'groq',
          content:
            'Para montar um **plano de visitas** distribuído no tempo (ex.: 30 dias), configure `ANTHROPIC_API_KEY` no servidor.\n\nEnquanto isso, pergunte: **quais cidades preciso visitar** — retorno a lista de prioridade por expectativa e visitas já feitas.',
          meta: { intent: 'consultar_analise_claude' },
        } satisfies AgentChatResponse)
      }
    }

    if (isPrioridadeVisitasCampoQuery(message)) {
      const visitasIntent =
        detectVisitasCampoIntent(message) ?? {
          intent: 'consultar_visitas_campo' as const,
          args: { modo: 'prioridade_visitas', termo: message.slice(0, 120) },
        }
      const origin = new URL(request.url).origin
      const cookie = request.headers.get('cookie') ?? ''
      const visitasResult = await executeServerTool(
        visitasIntent,
        origin,
        cookie,
        body.context,
        { supabase, user: { id: user.id, email: user.email } },
        message
      )
      if (visitasResult) {
        const payload =
          typeof visitasResult === 'string'
            ? { content: visitasResult }
            : {
                content: visitasResult.content,
                speechSegments: visitasResult.speechSegments,
              }
        return NextResponse.json({
          source: 'groq',
          content: payload.content,
          speechSegments: payload.speechSegments,
          action: buildNavigateAction(visitasIntent),
          meta: { intent: 'consultar_visitas_campo' },
        } satisfies AgentChatResponse)
      }
    }

    const expectativaFollowUp = detectExpectativaDetalheFollowUp(body.history ?? [], message)
    if (expectativaFollowUp) {
      if (expectativaFollowUp.kind === 'negative') {
        return NextResponse.json({
          source: 'groq',
          content: EXPECTATIVA_DETALHE_DISMISS_REPLY,
          meta: { intent: 'consultar_expectativa' },
        } satisfies AgentChatResponse)
      }
      return NextResponse.json({
        source: 'groq',
        content: '',
        clientQuery: `expectativa em ${expectativaFollowUp.cidade} por liderança`,
        meta: { intent: 'consultar_expectativa' },
      } satisfies AgentChatResponse)
    }

    if (isOffTopicAgentQuery(message)) {
      return NextResponse.json({
        source: 'groq',
        content: buildOutOfScopeReply(),
        meta: { intent: 'desconhecido' },
      } satisfies AgentChatResponse)
    }

    const sessionId = body.sessionId?.trim() || user.id
    const rate = checkAgentRateLimit(sessionId)
    if (!rate.ok) {
      const mins = rate.reason === 'hour' ? 60 : 1
      return NextResponse.json({
        source: 'fallback',
        content: '',
        meta: {
          rateLimited: true,
          intent: 'desconhecido',
        },
        hint: `Limite do assistente (${AGENT_RATE_LIMITS.maxPerHour}/h). Tente em ~${rate.retryAfterSec ?? mins * 60}s ou use comandos diretos.`,
      } satisfies AgentChatResponse & { hint?: string })
    }

    const origin = new URL(request.url).origin
    const cookie = request.headers.get('cookie') ?? ''
    const auth = { supabase, user: { id: user.id, email: user.email } }

    if (body.context?.pageKind === 'resumo-eleicoes') {
      const resumoBusca = detectResumoBuscarCidadeIntent(
        message,
        body.context.cidadesDisponiveis ?? [],
        body.context.cidadeAtual
      )
      if (resumoBusca) {
        return NextResponse.json({
          source: 'groq',
          content: '',
          clientQuery: buildResumoBuscarCidadeSyntheticQuery(resumoBusca),
          meta: { intent: 'resumo_buscar_cidade' },
        } satisfies AgentChatResponse)
      }
    }

    const localVisitas = detectVisitasCampoIntent(message)
    if (localVisitas) {
      const visitasResult = await executeServerTool(localVisitas, origin, cookie, body.context, auth, message)
      if (visitasResult) {
        const payload =
          typeof visitasResult === 'string'
            ? { content: visitasResult }
            : {
                content: visitasResult.content,
                speechSegments: visitasResult.speechSegments,
              }
        return NextResponse.json({
          source: 'groq',
          content: payload.content,
          speechSegments: payload.speechSegments,
          action: buildNavigateAction(localVisitas),
          meta: { intent: 'consultar_visitas_campo' },
        } satisfies AgentChatResponse)
      }
    }

    const localPesquisaTendencia = detectPesquisaTendenciaIntent(message)
    if (localPesquisaTendencia) {
      const tendenciaResult = await executeServerTool(
        localPesquisaTendencia,
        origin,
        cookie,
        body.context,
        auth,
        message
      )
      if (tendenciaResult) {
        const content =
          typeof tendenciaResult === 'string' ? tendenciaResult : tendenciaResult.content
        return NextResponse.json({
          source: 'groq',
          content,
          action: buildNavigateAction(localPesquisaTendencia),
          meta: { intent: 'consultar_pesquisa_tendencia' },
        } satisfies AgentChatResponse)
      }
    }

    const localComparativoExpectativa = detectComparativoExpectativa2022Intent(message)
    if (localComparativoExpectativa) {
      const comparativoResult = await executeServerTool(
        localComparativoExpectativa,
        origin,
        cookie,
        body.context,
        auth,
        message
      )
      if (comparativoResult) {
        const payload =
          typeof comparativoResult === 'string'
            ? { content: comparativoResult }
            : {
                content: comparativoResult.content,
                speechSegments: comparativoResult.speechSegments,
              }
        return NextResponse.json({
          source: 'groq',
          content: payload.content,
          speechSegments: payload.speechSegments,
          action: buildNavigateAction(localComparativoExpectativa),
          meta: { intent: 'consultar_comparativo_expectativa_2022' },
        } satisfies AgentChatResponse)
      }
    }

    const localRankingEstimulada = detectRankingEstimuladaFederalIntent(message)
    if (localRankingEstimulada) {
      const rankingResult = await executeServerTool(
        localRankingEstimulada,
        origin,
        cookie,
        body.context,
        auth,
        message
      )
      if (rankingResult) {
        const content = typeof rankingResult === 'string' ? rankingResult : rankingResult.content
        return NextResponse.json({
          source: 'groq',
          content,
          action: buildNavigateAction(localRankingEstimulada),
          meta: { intent: 'consultar_ranking_estimulada_federal' },
        } satisfies AgentChatResponse)
      }
    }

    if (shouldRouteToClaudeAnalysis(message)) {
      const claude = await runClaudeAnalysis(
        message,
        body.history ?? [],
        origin,
        cookie,
        body.context
      )
      return NextResponse.json({
        source: 'anthropic',
        content: claude.content,
        meta: {
          intent: 'consultar_analise_claude',
          claudeUsage: claude.usage,
        },
      } satisfies AgentChatResponse)
    }

    if (!process.env.GROQ_API_KEY?.trim()) {
      return NextResponse.json(fallbackResponse('no_key'))
    }

    const classified = await classifyAgentIntent(message, body.history ?? [], body.context)
    if (!classified) {
      return NextResponse.json(fallbackResponse('groq_error'))
    }

    if (isMisclassifiedAnalysisIntent(message, classified.intent) && isAnthropicAgentEnabled()) {
      const claude = await runClaudeAnalysis(
        message,
        body.history ?? [],
        origin,
        cookie,
        body.context
      )
      return NextResponse.json({
        source: 'anthropic',
        content: claude.content,
        meta: {
          intent: 'consultar_analise_claude',
          claudeUsage: claude.usage,
        },
      } satisfies AgentChatResponse)
    }

    if (!validateClassifiedIntentAgainstMessage(message, classified)) {
      return NextResponse.json({
        source: 'groq',
        content: buildOutOfScopeReply(),
        meta: { intent: 'desconhecido' },
      } satisfies AgentChatResponse)
    }

    if (classified.intent === 'resposta_direta') {
      const directReply = classified.direct_reply?.trim() ?? ''
      const waRetry = detectWhatsAppSendIntent(message)
      if (
        waRetry &&
        (isFakeWhatsAppDirectReply(directReply) || /\b(envia|enviar|envie|mand[ae]|resumo|briefing)\b/i.test(message))
      ) {
        try {
          const content = await toolEnviarWhatsApp(waRetry.args, origin, cookie, supabase, auth.user)
          return NextResponse.json({
            source: 'groq',
            content,
            meta: { intent: 'enviar_whatsapp' },
          } satisfies AgentChatResponse)
        } catch (err) {
          console.error('[agent/chat] WhatsApp retry:', err)
          return NextResponse.json({
            source: 'groq',
            content: err instanceof Error ? err.message : 'Não foi possível enviar o WhatsApp.',
            meta: { intent: 'enviar_whatsapp' },
          } satisfies AgentChatResponse)
        }
      }

      const content = isGreetingQuery(message)
        ? buildGreetingReply(message)
        : directReply || buildGreetingReply(message)
      return NextResponse.json({
        source: 'groq',
        content,
        meta: { intent: classified.intent },
      } satisfies AgentChatResponse)
    }

    if (classified.intent === 'ajuda') {
      return NextResponse.json({
        source: 'groq',
        content: buildHelpReply(),
        meta: { intent: 'ajuda' },
      } satisfies AgentChatResponse)
    }

    if (classified.intent === 'desconhecido') {
      return NextResponse.json({
        source: 'groq',
        content: buildOutOfScopeReply(),
        meta: { intent: 'desconhecido' },
      } satisfies AgentChatResponse)
    }

    if (classified.intent === 'enviar_whatsapp') {
      try {
        const mergedArgs = { ...detectWhatsAppSendIntent(message)?.args, ...classified.args }
        const content = await toolEnviarWhatsApp(mergedArgs, origin, cookie, supabase, auth.user)
        return NextResponse.json({
          source: 'groq',
          content,
          meta: { intent: 'enviar_whatsapp' },
        } satisfies AgentChatResponse)
      } catch (err) {
        console.error('[agent/chat] WhatsApp groq:', err)
        return NextResponse.json({
          source: 'groq',
          content: err instanceof Error ? err.message : 'Não foi possível enviar o WhatsApp.',
          meta: { intent: 'enviar_whatsapp' },
        } satisfies AgentChatResponse)
      }
    }

    const serverContent = await executeServerTool(classified, origin, cookie, body.context, auth, message)
    if (serverContent) {
      const action = buildNavigateAction(classified)
      const payload =
        typeof serverContent === 'string'
          ? { content: serverContent }
          : {
              content: serverContent.content,
              speechSegments: serverContent.speechSegments,
              pesquisaTipoPending: serverContent.pesquisaTipoPending,
              agendaScopePending: serverContent.agendaScopePending,
            }
      return NextResponse.json({
        source: 'groq',
        content: payload.content,
        speechSegments: payload.speechSegments,
        pesquisaTipoPending: payload.pesquisaTipoPending,
        agendaScopePending: payload.agendaScopePending,
        action,
        meta: { intent: classified.intent },
      } satisfies AgentChatResponse)
    }

    if (isClientOnlyIntent(classified.intent)) {
      const args = { ...classified.args }
      if (args.cidade && isInvalidCityCandidate(args.cidade)) {
        delete args.cidade
      }
      const clientQuery = intentToSyntheticQuery(classified.intent, args)
      if (clientQuery) {
        return NextResponse.json({
          source: 'groq',
          content: '',
          clientQuery,
          meta: { intent: classified.intent },
        } satisfies AgentChatResponse)
      }
    }

    return NextResponse.json(fallbackResponse('unhandled'))
  } catch (err) {
    console.error('[agent/chat] exceção não tratada:', err)
    return NextResponse.json(fallbackResponse('exception'))
  }
}
