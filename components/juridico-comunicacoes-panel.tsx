'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, Loader2, RefreshCw } from 'lucide-react'
import { fetchJuridicoComunicacoes } from '@/lib/services/juridico-processos'
import type { ComunicacaoProcessual, ComunicacoesProcessoResponse } from '@/lib/juridico-comunica'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { cn } from '@/lib/utils'

function formatDataComunica(iso: string, fallback: string | null): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }
  return fallback ?? iso ?? '—'
}

function ComunicacaoCard({ item }: { item: ComunicacaoProcessual }) {
  const isIntimacao = /intima/i.test(item.tipoComunicacao)
  return (
    <li
      className={cn(
        'rounded-lg border px-3 py-3 text-sm',
        isIntimacao ? 'border-amber-500/40 bg-amber-500/5' : 'border-border-card bg-bg-app/50'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-primary">
            {item.tipoComunicacao}
            {item.tipoDocumento ? (
              <span className="font-normal text-text-secondary"> · {item.tipoDocumento}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {formatDataComunica(item.dataDisponibilizacao, null)} · {item.nomeOrgao}
            {item.meioCompleto ? ` · ${item.meioCompleto}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <a
            href={item.certidaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-xs text-accent-gold hover:bg-bg-app"
            title="PDF com texto da comunicação (substitui inteiro teor + certidão)"
          >
            <FileText className="h-3.5 w-3.5" />
            Certidão PDF
          </a>
          {item.linkPjeDocumento ? (
            <a
              href={item.linkPjeDocumento}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border-card px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
              title="Documento no PJe (validação de assinatura)"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              PJe
            </a>
          ) : null}
        </div>
      </div>
      {item.nomeClasse ? (
        <p className="mt-2 text-xs text-text-secondary">Classe: {item.nomeClasse}</p>
      ) : null}
      {item.textoResumo ? (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
          {item.textoResumo}
        </p>
      ) : null}
      {item.destinatarios.length > 0 ? (
        <p className="mt-2 text-xs text-text-secondary">
          Parte(s): {item.destinatarios.join('; ')}
        </p>
      ) : null}
      {item.advogados.length > 0 ? (
        <p className="text-xs text-text-secondary">Advogado(s): {item.advogados.join('; ')}</p>
      ) : null}
    </li>
  )
}

export function JuridicoComunicacoesPanel({ processo }: { processo: ProcessoDimensao }) {
  const [data, setData] = useState<ComunicacoesProcessoResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchJuridicoComunicacoes(processo.id)
      setData(res)
    } catch {
      setData({
        ok: false,
        count: 0,
        consultaComunicaUrl: null,
        comunicacoes: [],
        aviso: 'Erro ao carregar comunicações do DJEN.',
      })
    } finally {
      setLoading(false)
    }
  }, [processo.id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="mt-4 space-y-3 border-t border-border-card pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Comunicações DJEN (Comunica CNJ)
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {data?.consultaComunicaUrl ? (
            <a
              href={data.consultaComunicaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-card px-2.5 py-1.5 text-xs text-text-secondary hover:text-accent-gold"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Portal Comunica
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-border-card px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Atualizar
          </button>
        </div>
      </div>

      <p className="text-[10px] text-text-secondary">
        Automatizado via API pública{' '}
        <code className="rounded bg-black/10 px-1">comunicaapi.pje.jus.br</code> — sem login. A certidão
        PDF substitui o fluxo manual (portal → inteiro teor → ícone PJe).
      </p>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-3 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
          Buscando comunicações no DJEN…
        </div>
      ) : null}

      {data?.aviso ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          {data.aviso}
        </p>
      ) : null}

      {data && data.comunicacoes.length > 0 ? (
        <>
          <p className="text-xs text-text-secondary">
            {data.count} comunicação(ões) nos últimos 6 anos
          </p>
          <ul className="space-y-2">
            {data.comunicacoes.map((c) => (
              <ComunicacaoCard key={c.hash} item={c} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
