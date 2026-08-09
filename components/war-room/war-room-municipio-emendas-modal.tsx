'use client'

import { Sheet, X } from 'lucide-react'
import { useEffect, useId, useMemo } from 'react'

import {
  emendaEstaPaga,
  filtrarEmendasPorMunicipio,
  totaisEmendas,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'

type Props = {
  municipio: string
  emendas: EmendaRegistro[]
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

function tituloEmenda(e: EmendaRegistro): string {
  return e.objeto?.trim() || e.emenda.trim() || 'Emenda sem objeto'
}

function modalidadeEmenda(e: EmendaRegistro): string {
  const titulo = tituloEmenda(e)
  const modalidade = e.emenda.trim()
  if (!modalidade) return '—'
  // Evita repetir o mesmo texto nas duas colunas
  if (modalidade.toLocaleLowerCase('pt-BR') === titulo.toLocaleLowerCase('pt-BR')) {
    return e.bloco?.trim() || '—'
  }
  return modalidade
}

/** Modal de emendas do município — aberto a partir do ranking da Expectativa. */
export function WarRoomMunicipioEmendasModal({
  municipio,
  emendas,
  onClose,
}: Props) {
  const tituloId = useId()

  const lista = useMemo(
    () =>
      filtrarEmendasPorMunicipio(emendas, municipio)
        .slice()
        .sort((a, b) => {
          const anoA = a.exercicio ?? 0
          const anoB = b.exercicio ?? 0
          if (anoB !== anoA) return anoB - anoA
          const va = a.valor_indicado ?? a.valor_empenhado ?? a.valor_pago ?? 0
          const vb = b.valor_indicado ?? b.valor_empenhado ?? b.valor_pago ?? 0
          if (vb !== va) return vb - va
          return tituloEmenda(a).localeCompare(tituloEmenda(b), 'pt-BR')
        }),
    [emendas, municipio],
  )

  const totais = useMemo(() => totaisEmendas(lista), [lista])

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
        className="wr-visita-modal__panel wr-municipio-detalhe-modal__panel wr-municipio-detalhe-modal__panel--emendas"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <Sheet className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Emendas</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Emendas em {municipio}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          {lista.length === 0
            ? 'Nenhuma emenda destinada a este município no cadastro.'
            : `${lista.length.toLocaleString('pt-BR')} emenda${
                lista.length === 1 ? '' : 's'
              } · indicado ${formatBrl(totais.valorIndicado)}.`}
        </p>

        {lista.length === 0 ? (
          <p className="wr-visita-modal__state">Sem emendas para listar.</p>
        ) : (
          <div className="wr-municipio-detalhe-modal__table-wrap">
            <table className="wr-municipio-detalhe-modal__table">
              <thead>
                <tr>
                  <th scope="col">Ano</th>
                  <th scope="col">Emenda</th>
                  <th scope="col">Modalidade</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="wr-municipio-detalhe-modal__col-valor">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((emenda) => {
                  const valor =
                    emenda.valor_indicado ??
                    emenda.valor_empenhado ??
                    emenda.valor_pago
                  const paga = emendaEstaPaga(emenda)
                  const titulo = tituloEmenda(emenda)
                  return (
                    <tr key={emenda.id}>
                      <td className="tabular-nums">
                        {emenda.exercicio != null ? emenda.exercicio : '—'}
                      </td>
                      <td className="wr-municipio-detalhe-modal__col-obra" title={titulo}>
                        <span>{titulo}</span>
                      </td>
                      <td
                        className="wr-municipio-detalhe-modal__col-clip"
                        title={modalidadeEmenda(emenda)}
                      >
                        <span>{modalidadeEmenda(emenda)}</span>
                      </td>
                      <td>
                        <span
                          className={
                            paga ? 'wr-municipio-detalhe-modal__status--ok' : undefined
                          }
                        >
                          {paga ? 'Paga' : 'Em aberto'}
                        </span>
                      </td>
                      <td className="wr-municipio-detalhe-modal__col-valor tabular-nums">
                        {formatBrl(valor)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
