import type { WarRoomDisparo, WarRoomDisparoStatus } from '@/lib/war-room/mock-data'

/** Linha bruta da API Fluxo 55Dynamics `/api/campanhas`. */
export type FluxoCampanhaRow = {
  id?: string
  campanhaExternaId?: string | null
  canal?: string | null
  titulo?: string | null
  telefone?: string | null
  nome?: string | null
  status?: string | null
  erro?: string | null
  enviadoEm?: string | null
  createdAt?: string | null
  cidade?: string | null
  cargo?: string | null
}

export type FluxoCampanhasResponse = {
  data?: FluxoCampanhaRow[]
  pagination?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

function resolveDisparoStatus(taxaOkPct: number): WarRoomDisparoStatus {
  if (taxaOkPct < 70) return 'critico'
  if (taxaOkPct < 90) return 'atencao'
  return 'ok'
}

function isStatusOk(status: string | null | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase()
  if (!s) return false
  if (s.includes('erro') || s.includes('falha') || s.includes('fail')) return false
  // Enviado / Entregue / Delivered / etc.
  return (
    s.includes('enviad') ||
    s.includes('entreg') ||
    s.includes('deliver') ||
    s.includes('success') ||
    s.includes('ok')
  )
}

function titleCaseCidade(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[\s'-])(\S)/g, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'))
}

export type FluxoCampanhaLiderancaDetalhe = {
  nome: string
  cargo: string | null
  telefone: string | null
  status: string
  ok: boolean
  enviadoEm: string | null
}

export type FluxoCampanhaCidadeDetalhe = {
  cidade: string
  enviados: number
  ok: number
  liderancas: FluxoCampanhaLiderancaDetalhe[]
}

export type FluxoCampanhaDetalhe = {
  campanhaId: string | null
  titulo: string
  canal: string
  enviados: number
  ok: number
  cidades: FluxoCampanhaCidadeDetalhe[]
}

/** Árvore cidade → liderança para o modal de detalhe da campanha. */
export function buildCampanhaDetalheTree(
  rows: FluxoCampanhaRow[],
  opts?: { campanhaId?: string | null; titulo?: string | null },
): FluxoCampanhaDetalhe {
  const filtroId = (opts?.campanhaId ?? '').trim()
  const filtroTitulo = (opts?.titulo ?? '').trim().toLowerCase()

  const filtered = rows.filter((row) => {
    if (filtroId) {
      return (row.campanhaExternaId ?? '').trim() === filtroId
    }
    if (filtroTitulo) {
      return (row.titulo ?? '').trim().toLowerCase() === filtroTitulo
    }
    return true
  })

  type LidAcc = FluxoCampanhaLiderancaDetalhe
  type CidAcc = {
    cidade: string
    enviados: number
    ok: number
    liderancas: Map<string, LidAcc>
  }

  const byCidade = new Map<string, CidAcc>()
  let titulo = 'Campanha'
  let canal = 'WhatsApp'
  let campanhaId: string | null = filtroId || null
  let enviados = 0
  let ok = 0

  for (const row of filtered) {
    const t = (row.titulo ?? '').trim()
    if (t) titulo = t
    if (row.canal?.trim()) canal = row.canal.trim()
    const id = (row.campanhaExternaId ?? '').trim()
    if (id) campanhaId = id

    enviados += 1
    const rowOk = isStatusOk(row.status)
    if (rowOk) ok += 1

    const cidadeRaw = (row.cidade ?? '').trim() || 'Sem cidade'
    const cidadeKey = cidadeRaw.toLocaleLowerCase('pt-BR')
    const cidadeLabel = cidadeRaw === 'Sem cidade' ? cidadeRaw : titleCaseCidade(cidadeRaw)

    const cid = byCidade.get(cidadeKey) ?? {
      cidade: cidadeLabel,
      enviados: 0,
      ok: 0,
      liderancas: new Map<string, LidAcc>(),
    }
    cid.enviados += 1
    if (rowOk) cid.ok += 1

    const nome = (row.nome ?? '').trim() || 'Sem nome'
    const cargo = (row.cargo ?? '').trim() || null
    const telefone = (row.telefone ?? '').trim() || null
    const lidKey = `${nome.toLocaleLowerCase('pt-BR')}|${telefone ?? ''}|${cargo ?? ''}`
    const prevLid = cid.liderancas.get(lidKey)
    if (!prevLid) {
      cid.liderancas.set(lidKey, {
        nome,
        cargo,
        telefone,
        status: (row.status ?? '').trim() || '—',
        ok: rowOk,
        enviadoEm: row.enviadoEm || row.createdAt || null,
      })
    } else if (rowOk && !prevLid.ok) {
      // Preferir status OK se houver reenvio.
      cid.liderancas.set(lidKey, {
        ...prevLid,
        status: (row.status ?? '').trim() || prevLid.status,
        ok: true,
        enviadoEm: row.enviadoEm || row.createdAt || prevLid.enviadoEm,
      })
    }

    byCidade.set(cidadeKey, cid)
  }

  const cidades: FluxoCampanhaCidadeDetalhe[] = [...byCidade.values()]
    .map((c) => ({
      cidade: c.cidade,
      enviados: c.enviados,
      ok: c.ok,
      liderancas: [...c.liderancas.values()].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    }))
    .sort((a, b) =>
      b.enviados !== a.enviados
        ? b.enviados - a.enviados
        : a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' }),
    )

  return {
    campanhaId,
    titulo,
    canal,
    enviados,
    ok,
    cidades,
  }
}

/**
 * Agrega envios individuais em campanhas para o card Disparos recentes.
 * Barra/% = taxa de status OK (enviado/entregue) — a API não expõe CTR.
 */
export function aggregateFluxoCampanhasToDisparos(
  rows: FluxoCampanhaRow[],
): WarRoomDisparo[] {
  type Acc = {
    campanhaId: string | null
    titulo: string
    canal: string
    enviados: number
    ok: number
    cidades: Map<string, number>
    lastAt: string | null
  }

  const byKey = new Map<string, Acc>()

  for (const row of rows) {
    const titulo = (row.titulo ?? '').trim() || 'Campanha'
    const id = (row.campanhaExternaId ?? '').trim()
    const key = id || titulo.toLowerCase()
    const prev = byKey.get(key) ?? {
      campanhaId: id || null,
      titulo,
      canal: (row.canal ?? '').trim() || 'WhatsApp',
      enviados: 0,
      ok: 0,
      cidades: new Map<string, number>(),
      lastAt: null as string | null,
    }
    prev.enviados += 1
    if (isStatusOk(row.status)) prev.ok += 1
    if (titulo && prev.titulo === 'Campanha') prev.titulo = titulo
    if (row.canal?.trim()) prev.canal = row.canal.trim()
    if (id) prev.campanhaId = id

    const cidadeRaw = (row.cidade ?? '').trim()
    if (cidadeRaw) {
      prev.cidades.set(cidadeRaw, (prev.cidades.get(cidadeRaw) ?? 0) + 1)
    }

    const at = row.enviadoEm || row.createdAt || null
    if (at && (!prev.lastAt || at > prev.lastAt)) prev.lastAt = at

    byKey.set(key, prev)
  }

  const list: Array<WarRoomDisparo & { lastAt: string | null }> = []

  for (const acc of byKey.values()) {
    const taxaOk =
      acc.enviados > 0 ? Math.round((acc.ok / acc.enviados) * 1000) / 10 : 0

    let cidade: string | null = null
    if (acc.cidades.size === 1) {
      cidade = titleCaseCidade([...acc.cidades.keys()][0]!)
    } else if (acc.cidades.size > 1) {
      let top = ''
      let topN = 0
      for (const [c, n] of acc.cidades) {
        if (n > topN) {
          top = c
          topN = n
        }
      }
      if (top && topN >= acc.enviados * 0.5) {
        cidade = titleCaseCidade(top)
      }
    }

    list.push({
      campanha: acc.titulo,
      campanhaId: acc.campanhaId,
      publico: acc.canal,
      enviados: acc.enviados,
      entregues: acc.ok,
      clicksPct: taxaOk,
      status: resolveDisparoStatus(taxaOk),
      cidade,
      lastAt: acc.lastAt,
    })
  }

  list.sort((a, b) => {
    const ta = a.lastAt ?? ''
    const tb = b.lastAt ?? ''
    if (ta !== tb) return tb.localeCompare(ta)
    return b.enviados - a.enviados
  })

  return list.map(({ lastAt: _l, ...rest }) => rest)
}

export function getFluxoCampanhasConfig(): {
  url: string
  apiKey: string
} | null {
  const url = process.env.FLUXO_CAMPANHAS_API_URL?.trim()
  const apiKey = process.env.FLUXO_CAMPANHAS_API_KEY?.trim()
  if (!url || !apiKey) return null
  return { url, apiKey }
}

/** Busca páginas da API Fluxo e devolve linhas (até cobrir o total ou o teto). */
export async function fetchFluxoCampanhasRows(opts?: {
  limitPerPage?: number
  /** Máximo de páginas. Default alto o bastante para o volume atual (~6×100). */
  maxPages?: number
  /** Filtro API: id externo da campanha. */
  campanha?: string
  /** Filtro API: título da campanha. */
  titulo?: string
  signal?: AbortSignal
}): Promise<{ rows: FluxoCampanhaRow[]; total: number }> {
  const cfg = getFluxoCampanhasConfig()
  if (!cfg) {
    throw new Error('FLUXO_CAMPANHAS_API_URL / FLUXO_CAMPANHAS_API_KEY não configurados')
  }

  const limitPerPage = Math.min(Math.max(opts?.limitPerPage ?? 100, 1), 200)
  const maxPages = Math.min(Math.max(opts?.maxPages ?? 20, 1), 50)
  const campanha = opts?.campanha?.trim()
  const titulo = opts?.titulo?.trim()

  const rows: FluxoCampanhaRow[] = []
  let total = 0
  let totalPages = 1

  for (let page = 1; page <= maxPages && page <= totalPages; page += 1) {
    const url = new URL(cfg.url)
    url.searchParams.set('limit', String(limitPerPage))
    url.searchParams.set('page', String(page))
    if (campanha) url.searchParams.set('campanha', campanha)
    if (titulo) url.searchParams.set('titulo', titulo)

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-API-Key': cfg.apiKey,
      },
      cache: 'no-store',
      signal: opts?.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `Fluxo campanhas HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      )
    }

    const payload = (await res.json()) as FluxoCampanhasResponse
    const chunk = Array.isArray(payload.data) ? payload.data : []
    rows.push(...chunk)

    total = Number(payload.pagination?.total) || total || rows.length
    totalPages = Number(payload.pagination?.totalPages) || 1

    if (chunk.length === 0) break
  }

  return { rows, total }
}
