/**
 * Cliente do Diário Oficial do Piauí (busca avançada + resumo da nota).
 * Fonte: https://www.diario.pi.gov.br/doe/busca
 */

const DOE_BASE = 'https://www.diario.pi.gov.br/doe'
const DOE_BUSCA_URL = `${DOE_BASE}/Api/buscaavancada.json`
const DOE_NOTA_URL = `${DOE_BASE}/Api/visualizarnota.json`

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export type DoeBuscaHit = {
  dadosDiario: string
  nota: string
  anexodiario: string
  acertos: string
}

export type DoeBuscaResult = {
  palavraschave: string[]
  hits: DoeBuscaHit[]
}

export type DoeResumoResult = {
  uuid: string
  titulo: string | null
  dia: string | null
  textoHtml: string
  textoPlain: string
  pdfUrl: string | null
  edicaoLabel: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ordm;/gi, 'º')
    .replace(/&deg;/gi, '°')
    .replace(/&sup2;/gi, '²')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#?\w+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

async function doePostForm(url: string, body: Record<string, string>): Promise<unknown> {
  const form = new URLSearchParams(body)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Origin: 'https://www.diario.pi.gov.br',
      Referer: `${DOE_BASE}/busca`,
      'User-Agent': BROWSER_USER_AGENT,
    },
    body: form.toString(),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`DOE HTTP ${res.status}`)
  }
  const text = await res.text()
  if (!text || text === 'null') return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Resposta inválida do Diário Oficial')
  }
}

/** Busca no DOE por palavras-chave (ex.: número SEI). */
export async function buscarDoePorSei(sei: string): Promise<DoeBuscaResult> {
  const filter = sei.trim()
  if (!filter) return { palavraschave: [], hits: [] }

  const raw = (await doePostForm(DOE_BUSCA_URL, { filter_texto: filter })) as {
    resposta?: DoeBuscaHit[] | null
    palavraschave?: string[] | null
  } | null

  const hits = Array.isArray(raw?.resposta) ? raw.resposta : []
  const palavraschave = Array.isArray(raw?.palavraschave) ? raw.palavraschave : []
  return { palavraschave, hits }
}

/** Carrega o HTML/resumo de uma nota do DOE pelo uuid. */
export async function visualizarNotaDoe(uuid: string): Promise<DoeResumoResult | null> {
  const id = uuid.trim()
  if (!id) return null

  const raw = (await doePostForm(DOE_NOTA_URL, { uuid: id })) as {
    nota?: {
      uuid?: string
      dia?: string
      texto?: string
      titulo_nota?: { texto?: string } | null
      diarios?: Array<{
        numero?: number
        dia?: string
        anexo?: string
        anexo_dir?: string
      }> | null
    } | null
  } | null

  const nota = raw?.nota
  if (!nota?.uuid) return null

  const diario = Array.isArray(nota.diarios) ? nota.diarios[0] : null
  const pdfUrl =
    diario?.anexo_dir && diario?.anexo
      ? `${DOE_BASE}/files/diarios/anexo/${diario.anexo_dir}/${diario.anexo}`
      : null

  const edicaoLabel =
    diario?.numero != null && diario?.dia
      ? `Edição Nº ${diario.numero} de ${diario.dia}`
      : null

  const textoHtml = decodeHtmlEntities(nota.texto ?? '')
  return {
    uuid: nota.uuid,
    titulo: nota.titulo_nota?.texto?.trim() || null,
    dia: nota.dia ?? null,
    textoHtml,
    textoPlain: stripHtml(textoHtml),
    pdfUrl,
    edicaoLabel,
  }
}

export type DoeRegistro = {
  edicao: string
  titulo: string | null
  dia: string | null
  resumo: string
  resumoHtml: string | null
  pdfUrl: string | null
  notaUuid: string
}

export type DoeConsultaCompleta = {
  sei: string
  encontrados: number
  palavraschave: string[]
  /** Lista completa: um item por ocorrência (cada "resumo" do DOE). */
  registros: DoeRegistro[]
  /** Resumo concatenado para exibição rápida. */
  edicao: string | null
  resumo: string | null
  resumoHtml: string | null
  pdfUrl: string | null
  notaUuid: string | null
}

/**
 * Busca o SEI no DOE e carrega o texto do "resumo" (ícone de pasta)
 * de todas as ocorrências — não baixa o PDF da edição.
 */
export async function consultarSeiNoDoe(sei: string): Promise<DoeConsultaCompleta> {
  const busca = await buscarDoePorSei(sei)
  const hits = busca.hits.map((h) => ({
    edicao: stripHtml(h.dadosDiario || ''),
    notaUuid: h.nota,
    pdfPath: h.anexodiario,
  }))

  if (hits.length === 0) {
    return {
      sei,
      encontrados: 0,
      palavraschave: busca.palavraschave,
      registros: [],
      edicao: null,
      resumo: null,
      resumoHtml: null,
      pdfUrl: null,
      notaUuid: null,
    }
  }

  const registros: DoeRegistro[] = []
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]
    const nota = await visualizarNotaDoe(hit.notaUuid)
    const pdfUrl =
      nota?.pdfUrl ??
      (hit.pdfPath ? `${DOE_BASE}/files/diarios/anexo/${hit.pdfPath}` : null)
    const resumo =
      nota?.textoPlain?.trim() ||
      '(Resumo vazio — nota sem texto no DOE)'
    registros.push({
      edicao: nota?.edicaoLabel || hit.edicao || `Registro ${i + 1}`,
      titulo: nota?.titulo ?? null,
      dia: nota?.dia ?? null,
      resumo,
      resumoHtml: nota?.textoHtml || null,
      pdfUrl,
      notaUuid: hit.notaUuid,
    })
    // Pequena pausa entre notas do mesmo SEI
    if (i < hits.length - 1) {
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  const edicao =
    registros.length === 1
      ? registros[0].edicao
      : registros.map((r, idx) => `${idx + 1}) ${r.edicao}`).join(' · ')

  const resumo = registros
    .map((r, idx) => {
      const header =
        registros.length > 1
          ? `—— ${idx + 1}/${registros.length} · ${r.edicao}${r.titulo ? ` · ${r.titulo}` : ''} ——`
          : r.edicao
      return `${header}\n${r.resumo}`
    })
    .join('\n\n')

  const first = registros[0]
  return {
    sei,
    encontrados: registros.length,
    palavraschave: busca.palavraschave,
    registros,
    edicao,
    resumo,
    resumoHtml: first?.resumoHtml ?? null,
    pdfUrl: first?.pdfUrl ?? null,
    notaUuid: first?.notaUuid ?? null,
  }
}
