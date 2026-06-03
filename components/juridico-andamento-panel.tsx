'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { fetchJuridicoAndamento } from '@/lib/services/juridico-processos'
import type { AndamentoPublicoResponse, MovimentoPublico } from '@/lib/juridico-datajud'
import { formatDatajudTimestamp } from '@/lib/juridico-datajud'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { getConsultaLinks } from '@/lib/juridico-consulta-publica'
import { JuridicoComunicacoesPanel } from '@/components/juridico-comunicacoes-panel'
import { cn } from '@/lib/utils'

function formatMovData(dataHora: string | null): string {
  if (!dataHora) return '—'
  return formatDatajudTimestamp(dataHora) ?? dataHora
}

function ListaMovimentos({
  titulo,
  itens,
  destaquePrazo,
}: {
  titulo: string
  itens: MovimentoPublico[]
  destaquePrazo?: boolean
}) {
  if (itens.length === 0) return null
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        {titulo}
      </p>
      <ul className="space-y-2">
        {itens.map((m, i) => (
          <li
            key={`${m.codigo ?? 'm'}-${m.dataHora ?? i}`}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              destaquePrazo || m.possivelPrazo
                ? 'border-amber-500/40 bg-amber-500/5'
                : 'border-border-card bg-bg-app/50'
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-text-primary">{m.nome}</span>
              <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                {formatMovData(m.dataHora)}
              </span>
            </div>
            {m.orgaoJulgador ? (
              <p className="mt-1 text-xs text-text-secondary">{m.orgaoJulgador}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function JuridicoAndamentoPanel({ processo }: { processo: ProcessoDimensao }) {
  const [data, setData] = useState<AndamentoPublicoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJuridicoAndamento(processo.id)
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar andamento')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
  }, [processo.id])

  const links = getConsultaLinks(processo)

  return (
    <div className="mt-4 space-y-4 border-t border-border-card pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Andamento público (Datajud / planilha)
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {links.principal ? (
            <a
              href={links.principal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-card px-2.5 py-1.5 text-xs text-accent-gold hover:bg-bg-app"
              title={links.sistema ?? undefined}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {links.sistema ?? 'Consulta no tribunal'}
            </a>
          ) : null}
          {links.portal ? (
            <a
              href={links.portal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-card px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-app hover:text-text-primary"
            >
              Portal do tribunal
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

      {loading && !data ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
          Consultando base nacional (Datajud)…
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {(links.aviso || data?.aviso) ? (
        <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {[links.aviso, data?.aviso].filter(Boolean).join(' ')}
        </p>
      ) : null}

      {data && !loading ? (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
            {data.fonte === 'datajud' ? (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-800 dark:text-emerald-200">
                Fonte: Datajud (CNJ)
              </span>
            ) : (
              <span className="rounded-md border border-border-card px-2 py-0.5">Fonte: planilha</span>
            )}
            {data.classe ? <span>Classe: {data.classe}</span> : null}
            {data.dataAjuizamento ? <span>Ajuizamento: {data.dataAjuizamento}</span> : null}
            {data.dataHoraUltimaAtualizacao ? (
              <span>Atualizado: {data.dataHoraUltimaAtualizacao}</span>
            ) : null}
          </div>

          {data.ultimaMovimentacaoPlanilha ? (
            <div className="rounded-lg border border-border-card bg-bg-app/40 px-3 py-2 text-sm">
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Última mov. (planilha)
              </p>
              <p className="mt-1 text-text-primary">{data.ultimaMovimentacaoPlanilha}</p>
            </div>
          ) : null}

          <ListaMovimentos titulo="Possíveis prazos / intimações (Datajud)" itens={data.movimentosPrazo} destaquePrazo />

          <ListaMovimentos titulo="Últimas movimentações (Datajud)" itens={data.movimentos} />

          {data.fonte === 'datajud' && data.movimentos.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma movimentação retornada pelo Datajud.</p>
          ) : null}
        </>
      ) : null}

      <p className="text-[10px] text-text-secondary">
        Andamento e possíveis prazos vêm do Datajud (CNJ). Nos tribunais, digite o número CNJ na consulta
        pública — não use “Entrar” / certificado digital, que exigem conta no jus.br.
      </p>

      <JuridicoComunicacoesPanel processo={processo} />
    </div>
  )
}
