/**
 * Gera URL temporária de imagem (DALL-E 3) inspirada na referência visual,
 * usando visão para extrair tom/cenário sem copiar rostos ou enquadramento.
 * Requer OPENAI_API_KEY no servidor. Em falha retorna null (caller faz fallback).
 */

function stripJsonFence(text: string): string {
  return text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
}

async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl, { redirect: 'follow' })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 18 * 1024 * 1024) return null
  const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  const mime = ct.startsWith('image/') ? ct : 'image/jpeg'
  const b64 = buf.toString('base64')
  return `data:${mime};base64,${b64}`
}

async function visionPromptForDalle(
  dataUrl: string,
  context: { tema: string; cidade: string; tipoObra: string }
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const userText = [
    'Contexto para uma arte quadrada 1:1 de redes sociais sobre obras públicas no Brasil.',
    `Cidade ou região: ${context.cidade}.`,
    `Tipo de obra: ${context.tipoObra}.`,
    `Tema visual de referência no banco: ${context.tema}.`,
    '',
    'Analise a imagem de referência apenas como inspiração de clima (obra, pavimentação, equipe, equipamentos, luz).',
    'Precisamos de uma NOVA fotografia original: pessoas diferentes, outro ângulo, outra composição — nunca copiar rostos identificáveis nem o enquadramento literal.',
    '',
    'Responda APENAS com JSON válido, uma linha, sem markdown:',
    '{"dalle_prompt":"..."}',
    '',
    'O valor de dalle_prompt deve estar em inglês, em um único parágrafo, descrevendo uma foto documental realista (não ilustração), adequada ao DALL-E 3, sem nomes de políticos, sem logos de partido, sem texto na imagem.',
  ].join('\n')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a creative director for civic infrastructure photography. Output only the JSON object requested by the user, nothing else.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.warn('[openai-inspired-background] vision HTTP', res.status, err.slice(0, 200))
    return null
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = body.choices?.[0]?.message?.content?.trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(stripJsonFence(raw)) as { dalle_prompt?: string }
    const p = typeof parsed.dalle_prompt === 'string' ? parsed.dalle_prompt.trim() : ''
    return p.length > 40 ? p : null
  } catch {
    return null
  }
}

async function dalleGenerateImageUrl(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 3900),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    console.warn('[openai-inspired-background] dalle HTTP', res.status, err.slice(0, 300))
    return null
  }

  const body = (await res.json()) as {
    data?: Array<{ url?: string }>
  }
  const url = body.data?.[0]?.url
  return typeof url === 'string' && url.startsWith('http') ? url : null
}

/**
 * Tenta gerar URL HTTPS temporária (OpenAI) de fundo inspirado na referência.
 */
export async function tryGenerateInspiredBackgroundUrl(opts: {
  referenceImageUrl: string
  tema: string
  cidade: string
  tipoObra: string
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY?.trim()) return null

  const dataUrl = await fetchImageAsDataUrl(opts.referenceImageUrl)
  if (!dataUrl) {
    console.warn('[openai-inspired-background] não foi possível baixar a imagem de referência')
    return null
  }

  const dallePrompt = await visionPromptForDalle(dataUrl, {
    tema: opts.tema,
    cidade: opts.cidade,
    tipoObra: opts.tipoObra,
  })
  if (!dallePrompt) return null

  return dalleGenerateImageUrl(dallePrompt)
}
