export interface RecfaceStats {
  visitorsCount: number
  agendaCount: number
  logsCount: number
  engineAvailable: boolean
}

export interface RecfaceEngine {
  available: boolean
  label: string
  error: string | null
}

export interface RecfaceVisitor {
  id: string
  name: string
  registered_at?: string
  updated_at?: string
  face_updated_at?: string
  registration_capture?: string
}

export interface RecfaceAgendaEntry {
  name: string
  time: string
  location: string
}

export interface RecfaceAgendaWithPresence extends RecfaceAgendaEntry {
  'Presença na entrada'?: string
  presence?: string
}

export interface RecfaceRecognitionResult {
  recognized: boolean
  name: string | null
  visitorId: string | null
  distance: number
  confidence: number
  agendaValid: boolean
  statusMessage: string
  agendaEntry: RecfaceAgendaEntry | null
}

export interface RecfaceLogEntry {
  visitor: string
  scheduled_time: string
  score: number
  distance: number
  timestamp: string
  status: string
  location: string
  agenda_valid: boolean
  reference_time_note?: string
}

const BASE = '/api/arquivos/recface'

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      detail?: string | Array<{ msg?: string }>
    }
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((d) => d.msg).filter(Boolean).join('; ')
          : undefined
    throw new Error(body.error ?? detail ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function requestForm<T>(path: string, form: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method, body: form, credentials: 'include' })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string
      detail?: string | Array<{ msg?: string }>
    }
    const detail =
      typeof body.detail === 'string'
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((d) => d.msg).filter(Boolean).join('; ')
          : undefined
    throw new Error(body.error ?? detail ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const recfaceApi = {
  getHealth(): Promise<{ ok: boolean; status?: string; engine?: RecfaceEngine }> {
    return requestJson('')
  },

  getStats(): Promise<RecfaceStats> {
    return requestJson('/stats')
  },

  getEngine(): Promise<RecfaceEngine> {
    return requestJson('/engine')
  },

  listVisitors(): Promise<RecfaceVisitor[]> {
    return requestJson('/visitors')
  },

  registerVisitor(name: string, image: File): Promise<{ id: string; name: string; warning?: string }> {
    const form = new FormData()
    form.set('name', name)
    form.set('image', image)
    return requestForm('/visitors', form)
  },

  updateVisitorName(id: string, name: string): Promise<{ message: string }> {
    return requestJson(`/visitors/${id}/name`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  },

  updateVisitorFace(id: string, image: File): Promise<{ message: string }> {
    const form = new FormData()
    form.set('image', image)
    return requestForm(`/visitors/${id}/face`, form, 'PUT')
  },

  deleteVisitor(id: string): Promise<{ message: string }> {
    return requestJson(`/visitors/${id}`, { method: 'DELETE' })
  },

  getAgenda(): Promise<RecfaceAgendaEntry[]> {
    return requestJson('/agenda')
  },

  getAgendaWithPresence(): Promise<Array<RecfaceAgendaEntry & { presence: string }>> {
    return requestJson<Array<Record<string, string>>>('/agenda/with-presence').then((rows) =>
      rows.map((row) => ({
        name: row.Nome ?? row.name ?? '',
        time: row.Horário ?? row.time ?? '',
        location: row.Local ?? row.location ?? '',
        presence: row['Presença na entrada'] ?? row.presence ?? '',
      })),
    )
  },

  appendAgenda(entry: RecfaceAgendaEntry): Promise<{ message: string }> {
    return requestJson('/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  },

  removeAgendaForName(name: string): Promise<{ message: string }> {
    return requestJson(`/agenda/${encodeURIComponent(name)}`, { method: 'DELETE' })
  },

  recognize(imageBase64: string, options?: { log?: boolean; toleranceMinutes?: number }): Promise<RecfaceRecognitionResult> {
    return requestJson('/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        log: options?.log ?? false,
        toleranceMinutes: options?.toleranceMinutes ?? 90,
      }),
    })
  },

  recognizeUpload(image: File, log = false): Promise<RecfaceRecognitionResult> {
    const form = new FormData()
    form.set('image', image)
    form.set('log', String(log))
    return requestForm('/recognize/upload', form)
  },

  getLogs(limit = 500): Promise<RecfaceLogEntry[]> {
    return requestJson(`/logs?limit=${limit}`)
  },
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
    reader.readAsDataURL(file)
  })
}
