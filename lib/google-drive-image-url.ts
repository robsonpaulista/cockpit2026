/** Extrai o ID de arquivo de URLs comuns do Google Drive. */
export function extractGoogleDriveFileId(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/,
  ]

  for (const pattern of patterns) {
    const match = trimmed.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com/.test(url.trim())
}

/**
 * Formato direto do Drive (Power BI, embed externo):
 * https://drive.google.com/uc?export=view&id=FILE_ID
 */
export function googleDriveDirectViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`
}

/**
 * URL para `<img>` via proxy same-origin — contorna bloqueio de embed do Drive no browser.
 * Aceita link compartilhado ou só o ID do arquivo.
 */
export function googleDriveImagePreviewUrl(
  url: string | null | undefined,
  size = 1200
): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null

  const fileId = extractGoogleDriveFileId(trimmed)
  if (fileId) {
    return `/api/drive-image?id=${encodeURIComponent(fileId)}&w=${size}`
  }

  return trimmed
}

/** URL alternativa (menor) — fallback se a resolução principal falhar. */
export function googleDriveThumbnailUrl(url: string | null | undefined, size = 400): string | null {
  const trimmed = (url ?? '').trim()
  if (!trimmed) return null

  const fileId = extractGoogleDriveFileId(trimmed)
  if (fileId) {
    return `/api/drive-image?id=${encodeURIComponent(fileId)}&w=${size}`
  }

  return null
}

/** Primeira imagem disponível entre as obras de um marcador/município. */
export function primeiraImagemObraUrl(
  obras: Array<{ imagem_url?: string | null }>,
  size = 600
): string | null {
  for (const obra of obras) {
    const url = googleDriveImagePreviewUrl(obra.imagem_url, size)
    if (url) return url
  }
  return null
}

/** Municípios em teste com marcador de foto no mapa (por enquanto só Parnaíba). */
export function municipioUsaMarcadorFoto(municipio: string): boolean {
  const n = municipio
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  return n === 'parnaiba'
}
