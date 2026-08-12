'use client'

import { Building2, Loader2, RefreshCw, X } from 'lucide-react'
import { Fragment, useEffect, useId, useMemo } from 'react'

import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  isObraLinhaTotalPlanilha,
  valorExibidoMapaObra,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import {
  anoFromDataDemanda,
  groupObrasByTipoSortedByStatus,
} from '@/lib/mapa-obras-lista-tipo'

type Props = {
  municipio: string
  obras: ObraMapaRow[] | null
  loading?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  onClose: () => void
}

function formatBrl(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function tituloObra(obra: ObraMapaRow): string {
  const nome = obra.obra?.trim()
  if (nome) return nome
  const tipo = obra.tipo?.trim()
  if (tipo) return tipo
  return 'Obra sem título'
}

/** Modal de obras do município — mesma lógica da guia Obras (tipo + status). */
export function WarRoomMunicipioObrasModal({
  municipio,
  obras,
  loading = false,
  refreshing = false,
  onRefresh,
  onClose,
}: Props) {
  const tituloId = useId()

  const obrasMunicipio = useMemo(() => {
    if (!obras) return []
    const key = normalizeIptMunicipio(municipio)
    return obras
      .filter((o) => normalizeIptMunicipio(o.municipio ?? '') === key)
      .filter((o) => !isObraLinhaTotalPlanilha(o))
  }, [municipio, obras])

  const blocosPorTipo = useMemo(
    () => groupObrasByTipoSortedByStatus(obrasMunicipio),
    [obrasMunicipio],
  )

  const totalValor = useMemo(
    () => obrasMunicipio.reduce((s, o) => s + (valorExibidoMapaObra(o) ?? 0), 0),
    [obrasMunicipio],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="wr-visita-modal wr-visita-modal--nested" role="presentation">
      <button
        type="button"
        className="wr-visita-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="wr-visita-modal__panel wr-municipio-detalhe-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <Building2 className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Obras</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Obras em {municipio}
              </h2>
            </div>
          </div>
          <div className="wr-visita-modal__head-actions">
            {onRefresh ? (
              <button
                type="button"
                className="wr-visita-modal__refresh"
                aria-label="Atualizar obras"
                title="Atualizar obras"
                disabled={loading || refreshing}
                onClick={onRefresh}
              >
                <RefreshCw
                  className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
                  strokeWidth={1.5}
                />
                <span>Atualizar</span>
              </button>
            ) : null}
            <button
              type="button"
              className="wr-visita-modal__close"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {loading ? (
          <p className="wr-visita-modal__state flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            Carregando obras…
          </p>
        ) : (
          <>
            <p className="wr-visita-modal__lead">
              {obrasMunicipio.length === 0
                ? 'Nenhuma obra cadastrada para este município na base do mapa.'
                : `${obrasMunicipio.length.toLocaleString('pt-BR')} obra${
                    obrasMunicipio.length === 1 ? '' : 's'
                  } · ${blocosPorTipo.length.toLocaleString('pt-BR')} tipo${
                    blocosPorTipo.length === 1 ? '' : 's'
                  } · total ${formatBrl(totalValor)}.`}
              {refreshing ? ' Atualizando…' : ''}
            </p>
            {obrasMunicipio.length === 0 ? (
              <p className="wr-visita-modal__state">Sem obras para listar.</p>
            ) : (
              <div className="wr-municipio-detalhe-modal__table-wrap">
                <table className="wr-municipio-detalhe-modal__table">
                  <thead>
                    <tr>
                      <th scope="col">Obra</th>
                      <th scope="col">Ano</th>
                      <th scope="col" className="wr-municipio-detalhe-modal__col-valor">
                        Valor
                      </th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocosPorTipo.map((bloco) => (
                      <Fragment key={bloco.tipoKey}>
                        <tr className="wr-municipio-detalhe-modal__tipo-row">
                          <th
                            scope="colgroup"
                            colSpan={4}
                            className="wr-municipio-detalhe-modal__tipo-head"
                          >
                            {bloco.tipoLabel}
                            <span className="wr-municipio-detalhe-modal__tipo-count">
                              {bloco.obras.length.toLocaleString('pt-BR')}
                            </span>
                          </th>
                        </tr>
                        {bloco.obras.map((obra) => (
                          <tr key={obra.id}>
                            <td className="wr-municipio-detalhe-modal__col-obra">
                              <span title={tituloObra(obra)}>{tituloObra(obra)}</span>
                            </td>
                            <td className="tabular-nums">
                              {anoFromDataDemanda(obra.data_demanda)}
                            </td>
                            <td className="wr-municipio-detalhe-modal__col-valor tabular-nums">
                              {formatBrl(valorExibidoMapaObra(obra))}
                            </td>
                            <td>
                              <span title={obra.status?.trim() || undefined}>
                                {obra.status?.trim() || '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
