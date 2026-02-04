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
 * Parse DD/MM/YYYY para ISO (apenas data).
 */
function parseSeiDateOnly(str: string): string | null {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, day, month, year] = m
  const pad = (n: string) => n.padStart(2, '0')
  const isoLocal = `${year}-${pad(month)}-${pad(day)}T12:00:00-03:00`
  const d = new Date(isoLocal)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Encontra o bloco completo <table>...</table> contando aninhamento.
 */
function extractTableById(html: string, tableId: string): string | null {
  const re = new RegExp(`<table[^>]*id=["']?${tableId}["']?[^>]*>`, 'i')
  const openMatch = html.match(re)
  if (!openMatch || openMatch.index === undefined) return null
  const contentStart = openMatch.index + openMatch[0].length
  let depth = 1
  let i = contentStart
  const lower = html.toLowerCase()
  while (i < html.length) {
    const nextOpen = lower.indexOf('<table', i)
    const nextClose = lower.indexOf('</table>', i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 6
      continue
    }
    depth--
    if (depth === 0) return html.slice(contentStart, nextClose)
    i = nextClose + 8
  }
  return null
}

/**
 * Encontra tabela pelo texto do caption ou summary (ex: "Lista de Protocolos", "Lista de Documentos").
 */
function extractTableByCaptionOrSummary(html: string, ...keywords: string[]): string | null {
  const lower = html.toLowerCase()
  for (const kw of keywords) {
    let needle = lower.indexOf(kw.toLowerCase())
    while (needle !== -1) {
      const before = html.slice(Math.max(0, needle - 2000), needle)
      const tableOpen = before.lastIndexOf('<table')
      if (tableOpen !== -1) {
        const absStart = Math.max(0, needle - 2000) + tableOpen
        const contentStart = html.indexOf('>', absStart) + 1
        let depth = 1
        let i = contentStart
        while (i < html.length) {
          const nextOpen = lower.indexOf('<table', i)
          const nextClose = lower.indexOf('</table>', i)
          if (nextClose === -1) break
          if (nextOpen !== -1 && nextOpen < nextClose) {
            depth++
            i = nextOpen + 6
            continue
          }
          depth--
          if (depth === 0) return html.slice(contentStart, nextClose)
          i = nextClose + 8
        }
      }
      needle = lower.indexOf(kw.toLowerCase(), needle + 1)
    }
  }
  return null
}

/**
 * Extrai o último tr (infraTrClara ou infraTrEscura) da tabela tblDocumentos (Lista de Protocolos).
 * Retorna o texto do status (ex: "SEFAZ: Autorização de Reserva Orçamentária") e a data.
 */
function parseUltimoStatusTblDocumentos(html: string): {
  sei_ultimo_status: string | null
  sei_ultimo_status_data: string | null
} {
  let tableContent = extractTableById(html, 'tblDocumentos')
  if (!tableContent) {
    tableContent = extractTableByCaptionOrSummary(
      html,
      'Lista de Protocolos',
      'Lista de Documentos'
    )
  }
  if (!tableContent) return { sei_ultimo_status: null, sei_ultimo_status_data: null }

  const tbodyStart = tableContent.toLowerCase().indexOf('<tbody')
  const tbodyEnd = tableContent.toLowerCase().indexOf('</tbody>')
  const tbody = tbodyStart !== -1 && tbodyEnd > tbodyStart
    ? tableContent.slice(tableContent.indexOf('>', tbodyStart) + 1, tbodyEnd)
    : tableContent

  // Match <tr> with class containing infraTrClara ou infraTrEscura
  const trClassRe = /<tr[^>]*class=["'][^"']*infraTr(Clara|Escura)[^"']*["'][^>]*>/gi
  const matches: number[] = []
  let m: RegExpExecArray | null
  while ((m = trClassRe.exec(tbody)) !== null) matches.push(m.index)
  let lastTrStart = matches.length > 0 ? matches[matches.length - 1]! : -1

  // Fallback: <tr> com infraTrClara/infraTrEscura em qualquer lugar da tag (ex: outro ordem de atributos)
  if (lastTrStart === -1) {
    const flexRe = /<tr[^>]*infraTr(Clara|Escura)[^>]*>/gi
    const flexMatches: number[] = []
    while ((m = flexRe.exec(tbody)) !== null) flexMatches.push(m.index)
    if (flexMatches.length > 0) lastTrStart = flexMatches[flexMatches.length - 1]!
  }

  let source = tbody
  if (lastTrStart === -1) {
    const fullRe = /<tr[^>]*infraTr(Clara|Escura)[^>]*>/gi
    const fullMatches: number[] = []
    let fm: RegExpExecArray | null
    while ((fm = fullRe.exec(html)) !== null) fullMatches.push(fm.index)
    if (fullMatches.length > 0) {
      source = html
      lastTrStart = fullMatches[fullMatches.length - 1]!
    }
  }
  if (lastTrStart === -1) return { sei_ultimo_status: null, sei_ultimo_status_data: null }

  const fromTr = source.slice(lastTrStart)
  const trTagEnd = fromTr.indexOf('>') + 1
  const rowContent = fromTr.slice(trTagEnd)
  const lowerRow = rowContent.toLowerCase()
  let depth = 1
  let pos = 0
  let endPos = -1
  while (pos < lowerRow.length) {
    const nextTr = lowerRow.indexOf('<tr', pos)
    const nextTrClose = lowerRow.indexOf('</tr>', pos)
    if (nextTrClose === -1) break
    if (nextTr !== -1 && nextTr < nextTrClose) {
      depth++
      pos = nextTr + 3
      continue
    }
    depth--
    if (depth === 0) {
      endPos = nextTrClose
      break
    }
    pos = nextTrClose + 5
  }
  const rowHtml = endPos !== -1 ? rowContent.slice(0, endPos) : rowContent
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
  const cells: string[] = []
  let td: RegExpExecArray | null
  while ((td = tdRegex.exec(rowHtml)) !== null) cells.push(stripHtml(td[1]))

  const dateOnlyPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/
  const isDateCell = (t: string) => dateOnlyPattern.test(t.trim()) || /^\d{1,2}\/\d{1,2}\/\d{4}\s/.test(t.trim())

  // Últ. Status SEI = texto da coluna de status da última linha (qualquer formato). Na Lista de Protocolos a 3ª coluna é o status.
  let status: string | null = (cells[2]?.trim() && !isDateCell(cells[2])) ? cells[2].trim() : null
  if (!status) {
    const nonDate = cells.find((c) => (c?.trim() ?? '') && !isDateCell(c))
    status = nonDate?.trim() ?? null
  }
  // Data: primeira célula no formato DD/MM/YYYY (ex: 02/02/2026)
  let dataStr: string | null = (cells[3]?.trim() && dateOnlyPattern.test(cells[3].trim())) ? cells[3].trim() : null
  if (!dataStr) {
    const found = cells.find((c) => c && dateOnlyPattern.test(c.trim()))
    dataStr = found?.trim() ?? null
  }
  const dataIso = dataStr ? parseSeiDateOnly(dataStr) : null
  return {
    sei_ultimo_status: status || null,
    sei_ultimo_status_data: dataIso ?? dataStr,
  }
}

/**
 * Parse "DD/MM/YYYY HH:mm" (horário Brasília, UTC-3) para ISO string (UTC) para TIMESTAMPTZ.
 * O SEI exibe datas no fuso do Brasil; o servidor (ex. Vercel) roda em UTC.
 * Interpretar explicitamente como UTC-3 evita diferença de 3h na exibição.
 */
function parseSeiDate(str: string): string | null {
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/)
  if (!m) return null
  const [, day, month, year, hour, min] = m
  const pad = (n: string) => n.padStart(2, '0')
  const isoLocal = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${min}:00-03:00`
  const d = new Date(isoLocal)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Extrai data e descrição de uma linha andamentoConcluido. Retorna ts, dataIso e descricao.
 */
function extractConcluidoFromRow(rowContent: string): { ts: number; dataIso: string; descricao: string } | null {
  const out = extractCellsFromRow(rowContent)
  if (!out || !out.dataIso) return null
  const ts = new Date(out.dataIso).getTime()
  return { ts, dataIso: out.dataIso, descricao: out.descricao || 'Andamento concluído' }
}

/**
 * Parseia o HTML da página SEI e retorna o último andamento (linha andamento/Aberto)
 * e verifica se existem andamentoConcluido com data mais recente (caso atípico).
 */
function parseAndamentoAbertoFromHtml(html: string): {
  data: string
  dataIso: string | null
  descricao: string
  alerta_andamento_desatualizado: boolean
  sei_data_mais_recente_concluido: string | null
  sei_descricao_mais_recente_concluido: string | null
  todos_andamentos_concluidos?: boolean
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
    const anyTableWithAndamento = normalized.match(/<table[^>]*>([\s\S]*?andamentoAberto[\s\S]*?)<\/table>/i)
    if (anyTableWithAndamento) tableBlock = anyTableWithAndamento[1]
  }
  if (!tableBlock) {
    const anyTableWithConcluido = normalized.match(/<table[^>]*>([\s\S]*?andamentoConcluido[\s\S]*?)<\/table>/i)
    if (anyTableWithConcluido) tableBlock = anyTableWithConcluido[1]
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
      if (out) {
        const abertoTs = out.dataIso ? new Date(out.dataIso).getTime() : null
        let maisRecente: { ts: number; dataIso: string; descricao: string } | null = null
        if (abertoTs != null) {
          const concluidoRegex = /<tr[^>]*class="[^"]*andamentoConcluido[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
          let m: RegExpExecArray | null
          while ((m = concluidoRegex.exec(tbodyContent)) !== null) {
            const parsed = extractConcluidoFromRow(m[1])
            if (parsed != null && parsed.ts > abertoTs && (maisRecente == null || parsed.ts > maisRecente.ts)) {
              maisRecente = parsed
            }
          }
        }
        const alerta = maisRecente != null
        return {
          ...out,
          alerta_andamento_desatualizado: alerta,
          sei_data_mais_recente_concluido: maisRecente?.dataIso ?? null,
          sei_descricao_mais_recente_concluido: maisRecente?.descricao ?? null,
        }
      }
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
          if (out) {
            const abertoTs = out.dataIso ? new Date(out.dataIso).getTime() : null
            let maisRecente: { ts: number; dataIso: string; descricao: string } | null = null
            if (abertoTs != null) {
              const concluidoRegex = /<tr[^>]*class="[^"]*andamentoConcluido[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
              let m: RegExpExecArray | null
              while ((m = concluidoRegex.exec(tbodyContent)) !== null) {
                const parsed = extractConcluidoFromRow(m[1])
                if (parsed != null && parsed.ts > abertoTs && (maisRecente == null || parsed.ts > maisRecente.ts)) {
                  maisRecente = parsed
                }
              }
            }
            const alerta = maisRecente != null
            return {
              ...out,
              alerta_andamento_desatualizado: alerta,
              sei_data_mais_recente_concluido: maisRecente?.dataIso ?? null,
              sei_descricao_mais_recente_concluido: maisRecente?.descricao ?? null,
            }
          }
        }
      }
    }
  }

  // Fallback: todos os protocolos concluídos — não há andamentoAberto, retorna o mais recente andamentoConcluido
  const concluidoRegex = /<tr[^>]*class="[^"]*andamentoConcluido[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi
  let maisRecente: { ts: number; dataIso: string; descricao: string; data: string } | null = null
  let m: RegExpExecArray | null
  while ((m = concluidoRegex.exec(tbodyContent)) !== null) {
    const parsed = extractConcluidoFromRow(m[1])
    if (parsed != null && (maisRecente == null || parsed.ts > maisRecente.ts)) {
      const cells = extractCellsFromRow(m[1])
      maisRecente = {
        ts: parsed.ts,
        dataIso: parsed.dataIso,
        descricao: parsed.descricao,
        data: cells?.data ?? '',
      }
    }
  }
  if (maisRecente) {
    return {
      data: maisRecente.data,
      dataIso: maisRecente.dataIso,
      descricao: maisRecente.descricao,
      alerta_andamento_desatualizado: false,
      sei_data_mais_recente_concluido: null,
      sei_descricao_mais_recente_concluido: null,
      todos_andamentos_concluidos: true,
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
        const payload: Record<string, string | null | boolean> = {}
        if (item.sei_ultimo_andamento !== undefined) payload.sei_ultimo_andamento = item.sei_ultimo_andamento ?? null
        if (item.sei_alerta_andamento_desatualizado !== undefined) payload.sei_alerta_andamento_desatualizado = Boolean(item.sei_alerta_andamento_desatualizado)
        if (item.sei_data_mais_recente_concluido !== undefined) {
          const raw = item.sei_data_mais_recente_concluido
          payload.sei_data_mais_recente_concluido = (typeof raw === 'string' && raw.trim() ? (parseSeiDate(raw) ?? raw) : raw) ?? null
        }
        if (item.sei_descricao_mais_recente_concluido !== undefined) payload.sei_descricao_mais_recente_concluido = item.sei_descricao_mais_recente_concluido ?? null
        if (item.sei_todos_andamentos_concluidos !== undefined) payload.sei_todos_andamentos_concluidos = Boolean(item.sei_todos_andamentos_concluidos)
        if (item.sei_ultimo_status !== undefined) payload.sei_ultimo_status = item.sei_ultimo_status ?? null
        if (item.sei_ultimo_status_data !== undefined) {
          const raw = item.sei_ultimo_status_data
          payload.sei_ultimo_status_data = (typeof raw === 'string' && raw.trim() ? (parseSeiDateOnly(raw) ?? parseSeiDate(raw) ?? raw) : raw) ?? null
        }
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

    const buf = await res.arrayBuffer()
    let html = new TextDecoder('utf-8').decode(buf)
    let parsed = parseAndamentoAbertoFromHtml(html)
    let ultimoStatus = parseUltimoStatusTblDocumentos(html)
    // Se Últ. Status veio vazio, tentar página em Latin-1 (comum em portais gov).
    if (!ultimoStatus.sei_ultimo_status && !ultimoStatus.sei_ultimo_status_data) {
      const htmlLatin1 = new TextDecoder('iso-8859-1').decode(buf)
      const statusLatin1 = parseUltimoStatusTblDocumentos(htmlLatin1)
      if (statusLatin1.sei_ultimo_status || statusLatin1.sei_ultimo_status_data) {
        ultimoStatus = statusLatin1
        html = htmlLatin1
      }
      if (!parsed && htmlLatin1 !== html) {
        parsed = parseAndamentoAbertoFromHtml(htmlLatin1)
        if (parsed) html = htmlLatin1
      }
    }

    if (!parsed) {
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
      alerta_andamento_desatualizado: parsed.alerta_andamento_desatualizado ?? false,
      sei_data_mais_recente_concluido: parsed.sei_data_mais_recente_concluido ?? null,
      sei_descricao_mais_recente_concluido: parsed.sei_descricao_mais_recente_concluido ?? null,
      todos_andamentos_concluidos: parsed.todos_andamentos_concluidos ?? false,
      sei_ultimo_status: ultimoStatus.sei_ultimo_status ?? null,
      sei_ultimo_status_data: ultimoStatus.sei_ultimo_status_data ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno ao processar página SEI' },
      { status: 500 }
    )
  }
}
