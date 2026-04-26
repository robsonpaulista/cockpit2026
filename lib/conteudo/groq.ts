/**
 * Geração de texto via Groq (chamar apenas no servidor — API routes).
 */

export interface GenerateCardTextParams {
  cidade: string
  territorio?: string
  tipo: string
  status: string
  template: string
  fase: string
  parceiro?: string
  valor?: number
}

export interface GeneratedCardTexts {
  titulo: string
  texto_arte: string
  legenda: string
}

function buildPrompt(params: GenerateCardTextParams): string {
  const { cidade, territorio, tipo, status, template, fase, parceiro, valor } = params

  const contexto = [
    `Cidade: ${cidade}`,
    territorio ? `Território: ${territorio}` : null,
    `Tipo de obra: ${tipo}`,
    `Status da obra: ${status}`,
    `Fase do conteúdo: ${fase}`,
    parceiro ? `Parceiro: ${parceiro}` : null,
    valor != null ? `Valor investido: R$ ${valor.toLocaleString('pt-BR')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const instrucoes: Record<string, string> = {
    obra_impacto: 'Foco na transformação que a obra vai trazer para a vida das pessoas da cidade.',
    prestacao_contas: 'Tom institucional e direto. Mostrar resultado concreto com obra, valor e parceiro.',
    cidade_beneficiada: 'Tom leve, local, próximo do cotidiano do morador.',
    agenda_chegada: 'Tom de visita, presença, acompanhamento in loco. Primeira pessoa.',
    frase_local: 'Tom emocional. Frase que conecta a obra ao dia a dia de quem mora lá.',
  }

  const instrucao = instrucoes[template] ?? 'Tom informativo e próximo da comunidade.'

  return `
Você é um redator político especializado em comunicação de mandato.
Gere um conteúdo para card de redes sociais com base nas informações abaixo.

${contexto}

Instrução de tom: ${instrucao}

Retorne APENAS um JSON válido, sem explicações, sem markdown, no formato:
{
  "titulo": "título curto do card (máx 8 palavras)",
  "texto_arte": "texto principal da arte (máx 15 palavras, direto, impactante)",
  "legenda": "legenda para a publicação (2-3 frases, tom natural, sem hashtags)"
}
`.trim()
}

function parseJsonFromModel(text: string): GeneratedCardTexts {
  const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  const parsed = JSON.parse(clean) as Record<string, unknown>
  return {
    titulo: String(parsed.titulo ?? ''),
    texto_arte: String(parsed.texto_arte ?? ''),
    legenda: String(parsed.legenda ?? ''),
  }
}

export async function generateCardText(params: GenerateCardTextParams): Promise<GeneratedCardTexts> {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    throw new Error('GROQ_API_KEY não configurada no servidor.')
  }

  const prompt = buildPrompt(params)

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq HTTP ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('Resposta vazia da Groq.')
  }

  try {
    return parseJsonFromModel(text)
  } catch {
    throw new Error('Não foi possível interpretar o JSON retornado pelo modelo.')
  }
}
