import {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  ANTHROPIC_AGENT_MODEL,
  ANTHROPIC_MAX_OUTPUT_TOKENS,
  ANTHROPIC_MAX_RETRIES,
  getAnthropicApiKey,
} from '@/lib/agent/claude-config'
import {
  CLAUDE_STATIC_SYSTEM_PROMPT,
  buildClaudeDynamicSystemPrompt,
} from '@/lib/agent/claude-system-prompt'
import type { AgentChatMessage, AgentContextPayload } from '@/lib/agent/types'

export interface ClaudeMessageResult {
  content: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfterMs(response: Response): number {
  const header = response.headers.get('retry-after')
  if (!header) return 2000
  const seconds = Number(header)
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now())
  return 2000
}

function extractTextFromAnthropicBody(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const content = (body as { content?: unknown }).content
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: string; text?: string } => {
      return Boolean(block && typeof block === 'object' && (block as { type?: string }).type === 'text')
    })
    .map((block) => block.text ?? '')
    .join('')
    .trim()
}

export class ClaudeApiError extends Error {
  status: number
  retryable: boolean

  constructor(message: string, status: number, retryable: boolean) {
    super(message)
    this.name = 'ClaudeApiError'
    this.status = status
    this.retryable = retryable
  }
}

export async function callClaudeAnalysis(
  message: string,
  history: AgentChatMessage[],
  context: AgentContextPayload | undefined,
  dataBlock: string,
  options?: { maxOutputTokens?: number }
): Promise<ClaudeMessageResult> {
  const apiKey = getAnthropicApiKey()
  if (!apiKey) {
    throw new ClaudeApiError('ANTHROPIC_API_KEY não configurada', 401, false)
  }

  const dynamicSystem = buildClaudeDynamicSystemPrompt(context, dataBlock)
  const recentHistory = history.slice(-4).filter((m) => m.content?.trim())

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...recentHistory.map((m) => ({
      role: m.role,
      content: m.content.trim(),
    })),
    { role: 'user', content: message.trim() },
  ]

  const maxTokens = options?.maxOutputTokens ?? ANTHROPIC_MAX_OUTPUT_TOKENS

  const payload = {
    model: ANTHROPIC_AGENT_MODEL,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: CLAUDE_STATIC_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: dynamicSystem,
      },
    ],
    messages,
  }

  let lastError: ClaudeApiError | null = null

  for (let attempt = 0; attempt <= ANTHROPIC_MAX_RETRIES; attempt++) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const body = await response.json()
      let content = extractTextFromAnthropicBody(body)
      if (!content) {
        throw new ClaudeApiError('Resposta vazia da Anthropic', 502, false)
      }
      const stopReason = (body as { stop_reason?: string }).stop_reason
      if (stopReason === 'max_tokens') {
        content +=
          '\n\n---\n_Resposta atingiu o limite de tamanho. Diga **continue o cronograma** para completar as semanas restantes._'
      }
      const usage = (body as { usage?: ClaudeMessageResult['usage'] }).usage
      return { content, usage }
    }

    const status = response.status
    const retryable = status === 429 || status === 529
    let detail = ''
    try {
      const errBody = await response.json()
      detail =
        typeof errBody?.error?.message === 'string'
          ? errBody.error.message
          : JSON.stringify(errBody).slice(0, 200)
    } catch {
      detail = await response.text().catch(() => '')
    }

    lastError = new ClaudeApiError(
      detail || `Anthropic HTTP ${status}`,
      status,
      retryable
    )

    if (!retryable || attempt >= ANTHROPIC_MAX_RETRIES) {
      throw lastError
    }

    const delay = status === 429 ? parseRetryAfterMs(response) : 1500 * 2 ** attempt
    await sleep(delay)
  }

  throw lastError ?? new ClaudeApiError('Falha na Anthropic', 500, false)
}

export function claudeErrorToUserMessage(err: unknown): string {
  if (err instanceof ClaudeApiError) {
    if (err.status === 401) {
      return 'Análise por IA indisponível: verifique ANTHROPIC_API_KEY no servidor.'
    }
    if (err.status === 429) {
      return 'Limite da API Anthropic atingido (rate ou gasto). Tente em alguns minutos ou use comandos diretos no Jarvis.'
    }
    if (err.status === 529) {
      return 'Serviço Anthropic sobrecarregado. Tente novamente em instantes.'
    }
    return `Não consegui concluir a análise: ${err.message}`
  }
  return 'Não consegui concluir a análise agora. Use comandos diretos (ex.: «pesquisa em Teresina»).'
}
