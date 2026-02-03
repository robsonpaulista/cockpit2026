'use client'

import { useState, useMemo } from 'react'
import { Search, Loader2, FileText, ExternalLink } from 'lucide-react'

const SEI_PESQUISA_BASE = 'https://sei.pi.gov.br/sei/modulos/pesquisa/'

type ResultadoItem = {
  protocolo: string
  titulo: string
  snippet: string
  unidade: string
  data: string
  url: string
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseResultadoXml(xml: string): { itens: number; resultados: ResultadoItem[] } | null {
  const matchResultado = xml.match(/<resultado\s+itens="(\d+)"[^>]*>([\s\S]*?)<\/resultado>/i)
  if (!matchResultado) return null
  const itens = parseInt(matchResultado[1], 10)
  const inner = matchResultado[2]
  const resultados: ResultadoItem[] = []
  const partes = inner.split(/<tr\s+class="pesquisaTituloRegistro"/i)
  for (let i = 1; i < partes.length; i++) {
    const bloco = partes[i]
    const protocoloMatch = bloco.match(/class="protocoloNormal[^"]*"[^>]*>([^<]+)</)
    const protocolo = protocoloMatch ? protocoloMatch[1].trim() : ''
    const tituloTr = bloco.slice(0, bloco.indexOf('</tr>'))
    const titulo = stripHtml(tituloTr).slice(0, 150)
    const hrefMatch = tituloTr.match(/href=["']([^"']*md_pesq_[^"']+)["']/i)
    const urlRel = hrefMatch ? hrefMatch[1].trim() : ''
    const url = urlRel ? (urlRel.startsWith('http') ? urlRel : SEI_PESQUISA_BASE + urlRel.replace(/^\.?\//, '')) : ''
    const snippetMatch = bloco.match(/class="resSnippet"[^>]*>([\s\S]*?)<\/td>/i)
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]).slice(0, 300) : ''
    const unidadeMatch = bloco.match(/<b>Unidade:<\/b>\s*([\s\S]*?)<\/td>/i)
    const unidade = unidadeMatch ? stripHtml(unidadeMatch[1]) : ''
    const dataMatch = bloco.match(/<b>Data:<\/b>\s*([^<]+)/i)
    const data = dataMatch ? dataMatch[1].trim() : ''
    resultados.push({ protocolo, titulo, snippet, unidade, data, url })
  }
  return { itens, resultados }
}

export default function SeiPesquisaPage() {
  const [q, setQ] = useState('"CONTRATO 37/2025" e "AMARANTE - PI"')
  const [txtProtocoloPesquisa, setTxtProtocoloPesquisa] = useState('')
  const [chkSinProcessos, setChkSinProcessos] = useState(true)
  const [chkSinDocumentosGerados, setChkSinDocumentosGerados] = useState(false)
  const [chkSinDocumentosRecebidos, setChkSinDocumentosRecebidos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)

  const parsed = useMemo(() => (response ? parseResultadoXml(response) : null), [response])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResponse(null)
    setLoading(true)
    try {
      const res = await fetch('/api/sei-pesquisa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: q || undefined,
          txtProtocoloPesquisa: txtProtocoloPesquisa || undefined,
          chkSinProcessos,
          chkSinDocumentosGerados,
          chkSinDocumentosRecebidos,
          inicio: 0,
          rowsSolr: 50,
        }),
      })
      const text = await res.text()
      if (!res.ok) {
        let errMsg = text
        try {
          const j = JSON.parse(text)
          errMsg = j.error || j.details || text
        } catch {
          // use text
        }
        setError(errMsg)
        return
      }
      setResponse(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-6 h-6 text-accent-gold" />
        <h1 className="text-xl font-semibold text-text-primary">Pesquisa SEI (teste)</h1>
      </div>
      <p className="text-sm text-text-secondary mb-6">
        Reproduz o payload da Pesquisa Pública do SEI para comparar o resultado com a consulta
        original. Mesma URL e Form Data (q, checkboxes).
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            Texto para pesquisa (q)
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border-card bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-accent-gold/30 focus:border-accent-gold"
            placeholder='"CONTRATO 37/2025" e "AMARANTE - PI"'
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">
            N° SEI (protocolo) — opcional
          </label>
          <input
            type="text"
            value={txtProtocoloPesquisa}
            onChange={(e) => setTxtProtocoloPesquisa(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border-card bg-bg-surface text-text-primary"
            placeholder="Ex.: 00317.001208/2025-49"
          />
        </div>
        <div>
          <span className="block text-sm font-medium text-text-primary mb-2">Pesquisar em</span>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chkSinProcessos}
                onChange={(e) => setChkSinProcessos(e.target.checked)}
                className="rounded border-border-card text-accent-gold focus:ring-accent-gold"
              />
              <span className="text-sm text-text-primary">Processos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chkSinDocumentosGerados}
                onChange={(e) => setChkSinDocumentosGerados(e.target.checked)}
                className="rounded border-border-card text-accent-gold focus:ring-accent-gold"
              />
              <span className="text-sm text-text-primary">Documentos Gerados</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={chkSinDocumentosRecebidos}
                onChange={(e) => setChkSinDocumentosRecebidos(e.target.checked)}
                className="rounded border-border-card text-accent-gold focus:ring-accent-gold"
              />
              <span className="text-sm text-text-primary">Documentos Recebidos</span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-gold text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? 'Consultando SEI...' : 'Pesquisar'}
        </button>
      </form>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 text-sm">
          {error}
        </div>
      )}

      {response && (
        <div className="space-y-6">
          {parsed && parsed.resultados.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-text-primary mb-2">
                Resultados ({parsed.itens} {parsed.itens === 1 ? 'item' : 'itens'})
              </h2>
              <ul className="space-y-4">
                {parsed.resultados.map((r, i) => (
                  <li
                    key={i}
                    className="p-4 rounded-lg bg-bg-surface border border-border-card text-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-mono font-medium text-accent-gold">{r.protocolo}</span>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-gold hover:underline shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Acessar no SEI
                        </a>
                      )}
                    </div>
                    {r.titulo && (
                      <div className="text-text-primary mb-1 line-clamp-2">{r.titulo}</div>
                    )}
                    {r.snippet && (
                      <div className="text-text-secondary text-xs mb-2">{r.snippet}</div>
                    )}
                    <div className="flex flex-wrap gap-4 text-xs text-text-muted">
                      {r.unidade && <span>Unidade: {r.unidade}</span>}
                      {r.data && <span>Data: {r.data}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-sm text-accent-gold hover:underline mb-2"
            >
              {showRaw ? 'Ocultar' : 'Mostrar'} XML bruto
            </button>
            {showRaw && (
              <pre className="p-4 rounded-lg bg-bg-surface border border-border-card text-xs text-text-primary overflow-x-auto overflow-y-auto max-h-[60vh] whitespace-pre-wrap break-all">
                {response}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
