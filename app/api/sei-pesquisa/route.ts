import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SEI_PESQUISA_URL =
  'https://sei.pi.gov.br/sei/modulos/pesquisa/md_pesq_controlador_ajax_externo.php'

/** User-Agent de navegador para evitar bloqueio */
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/xml, text/xml, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-1',
}

/**
 * POST — Reproduz a pesquisa pública do SEI (Pesquisa Pública).
 * Body: { q?, txtProtocoloPesquisa?, chkSinProcessos?, chkSinDocumentosGerados?, chkSinDocumentosRecebidos?, inicio?, rowsSolr? }
 * Retorna o XML/resposta bruta do SEI para comparação com a consulta original.
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
    const q = typeof body.q === 'string' ? body.q.trim() : ''
    const txtProtocoloPesquisa = typeof body.txtProtocoloPesquisa === 'string' ? body.txtProtocoloPesquisa.trim() : ''
    const chkSinProcessos = body.chkSinProcessos ? 'P' : ''
    const chkSinDocumentosGerados = body.chkSinDocumentosGerados ? 'P' : ''
    const chkSinDocumentosRecebidos = body.chkSinDocumentosRecebidos ? 'P' : ''
    const inicio = typeof body.inicio === 'number' ? body.inicio : 0
    const rowsSolr = typeof body.rowsSolr === 'number' ? body.rowsSolr : 50

    if (!q && !txtProtocoloPesquisa) {
      return NextResponse.json(
        { error: 'Informe os termos de pesquisa (q) ou o número do protocolo (txtProtocoloPesquisa).' },
        { status: 400 }
      )
    }

    if (!chkSinProcessos && !chkSinDocumentosGerados && !chkSinDocumentosRecebidos) {
      return NextResponse.json(
        { error: 'Selecione pelo menos uma opção: Processos, Documentos Gerados ou Documentos Recebidos.' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams()
    params.set('acao_ajax_externo', 'protocolo_pesquisar')
    params.set('id_orgao_acesso_externo', '0')
    params.set('isPaginacao', 'false')
    params.set('inicio', String(inicio))
    params.set('rowsSolr', String(rowsSolr))

    const form = new URLSearchParams()
    if (txtProtocoloPesquisa) form.set('txtProtocoloPesquisa', txtProtocoloPesquisa)
    if (q) form.set('q', q)
    if (chkSinProcessos) form.set('chkSinProcessos', chkSinProcessos)
    if (chkSinDocumentosGerados) form.set('chkSinDocumentosGerados', chkSinDocumentosGerados)
    if (chkSinDocumentosRecebidos) form.set('chkSinDocumentosRecebidos', chkSinDocumentosRecebidos)

    const url = `${SEI_PESQUISA_URL}?${params.toString()}`
    const res = await fetch(url, {
      method: 'POST',
      headers: BROWSER_HEADERS,
      body: form.toString(),
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    })

    const contentType = res.headers.get('content-type') || ''
    const buf = await res.arrayBuffer()
    const decoder = new TextDecoder('iso-8859-1')
    const text = decoder.decode(buf)

    if (!res.ok) {
      return NextResponse.json(
        { error: `SEI retornou ${res.status}`, body: text.slice(0, 2000) },
        { status: 502 }
      )
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': contentType.includes('xml') ? contentType : 'text/plain; charset=utf-8',
      },
    })
  } catch (error: unknown) {
    console.error('Erro ao consultar SEI:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao consultar SEI' },
      { status: 500 }
    )
  }
}
