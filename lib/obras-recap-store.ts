import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

export type ObrasRecapItem = {
  id: string
  municipio?: string | null
  obra: string
  orgao?: string | null
  sei?: string | null
  status?: string | null
  valor_total?: number | null
  valor_pago?: number | null
  /** DOE — único dado de consulta persistido no JSON local. */
  doe_edicao?: string | null
  doe_resumo?: string | null
  doe_pdf_url?: string | null
  doe_nota_uuid?: string | null
  doe_encontrados?: number | null
  /** Cada ocorrência do SEI no DOE (texto do botão "resumo"). */
  doe_registros?: Array<{
    edicao: string
    titulo?: string | null
    dia?: string | null
    resumo: string
    pdfUrl?: string | null
    notaUuid: string
  }> | null
  doe_consultado_em?: string | null
  created_at: string
  updated_at: string
}

export type ObrasRecapTab = {
  nome: string
  items: ObrasRecapItem[]
  updatedAt: string
}

export type ObrasRecapStore = {
  tabs: Record<string, ObrasRecapTab>
}

const STORE_PATH = path.join(process.cwd(), 'data', 'obras-recap.json')

function emptyStore(): ObrasRecapStore {
  return { tabs: {} }
}

export async function readObrasRecapStore(): Promise<ObrasRecapStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as ObrasRecapStore
    if (!parsed || typeof parsed !== 'object' || !parsed.tabs) return emptyStore()
    return parsed
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return emptyStore()
    throw error
  }
}

export async function writeObrasRecapStore(store: ObrasRecapStore): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true })
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
}

export function listRecapTabNames(store: ObrasRecapStore): string[] {
  return Object.keys(store.tabs).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function getRecapTabItems(
  store: ObrasRecapStore,
  tabName: string,
): ObrasRecapItem[] {
  return store.tabs[tabName]?.items ?? []
}

function recapMatchKey(item: {
  sei?: string | null
  obra: string
  municipio?: string | null
}): string {
  const sei = (item.sei ?? '').trim().replace(/\s+/g, '')
  if (sei) return `sei:${sei}`
  return `obra:${(item.municipio ?? '').trim().toLowerCase()}|${item.obra.trim().toLowerCase()}`
}

/** Campos DOE preservados no reimport da planilha (SEI andamento fica no banco). */
function pickDoePreservado(
  prev: ObrasRecapItem | undefined,
  item: Partial<ObrasRecapItem>,
): Pick<
  ObrasRecapItem,
  | 'doe_edicao'
  | 'doe_resumo'
  | 'doe_pdf_url'
  | 'doe_nota_uuid'
  | 'doe_encontrados'
  | 'doe_registros'
  | 'doe_consultado_em'
> {
  return {
    doe_edicao: item.doe_edicao ?? prev?.doe_edicao ?? null,
    doe_resumo: item.doe_resumo ?? prev?.doe_resumo ?? null,
    doe_pdf_url: item.doe_pdf_url ?? prev?.doe_pdf_url ?? null,
    doe_nota_uuid: item.doe_nota_uuid ?? prev?.doe_nota_uuid ?? null,
    doe_encontrados: item.doe_encontrados ?? prev?.doe_encontrados ?? null,
    doe_registros: item.doe_registros ?? prev?.doe_registros ?? null,
    doe_consultado_em: item.doe_consultado_em ?? prev?.doe_consultado_em ?? null,
  }
}

export async function importRecapItems(opts: {
  tabName: string
  items: Array<Omit<ObrasRecapItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }>
  /** Se true, substitui a aba inteira. Se false, acrescenta. */
  replace?: boolean
}): Promise<{ tabName: string; imported: number; total: number }> {
  const tabName = opts.tabName.trim().replace(/\s+/g, ' ')
  if (!tabName) throw new Error('Nome da aba é obrigatório')

  const now = new Date().toISOString()
  const store = await readObrasRecapStore()
  const existing = store.tabs[tabName]?.items ?? []
  const existingByKey = new Map(existing.map((row) => [recapMatchKey(row), row]))

  const nextItems: ObrasRecapItem[] = opts.items.map((item) => {
    const prev = existingByKey.get(recapMatchKey(item))
    const doe = pickDoePreservado(prev, item)
    return {
      id: item.id?.trim() || prev?.id || randomUUID(),
      municipio: item.municipio ?? null,
      obra: item.obra,
      orgao: item.orgao ?? null,
      sei: item.sei ?? null,
      status: item.status ?? null,
      valor_total: item.valor_total ?? null,
      valor_pago: item.valor_pago ?? null,
      ...doe,
      created_at: prev?.created_at ?? now,
      updated_at: now,
    }
  })

  const items = opts.replace === false ? [...existing, ...nextItems] : nextItems

  store.tabs[tabName] = {
    nome: tabName,
    items,
    updatedAt: now,
  }
  await writeObrasRecapStore(store)
  return { tabName, imported: nextItems.length, total: items.length }
}

export async function updateRecapItem(
  tabName: string,
  id: string,
  patch: Partial<ObrasRecapItem>,
): Promise<ObrasRecapItem | null> {
  const store = await readObrasRecapStore()
  const tab = store.tabs[tabName]
  if (!tab) return null
  const idx = tab.items.findIndex((item) => item.id === id)
  if (idx < 0) return null

  const now = new Date().toISOString()
  const current = tab.items[idx]
  const updated: ObrasRecapItem = {
    ...current,
    ...patch,
    id: current.id,
    obra: (patch.obra ?? current.obra).trim() || current.obra,
    created_at: current.created_at,
    updated_at: now,
  }
  tab.items[idx] = updated
  tab.updatedAt = now
  await writeObrasRecapStore(store)
  return updated
}

export async function findRecapItemById(
  id: string,
): Promise<{ tabName: string; item: ObrasRecapItem } | null> {
  const store = await readObrasRecapStore()
  for (const [tabName, tab] of Object.entries(store.tabs)) {
    const item = tab.items.find((row) => row.id === id)
    if (item) return { tabName, item }
  }
  return null
}
