'use client'

import { MapPin, MessageCircle, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  labelAcaoPedidoLog,
  MATERIAL_PEDIDO_STATUS_ANDAMENTO,
  MATERIAL_PEDIDO_STATUS_LABEL,
  nomeUsuarioPedidoLog,
  type CampanhaMaterialPedido,
  type MaterialPedidoStatus,
} from '@/lib/material-campanha/types'

const COLUNAS: Array<{
  status: MaterialPedidoStatus
  cor: string
  chipBg: string
  chipBorder: string
}> = MATERIAL_PEDIDO_STATUS_ANDAMENTO.map((status) => {
  if (status === 'novo') {
    return {
      status,
      cor: '#3b82f6',
      chipBg: 'bg-blue-50 dark:bg-blue-500/15',
      chipBorder: 'border-blue-200/80 dark:border-blue-500/30',
    }
  }
  if (status === 'em_analise') {
    return {
      status,
      cor: '#f59e0b',
      chipBg: 'bg-amber-50 dark:bg-amber-500/15',
      chipBorder: 'border-amber-200/80 dark:border-amber-500/30',
    }
  }
  if (status === 'aprovado') {
    return {
      status,
      cor: '#10b981',
      chipBg: 'bg-emerald-50 dark:bg-emerald-500/15',
      chipBorder: 'border-emerald-200/80 dark:border-emerald-500/30',
    }
  }
  return {
    status,
    cor: '#ff9800',
    chipBg: 'bg-orange-50 dark:bg-orange-500/15',
    chipBorder: 'border-orange-200/80 dark:border-orange-500/30',
  }
})

type Props = {
  pedidos: CampanhaMaterialPedido[]
  saving?: boolean
  onAvancar: (id: string, status: MaterialPedidoStatus) => void
  onRecusar: (id: string) => void
}

function proximoStatus(status: MaterialPedidoStatus): MaterialPedidoStatus | null {
  if (status === 'novo') return 'em_analise'
  if (status === 'em_analise') return 'aprovado'
  if (status === 'aprovado') return 'separado'
  if (status === 'separado') return 'entregue'
  return null
}

function labelAcao(status: MaterialPedidoStatus): string {
  if (status === 'novo') return 'Analisar'
  if (status === 'em_analise') return 'Aprovar'
  if (status === 'aprovado') return 'Separar'
  if (status === 'separado') return 'Entregar'
  return 'Avançar'
}

export function MaterialPedidosKanban({
  pedidos,
  saving,
  onAvancar,
  onRecusar,
}: Props) {
  return (
    <div className="-mx-1 overflow-x-auto pb-2 [scrollbar-width:thin]">
      <div className="flex min-w-[720px] gap-3 px-1">
        {COLUNAS.map((col) => {
          const cards = pedidos.filter((p) => p.status === col.status)
          return (
            <div
              key={col.status}
              className="flex w-[min(100%,280px)] shrink-0 flex-col"
            >
              <div className="mb-2.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold leading-tight text-text-primary',
                    col.chipBg,
                    col.chipBorder
                  )}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: col.cor }}
                    aria-hidden
                  />
                  {MATERIAL_PEDIDO_STATUS_LABEL[col.status]}
                  <span className="ml-0.5 tabular-nums text-text-secondary">
                    {cards.length}
                  </span>
                </span>
              </div>

              <div className="flex min-h-[12rem] flex-1 flex-col gap-2 rounded-xl border border-card/80 bg-black/[0.02] p-2 dark:bg-white/[0.03]">
                {cards.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-text-secondary">
                    Vazio
                  </p>
                ) : (
                  cards.map((p) => {
                    const next = proximoStatus(p.status)
                    const qtdItens = p.itens?.length ?? 0
                    const qtdTotal =
                      p.itens?.reduce((s, it) => s + it.quantidade, 0) ?? 0
                    const ultimoLog =
                      p.logs && p.logs.length > 0
                        ? p.logs.reduce((a, b) =>
                            new Date(a.created_at) >= new Date(b.created_at) ? a : b
                          )
                        : null
                    return (
                      <article
                        key={p.id}
                        className="rounded-lg border border-card bg-surface p-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="mb-1.5 flex items-start justify-between gap-2">
                          <h4 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-tight text-text-primary">
                            {p.solicitante_nome || 'Solicitante'}
                          </h4>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-secondary">
                            {p.origem === 'whatsapp' ? 'WA' : p.origem}
                          </span>
                        </div>

                        {p.municipio ? (
                          <p className="mb-1 flex items-center gap-1 text-[11px] text-text-secondary">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{p.municipio}</span>
                          </p>
                        ) : null}

                        {p.destino ? (
                          <p className="mb-1.5 line-clamp-2 text-[11px] text-text-secondary">
                            {p.destino}
                          </p>
                        ) : null}

                        {p.observacao ? (
                          <p className="mb-2 line-clamp-2 text-[11px] text-text-secondary">
                            {p.observacao}
                          </p>
                        ) : null}

                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-secondary">
                          {p.origem === 'whatsapp' ? (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageCircle className="h-3 w-3" aria-hidden />
                              WhatsApp
                            </span>
                          ) : null}
                          {p.protocolo ? (
                            <span className="font-mono">{p.protocolo}</span>
                          ) : null}
                          <span className="inline-flex items-center gap-0.5">
                            <Package className="h-3 w-3" aria-hidden />
                            {qtdItens} item{qtdItens === 1 ? '' : 's'} ·{' '}
                            {qtdTotal.toLocaleString('pt-BR')} un
                          </span>
                        </div>

                        {p.itens && p.itens.length > 0 ? (
                          <ul className="mb-2 space-y-0.5 border-t border-card pt-2">
                            {p.itens.slice(0, 3).map((it) => (
                              <li
                                key={it.id}
                                className="flex justify-between gap-2 text-[11px] text-text-secondary"
                              >
                                <span className="truncate">
                                  {it.material?.nome ?? 'Material'}
                                </span>
                                <span className="shrink-0 tabular-nums font-medium text-text-primary">
                                  {it.quantidade.toLocaleString('pt-BR')}
                                </span>
                              </li>
                            ))}
                            {p.itens.length > 3 ? (
                              <li className="text-[10px] text-text-secondary">
                                +{p.itens.length - 3} itens
                              </li>
                            ) : null}
                          </ul>
                        ) : null}

                        {ultimoLog ? (
                          <div className="mb-2 border-t border-card pt-2">
                            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                              Última atualização
                            </p>
                            <p className="text-[10px] leading-snug text-text-secondary">
                              <span className="font-medium text-text-primary">
                                {nomeUsuarioPedidoLog(ultimoLog)}
                              </span>{' '}
                              {labelAcaoPedidoLog(
                                ultimoLog.status_novo,
                                ultimoLog.acao
                              ).toLowerCase()}
                              <span className="text-text-secondary/80">
                                {' · '}
                                {new Date(ultimoLog.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </p>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {next ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => onAvancar(p.id, next)}
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                                next === 'entregue'
                                  ? 'border border-[#ff9800] bg-[#ff9800] text-black'
                                  : 'border border-card bg-background text-text-primary hover:bg-black/[0.03]'
                              )}
                            >
                              {labelAcao(p.status)}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onRecusar(p.id)}
                            className="rounded-full border border-card px-2.5 py-1 text-[11px] text-status-error"
                          >
                            Recusar
                          </button>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
