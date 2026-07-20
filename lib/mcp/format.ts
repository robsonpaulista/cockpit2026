/** Resposta padrão de tool MCP (texto JSON legível para o modelo). */
export function mcpJsonText(data: unknown): {
  content: Array<{ type: 'text'; text: string }>
} {
  return {
    content: [
      {
        type: 'text',
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  }
}

export function mcpErrorText(message: string): {
  content: Array<{ type: 'text'; text: string }>
  isError: true
} {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  }
}
