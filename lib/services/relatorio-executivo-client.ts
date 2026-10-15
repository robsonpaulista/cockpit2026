import type { CampoDemandaObraRow } from '@/lib/campo-demandas-obras'
import type { EmendaRegistro } from '@/lib/emendas-filtro'
import type { RelatorioAcervoSalvo } from '@/lib/war-room/relatorio-executivo-acervo'
import type { PlanoDriveLinkLite } from '@/lib/war-room/relatorio-executivo-municipio'

const ACERVO_URL = '/api/war-room/relatorio-executivo/acervo'

export type DadosRelatorioExecutivo = {
  emendas: EmendaRegistro[]
  demandas: CampoDemandaObraRow[]
  planosDrive: PlanoDriveLinkLite[]
}

export type AcervoItemPayload = {
  id?: string | null
  municipio: string
  obraId?: string | null
  titulo: string
  status: string
  url: string
  label: string | null
}

async function erroDaResposta(res: Response, padrao: string): Promise<Error> {
  const json = (await res.json().catch(() => null)) as { error?: string } | null
  return new Error(json?.error ?? padrao)
}

/** Emendas, demandas de obras e links de plano no Drive (todas as cidades). */
export async function carregarDadosRelatorioExecutivo(): Promise<DadosRelatorioExecutivo> {
  const [emRes, demRes, driveRes] = await Promise.all([
    fetch('/api/emendas', { cache: 'no-store' }),
    fetch('/api/campo/demands', { cache: 'no-store' }),
    fetch('/api/campo/obras-mapa/plano-drive', { cache: 'no-store' }),
  ])

  if (!emRes.ok) throw new Error('Falha ao carregar emendas')
  const emJson = (await emRes.json()) as { emendas?: EmendaRegistro[] }

  if (!demRes.ok) throw new Error('Falha ao carregar obras')
  const demJson: unknown = await demRes.json().catch(() => null)

  let planosDrive: PlanoDriveLinkLite[] = []
  if (driveRes.ok) {
    const driveJson = (await driveRes.json()) as { links?: PlanoDriveLinkLite[] }
    planosDrive = Array.isArray(driveJson.links) ? driveJson.links : []
  }

  return {
    emendas: Array.isArray(emJson.emendas) ? emJson.emendas : [],
    demandas: Array.isArray(demJson) ? (demJson as CampoDemandaObraRow[]) : [],
    planosDrive,
  }
}

export async function listarAcervoRelatorio(municipio: string): Promise<RelatorioAcervoSalvo[]> {
  if (!municipio.trim()) return []
  try {
    const res = await fetch(`${ACERVO_URL}?municipio=${encodeURIComponent(municipio)}`, { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { items?: RelatorioAcervoSalvo[] } | null
    return Array.isArray(json?.items) ? json.items : []
  } catch {
    return []
  }
}

export async function salvarAcervoRelatorio(item: AcervoItemPayload): Promise<void> {
  const res = await fetch(ACERVO_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  })
  if (!res.ok) throw await erroDaResposta(res, 'Falha ao salvar link')
}

export async function removerAcervoRelatorio(id: string): Promise<void> {
  const res = await fetch(`${ACERVO_URL}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw await erroDaResposta(res, 'Falha ao remover')
}
