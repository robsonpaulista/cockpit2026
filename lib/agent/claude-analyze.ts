import { callClaudeAnalysis, claudeErrorToUserMessage } from '@/lib/agent/claude-client'
import { gatherClaudeAnalysisContext } from '@/lib/agent/claude-gather-context'
import { resolveAnthropicMaxOutputTokens } from '@/lib/agent/claude-output-limits'
import type { AgentChatMessage, AgentContextPayload } from '@/lib/agent/types'

export interface ClaudeAnalysisResult {
  content: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export async function runClaudeAnalysis(
  message: string,
  history: AgentChatMessage[],
  origin: string,
  cookie: string,
  context?: AgentContextPayload
): Promise<ClaudeAnalysisResult> {
  const dataBlock = await gatherClaudeAnalysisContext(message, origin, cookie, context)
  const maxOutputTokens = resolveAnthropicMaxOutputTokens(message)
  try {
    return await callClaudeAnalysis(message, history, context, dataBlock, { maxOutputTokens })
  } catch (err) {
    console.error('[agent/claude]', err)
    return { content: claudeErrorToUserMessage(err) }
  }
}
