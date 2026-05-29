'use client'

import type { ReactNode } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { cn, formatDateShort } from '@/lib/utils'
import type { PropostaFns } from '@/lib/fns-tetos-saldo'
import { URL_CONSULTA_FNS } from '@/lib/fns-proposta-normalize'

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function DetalheLinha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary min-w-0 break-words">{children}</span>
    </div>
  )
}

export function FichaAtendimentoPropostaDetalhe({
  open,
  proposta,
  origem,
  onClose,
}: {
  open: boolean
  proposta: PropostaFns | null
  origem: 'FNS' | 'SUAS'
  onClose: () => void
}) {
  if (!open || !proposta) return null

  const urlFns = proposta.urlConsultaFns ?? URL_CONSULTA_FNS

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposta-detalhe-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-card bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-card px-5 py-4">
          <div className="min-w-0">
            <h2 id="proposta-detalhe-title" className="text-base font-semibold text-text-primary">
              Detalhes da proposta
            </h2>
            <p className="text-xs text-text-secondary mt-0.5 truncate" title={proposta.nuProposta}>
              {proposta.nuProposta}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <DetalheLinha label="Origem">{origem}</DetalheLinha>
          <DetalheLinha label="Exercício">{proposta.exercicio ?? '—'}</DetalheLinha>
          <DetalheLinha label="Município">{proposta.municipio}</DetalheLinha>
          <DetalheLinha label="Tipo">{proposta.coTipoProposta || '—'}</DetalheLinha>
          <DetalheLinha label="Recurso">{proposta.dsTipoRecurso || '—'}</DetalheLinha>
          <DetalheLinha label="Situação">{proposta.dsSituacaoProposta || '—'}</DetalheLinha>
          {origem === 'FNS' && proposta.nuProcesso && proposta.nuProcesso !== 'N/A' ? (
            <DetalheLinha label="Processo">{proposta.nuProcesso}</DetalheLinha>
          ) : null}
          {proposta.nmPrograma ? (
            <DetalheLinha label="Programa">{proposta.nmPrograma}</DetalheLinha>
          ) : null}
          {proposta.acao ? <DetalheLinha label="Ação">{proposta.acao}</DetalheLinha> : null}
          <DetalheLinha label="Valor proposta">{formatMoney(proposta.vlProposta)}</DetalheLinha>
          <DetalheLinha label="A pagar">{formatMoney(proposta.vlPagar)}</DetalheLinha>
          {origem === 'FNS' && proposta.vlPago != null ? (
            <DetalheLinha label="Pago">{formatMoney(proposta.vlPago)}</DetalheLinha>
          ) : null}
          <DetalheLinha label="Data">
            {proposta.dtCadastramento ? formatDateShort(proposta.dtCadastramento) : '—'}
          </DetalheLinha>

          {origem === 'FNS' && proposta.parlamentares && proposta.parlamentares.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">Parlamentares</p>
              <ul className="list-disc pl-4 text-sm text-text-primary space-y-0.5">
                {proposta.parlamentares.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {origem === 'FNS' && proposta.pagamentos && proposta.pagamentos.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">Pagamentos</p>
              <pre className="rounded-lg border border-card bg-background/60 p-2 text-[11px] overflow-x-auto">
                {JSON.stringify(proposta.pagamentos, null, 2)}
              </pre>
            </div>
          ) : null}

          {origem === 'FNS' && proposta.linhaPropostas && proposta.linhaPropostas.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-1">Linhas da proposta</p>
              <pre className="rounded-lg border border-card bg-background/60 p-2 text-[11px] overflow-x-auto">
                {JSON.stringify(proposta.linhaPropostas, null, 2)}
              </pre>
            </div>
          ) : null}

          {origem === 'FNS' ? (
            <p className="text-[11px] text-text-secondary pt-1">
              A API pública do FNS não expõe link direto por registro. Use o portal oficial para
              consultar com município e tipo de recurso.
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-card px-5 py-4">
          {origem === 'FNS' ? (
            <a
              href={urlFns}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border border-card px-4 py-2 text-sm font-medium',
                'text-accent-gold hover:bg-background',
              )}
            >
              <ExternalLink className="h-4 w-4" />
              Abrir Consulta FNS
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-background/80"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
