import type {
  WarRoomPesquisaAndamento,
  WarRoomPesquisaAndamentoInput,
} from '@/lib/war-room/pesquisas-andamento'

export type PesquisasAndamentoListResult = {
  items: WarRoomPesquisaAndamento[]
  error?: string
  setupRequired?: boolean
}

export async function fetchPesquisasAndamento(): Promise<PesquisasAndamentoListResult> {
  try {
    const res = await fetch('/api/war-room/pesquisas-andamento', { cache: 'no-store' })
    let json: {
      items?: WarRoomPesquisaAndamento[]
      error?: string
      setupRequired?: boolean
    } = {}
    try {
      json = (await res.json()) as typeof json
    } catch {
      json = {}
    }
    if (!res.ok) {
      return {
        items: Array.isArray(json.items) ? json.items : [],
        error: json.error ?? 'Não foi possível carregar as pesquisas em andamento.',
        setupRequired: json.setupRequired === true,
      }
    }
    return { items: Array.isArray(json.items) ? json.items : [] }
  } catch {
    return {
      items: [],
      error: 'Não foi possível carregar as pesquisas em andamento.',
    }
  }
}

export async function savePesquisaAndamento(
  input: WarRoomPesquisaAndamentoInput,
): Promise<{ item?: WarRoomPesquisaAndamento; error?: string; setupRequired?: boolean }> {
  const res = await fetch('/api/war-room/pesquisas-andamento', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = (await res.json()) as {
    item?: WarRoomPesquisaAndamento
    error?: string
    setupRequired?: boolean
  }
  if (!res.ok) {
    return {
      error: json.error ?? 'Não foi possível salvar a pesquisa.',
      setupRequired: json.setupRequired === true,
    }
  }
  return { item: json.item }
}

export type CidadePesquisaOpcao = {
  id: string
  name: string
}

export async function fetchCidadesPesquisa(): Promise<CidadePesquisaOpcao[]> {
  const res = await fetch('/api/campo/cities', { cache: 'no-store' })
  if (!res.ok) return []
  let json: unknown
  try {
    json = await res.json()
  } catch {
    return []
  }
  if (!Array.isArray(json)) return []
  return json
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const row = raw as { id?: unknown; name?: unknown }
      const name = String(row.name ?? '').trim()
      const id = String(row.id ?? '').trim()
      if (!id || !name) return null
      return { id, name }
    })
    .filter((c): c is CidadePesquisaOpcao => c != null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function deletePesquisaAndamento(
  id: string,
): Promise<{ error?: string }> {
  const res = await fetch(
    `/api/war-room/pesquisas-andamento?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) {
    const json = (await res.json()) as { error?: string }
    return { error: json.error ?? 'Não foi possível remover a pesquisa.' }
  }
  return {}
}
