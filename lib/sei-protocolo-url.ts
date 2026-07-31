/**
 * Resolve número SEI → URL pública md_pesq_processo_exibir.php?<token>
 *
 * Usa a mesma Pesquisa Pública do SEI (AJAX isPaginacao=true + campo q),
 * sem captcha. Em seguida o Andamentos SEI abre esse link direto.
 */

export const SEI_EXIBIR_BASE =
  'https://sei.pi.gov.br/sei/modulos/pesquisa/md_pesq_processo_exibir.php'
export const SEI_PESQUISA_PUBLICA_URL =
  'https://sei.pi.gov.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0'
const SEI_PESQUISA_PAGE = SEI_PESQUISA_PUBLICA_URL
const SEI_PESQUISA_AJAX =
  'https://sei.pi.gov.br/sei/modulos/pesquisa/md_pesq_controlador_ajax_externo.php'
const SEI_PESQUISA_DIR = 'https://sei.pi.gov.br/sei/modulos/pesquisa/'

/**
 * Href clicável para o processo SEI.
 * Prefere o link md_pesq_processo_exibir; senão cai na Pesquisa Pública.
 */
export function hrefSeiProcesso(
  sei: string | null | undefined,
  seiUrl?: string | null,
): string | null {
  const url = (seiUrl ?? '').trim()
  if (url) {
    const normalized = normalizeSeiExibirUrl(url)
    if (normalized) return normalized
    if (/^https?:\/\//i.test(url)) return url
  }
  const protocolo = normalizeSeiProtocolo(sei ?? '')
  if (!protocolo) return null
  return SEI_PESQUISA_PUBLICA_URL
}

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
}

/** Cache curto de sessão da Pesquisa Pública (cookie + órgãos). */
let cachedSession: {
  cookie: string
  orgaos: string[]
  expiresAt: number
} | null = null

export function normalizeSeiProtocolo(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/^n[ºo°]\.?\s*/i, '')
}

export function isSeiExibirUrl(url: string): boolean {
  return /md_pesq_processo_exibir\.php\?/i.test(url.trim())
}

export function normalizeSeiExibirUrl(raw: string): string | null {
  let url = raw.trim()
  if (!url) return null
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  try {
    const parsed = new URL(url)
    if (/md_pesq_processo_exibir\.php$/i.test(parsed.pathname) && parsed.search) {
      return `${SEI_EXIBIR_BASE}${parsed.search}`
    }
    if (isSeiExibirUrl(url)) return url
    return null
  } catch {
    return null
  }
}

function absoluteExibirUrl(href: string): string {
  const h = href.trim()
  if (h.startsWith('http')) return h
  return SEI_PESQUISA_DIR + h.replace(/^\.?\//, '')
}

/** Extrai o link exibir do HTML de resultados, preferindo match exato do protocolo. */
export function extractSeiExibirUrlFromHtml(
  html: string,
  protocoloAlvo?: string,
): string | null {
  const alvo = protocoloAlvo ? normalizeSeiProtocolo(protocoloAlvo) : ''
  const partes = html.split(/<tr\s+class="pesquisaTituloRegistro"/i)
  let fallback: string | null = null

  for (let i = 1; i < partes.length; i++) {
    const bloco = partes[i]
    const tituloTr = bloco.slice(0, bloco.indexOf('</tr>') >= 0 ? bloco.indexOf('</tr>') : 800)
    const protocoloMatch = bloco.match(/class="protocoloNormal[^"]*"[^>]*>([^<]+)</)
    const protocolo = protocoloMatch
      ? normalizeSeiProtocolo(protocoloMatch[1])
      : ''
    const hrefMatch = tituloTr.match(
      /href=["']([^"']*md_pesq_processo_exibir\.php\?[^"']+)["']/i,
    )
    if (!hrefMatch) continue
    const url = absoluteExibirUrl(hrefMatch[1])
    if (!fallback) fallback = url
    if (alvo && protocolo && protocolo === alvo) return url
    if (alvo && normalizeSeiProtocolo(tituloTr.replace(/<[^>]+>/g, ' ')).includes(alvo)) {
      return url
    }
  }
  return alvo ? null : fallback
}

async function getPesquisaSession(): Promise<{ cookie: string; orgaos: string[] }> {
  const now = Date.now()
  if (cachedSession && cachedSession.expiresAt > now) {
    return { cookie: cachedSession.cookie, orgaos: cachedSession.orgaos }
  }

  const res = await fetch(SEI_PESQUISA_PAGE, {
    method: 'GET',
    headers: {
      ...BROWSER_HEADERS,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  })
  const html = await res.text()
  const setCookie = res.headers.getSetCookie?.() ?? []
  const cookie =
    setCookie.map((c) => c.split(';')[0]).join('; ') ||
    (res.headers.get('set-cookie') ?? '').split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ')

  const orgaos = [...html.matchAll(/<option value="(\d+)" selected/gi)].map(
    (m) => m[1],
  )

  cachedSession = {
    cookie,
    orgaos,
    expiresAt: now + 5 * 60 * 1000,
  }
  return { cookie, orgaos }
}

/**
 * Consulta a Pesquisa Pública (q + isPaginacao=true) e devolve o link exibir.
 */
export async function resolveSeiPublicUrlFromProtocolo(
  protocolo: string,
  opts?: { url?: string | null },
): Promise<{ url: string | null; error?: string }> {
  const fromOpts = opts?.url?.trim()
  if (fromOpts) {
    const normalized =
      normalizeSeiExibirUrl(fromOpts) ||
      (fromOpts.startsWith('http') ? fromOpts : `https://${fromOpts}`)
    if (isSeiExibirUrl(normalized) || /sei\.pi\.gov\.br/i.test(normalized)) {
      return { url: normalized }
    }
  }

  const txt = normalizeSeiProtocolo(protocolo)
  if (!txt) return { url: null, error: 'Protocolo SEI vazio' }

  try {
    const { cookie, orgaos } = await getPesquisaSession()

    const params = new URLSearchParams()
    params.set('acao_ajax_externo', 'protocolo_pesquisar')
    params.set('id_orgao_acesso_externo', '0')
    // isPaginacao=true é o modo que a página usa; false retorna "Identificação não informada"
    params.set('isPaginacao', 'true')
    params.set('inicio', '0')
    params.set('rowsSolr', '50')

    const form = new URLSearchParams()
    form.set('q', txt)
    form.set('txtProtocoloPesquisa', txt)
    form.set('chkSinProcessos', 'P')
    form.set('hdnFlagPesquisa', '1')
    form.set('hdnInfraCaptcha', '0')
    form.set('txtInfraCaptcha', '')
    for (const id of orgaos) {
      form.append('selOrgaoPesquisa[]', id)
    }

    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      Accept: 'application/json, application/xml, text/xml, */*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=ISO-8859-1',
      Referer: SEI_PESQUISA_PAGE,
      Origin: 'https://sei.pi.gov.br',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (cookie) headers.Cookie = cookie

    const res = await fetch(`${SEI_PESQUISA_AJAX}?${params.toString()}`, {
      method: 'POST',
      headers,
      body: form.toString(),
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    })

    const buf = await res.arrayBuffer()
    const text = new TextDecoder('iso-8859-1').decode(buf)
    if (!res.ok) {
      return { url: null, error: `SEI pesquisa retornou ${res.status}` }
    }

    let html = text
    try {
      const parsed = JSON.parse(text) as { html?: string; itens?: number }
      if (typeof parsed.html === 'string') html = parsed.html
    } catch {
      // resposta XML/HTML pura
    }

    if (/Identifica[cç][aã]o n[aã]o informada/i.test(text)) {
      cachedSession = null
      return {
        url: null,
        error: 'Sessão SEI inválida (Identificação não informada). Tente de novo.',
      }
    }

    const url = extractSeiExibirUrlFromHtml(html, txt)
    if (!url) {
      return {
        url: null,
        error: `Protocolo ${txt} não encontrado na Pesquisa Pública do SEI`,
      }
    }
    return { url }
  } catch (e) {
    cachedSession = null
    return {
      url: null,
      error:
        e instanceof Error ? e.message : 'Erro ao consultar Pesquisa Pública SEI',
    }
  }
}
