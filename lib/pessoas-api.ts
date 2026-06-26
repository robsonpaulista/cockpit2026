export interface Pessoa {
  id: string
  name: string
  role_tag: string | null
  reference_image_path: string | null
  notes: string | null
  photo_count: number
  enrollment_count: number
  reference_image_url: string | null
  created_at: string
  updated_at: string
}

export interface CreatePessoaInput {
  name: string
  roleTag?: string
  notes?: string
}

export interface UpdatePessoaInput {
  name?: string
  roleTag?: string | null
  notes?: string | null
}

const BASE = '/api/arquivos/pessoas'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, credentials: 'include' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const pessoasApi = {
  list(): Promise<Pessoa[]> {
    return requestJson('')
  },

  create(input: CreatePessoaInput): Promise<Pessoa> {
    return requestJson('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  },

  update(id: string, input: UpdatePessoaInput): Promise<Pessoa> {
    return requestJson(`/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  },

  remove(id: string): Promise<void> {
    return requestJson(`/${id}`, { method: 'DELETE' })
  },

  enrollFace(id: string, image: File): Promise<Pessoa> {
    const form = new FormData()
    form.set('image', image)
    return fetch(`${BASE}/${id}/enroll`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    }).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erro ${res.status}`)
      }
      return res.json() as Promise<Pessoa>
    })
  },

  getReferenceImageUrl(id: string): string {
    return `${BASE}/${id}/reference-image`
  },
}
