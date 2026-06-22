function previewResponseText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text.trim()) {
    throw new Error(res.ok ? 'Resposta vazia do servidor.' : `Erro ${res.status} no servidor.`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    const preview = previewResponseText(text)
    throw new Error(
      res.ok
        ? 'Resposta inválida do servidor (não é JSON).'
        : `Erro ${res.status}${preview ? `: ${preview}` : ' no servidor.'}`
    )
  }
}
