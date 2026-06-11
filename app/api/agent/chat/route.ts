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
import { checkAgentRateLimit, AGENT_RATE_LIMITS } from '@/lib/agent/rate-limit'
import { intentToSyntheticQuery, isClientOnlyIntent } from '@/lib/agent/synthetic-query'
import {
  detectWhatsAppSendIntent,
  isFakeWhatsAppDirectReply,
} from '@/lib/agent/detect-whatsapp-send'
import { detectVisitasCampoIntent } from '@/lib/agent/detect-visitas-campo'
import {
  buildResumoBuscarCidadeSyntheticQuery,
  detectResumoBuscarCidadeIntent,
} from '@/lib/agent/resumo-eleicoes-city'
import { buildNavigateAction, executeServerTool } from '@/lib/agent/server-tools'
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
        hint: `Limite gratuito da IA (${AGENT_RATE_LIMITS.maxPerHour}/h). Tente em ~${rate.retryAfterSec ?? mins * 60}s ou use comandos diretos.`,
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

    if (!process.env.GROQ_API_KEY?.trim()) {
      return NextResponse.json(fallbackResponse('no_key'))
    }

    const classified = await classifyAgentIntent(message, body.history ?? [], body.context)
    if (!classified) {
      return NextResponse.json(fallbackResponse('groq_error'))
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
      const clientQuery = intentToSyntheticQuery(classified.intent, classified.args)
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
