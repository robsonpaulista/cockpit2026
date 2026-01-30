import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** User-Agent de navegador para reduzir chance de bloqueio em sites governamentais */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Extrai texto de um bloco HTML (remove tags).
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Parse "DD/MM/YYYY HH:mm" (horário local Brasil) para ISO string para TIMESTAMPTZ.
 */
function parseSeiDate(str: string): string | null {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/)
  if (!m) return null
  const [, day, month, year, hour, min] = m
  const d = new Date(
    parseInt(year!, 10),
    parseInt(month!, 10) - 1,
    parseInt(day!, 10),
    parseInt(hour!, 10),
    parseInt(min!, 10)
  )
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Parseia o HTML da página SEI e retorna o último andamento (linha andamento/Aberto).
 * Procura tabela "Histórico de Andamentos" (id tblHistorico ou summary) e tr com class andamentoAberto.
 */
function parseAndamentoAbertoFromHtml(html: string): {
  data: string
  dataIso: string | null
  descricao: string
} | null {
  // Normalizar: collapse espaços e quebras para facilitar regex
  const normalized = html.replace(/\s+/g, ' ')

  // 1) Encontrar a tabela: por id tblHistorico ou por summary "Histórico de Andamentos"
  let tableBlock: string | null = null
  const byId = normalized.match(/<table[^>]*id=["']?tblHistorico["']?[^>]*>([\s\S]*?)<\/table>/i)
  if (byId) {
    tableBlock = byId[1]
  }
  if (!tableBlock) {
    const bySummary = normalized.match(/<table[^>]*summary=["'][^"]*Histórico\s+de\s+Andamentos[^"]*["'][^>]*>([\s\S]*?)<\/table>/i)
    if (bySummary) tableBlock = bySummary[1]
  }
  if (!tableBlock) {
    // Última tentativa: qualquer tabela que contenha "andamentoAberto" no conteúdo
    const anyTableWithAndamento = normalized.match(/<table[^>]*>([\s\S]*?andamentoAberto[\s\S]*?)<\/table>/i)
    if (anyTableWithAndamento) tableBlock = anyTableWithAndamento[1]
  }

  let tbodyContent = tableBlock ?? normalized
  if (tableBlock) {
    const tbodyMatch = tableBlock.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
    if (tbodyMatch) tbodyContent = tbodyMatch[1]
  }

  // Linha com andamentoAberto (várias formas de class)
  const rowPatterns = [
    /<tr[^>]*class="[^"]*andamentoAberto[^"]*"[^>]*>([\s\S]*?)<\/tr>/i,
    /<tr[^>]*class="[^"]*andamento\s*Aberto[^"]*"[^>]*>([\s\S]*?)<\/tr>/i,
    /<tr[^>]*class="[^"]*andamentoAberto[^"]*"[^>]*>([\s\S]*?)<\/tr>/i,
  ]
  for (const re of rowPatterns) {
    const rowMatch = tbodyContent.match(re)
    if (rowMatch) {
      const out = extractCellsFromRow(rowMatch[1])
      if (out) return out
    }
  }

  // Fallback: procurar "andamentoAberto" no HTML e extrair o <tr> que a contém
  const idx = html.indexOf('andamentoAberto')
  if (idx !== -1) {
    const startWindow = Math.max(0, idx - 600)
    const before = html.slice(startWindow, idx)
    const trStartInBefore = before.lastIndexOf('<tr')
    if (trStartInBefore !== -1) {
      const trStartAbs = startWindow + trStartInBefore
      const after = html.slice(idx, idx + 3000)
      const trEndInAfter = after.indexOf('</tr>')
      if (trEndInAfter !== -1) {
        const rowHtml = html.slice(trStartAbs, idx + trEndInAfter + 5)
        const rowContentMatch = rowHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i)
        if (rowContentMatch) {
          const out = extractCellsFromRow(rowContentMatch[1])
          if (out) return out
        }
      }
    }
  }
  return null
}

function extractCellsFromRow(rowContent: string): {
  data: string
  dataIso: string | null
  descricao: string
} | null {
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const cells: string[] = []
  let match: RegExpExecArray | null
  while ((match = tdRegex.exec(rowContent)) !== null) {
    cells.push(stripHtml(match[1]))
  }
  if (cells.length === 0) return null
  const data = cells[0] || ''
  const descricao = cells.slice(1).filter(Boolean).join(' | ') || 'Andamento aberto'
  const dataIso = parseSeiDate(data)
  return { data, dataIso, descricao }
}

/**
 * POST { url: string } — Busca a página SEI e retorna o último andamento.
 * POST { updates: { obraId, sei_ultimo_andamento?, sei_ultimo_andamento_data? }[] } — Atualiza andamentos em lote (importação manual).
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const updates = Array.isArray(body.updates) ? body.updates : null

    // ——— Atualização em lote (importação manual) ———
    if (updates && updates.length > 0) {
      let ok = 0
      const errors: string[] = []
      for (const item of updates) {
        const obraId = item?.obraId ?? item?.id
        if (!obraId || typeof obraId !== 'string') {
          errors.push('Item sem obraId')
          continue
        }
        const payload: Record<string, string | null> = {}
        if (item.sei_ultimo_andamento !== undefined) payload.sei_ultimo_andamento = item.sei_ultimo_andamento ?? null
        if (item.sei_ultimo_andamento_data !== undefined) {
          const raw = item.sei_ultimo_andamento_data
          payload.sei_ultimo_andamento_data = (typeof raw === 'string' && raw.trim() ? (parseSeiDate(raw) ?? raw) : raw) ?? null
        }
        if (Object.keys(payload).length === 0) continue
        const { error } = await supabase
          .from('obras')
          .update(payload)
          .eq('id', obraId)
        if (error) errors.push(`${obraId}: ${error.message}`)
        else ok++
      }
      return NextResponse.json({ updated: ok, errors: errors.length ? errors : undefined })
    }

    // ——— Buscar andamento por URL ———
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      return NextResponse.json(
        { error: 'Informe url (para buscar andamento) ou updates (para importação manual)' },
        { status: 400 }
      )
    }

    const fullUrl = url.startsWith('http') ? url : `https://${url}`

    let res: Response
    try {
      res = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': BROWSER_USER_AGENT,
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      })
    } catch (fetchError: unknown) {
      const msg = fetchError instanceof Error ? fetchError.message : 'Erro ao acessar a URL'
      return NextResponse.json(
        {
          error: 'Não foi possível acessar a página do SEI. O site pode estar bloqueando acesso automático.',
          details: msg,
          manualHint: 'Use a extração manual: abra o link no navegador, F12 > Console, cole o script de extração e importe o JSON na tela de Obras.',
        },
        { status: 502 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `O site retornou status ${res.status}. Acesso automático pode estar bloqueado.`,
          manualHint: 'Use a extração manual (abrir link no navegador, extrair com script no Console e importar na tela de Obras).',
        },
        { status: 502 }
      )
    }

    const html = await res.text()
    const parsed = parseAndamentoAbertoFromHtml(html)

    if (!parsed) {
      // 200 com found: false para o cliente não interpretar como "rota não existe"
      return NextResponse.json({
        found: false,
        error: 'Não foi possível encontrar o andamento aberto na página (tabela Histórico de Andamentos). A página pode ser carregada por JavaScript ou a estrutura do SEI mudou.',
      })
    }

    return NextResponse.json({
      found: true,
      data: parsed.data,
      dataIso: parsed.dataIso,
      descricao: parsed.descricao,
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar andamento SEI:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro interno ao processar página SEI',
      },
      { status: 500 }
    )
  }
}
