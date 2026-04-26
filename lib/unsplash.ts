const queries: Record<string, string> = {
  pavimentacao: 'road asphalt construction',
  turismo: 'beach coastal tourism',
  saude: 'healthcare building',
  educacao: 'school building education',
  saneamento: 'water infrastructure',
  iluminacao: 'street lighting urban night',
  geral: 'urban infrastructure city',
}

export async function fetchUnsplashImage(tipo: string): Promise<string | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) return null

  const query = queries[tipo] ?? queries.geral

  try {
    const response = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=squarish`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
        },
      }
    )
    if (!response.ok) return null
    const data = (await response.json()) as { urls?: { regular?: string } }
    return data.urls?.regular ?? null
  } catch {
    return null
  }
}
