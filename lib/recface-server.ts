const DEFAULT_RECFACE_URL = 'http://127.0.0.1:8502'

export function getRecfaceApiUrl(): string {
  return (process.env.RECFACE_API_URL ?? DEFAULT_RECFACE_URL).replace(/\/$/, '')
}

export async function recfaceFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${getRecfaceApiUrl()}${path.startsWith('/') ? path : `/${path}`}`
  return fetch(url, {
    ...init,
    cache: 'no-store',
  })
}

export async function recfaceJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await recfaceFetch(path, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string }
    const msg = body.detail ?? body.error ?? `Erro ${res.status} no serviço de reconhecimento facial`
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export async function recfaceHealthCheck(): Promise<boolean> {
  try {
    const res = await recfaceFetch('/health', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
