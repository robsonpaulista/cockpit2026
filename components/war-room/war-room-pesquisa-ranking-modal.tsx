'use client'

import { BarChart3, X } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'
import { resolveCandidatoIpt } from '@/lib/ipt-pesquisa'
import { cn } from '@/lib/utils'

type Props = {
  pesquisa: WarRoomPesquisaConsolidadaReal
  onClose: () => void
}

function formatPct1(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toLocaleString('pt-BR', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`
}

function candidatoNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Modal do ranking completo de uma pesquisa (duplo clique na linha). */
export function WarRoomPesquisaRankingModal({ pesquisa, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const focoNorm = useMemo(
    () => candidatoNormalizado(resolveCandidatoIpt()),
    [],
  )

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="wr-visita-modal" role="presentation">
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
        className="wr-visita-modal__panel wr-pesquisa-ranking-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">
                {pesquisa.cenario} · Votos válidos · {pesquisa.instituto} ·{' '}
                {pesquisa.dataLabel}
              </p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                {pesquisa.cidade}
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

        {pesquisa.ranking.length === 0 ? (
          <p className="wr-visita-modal__state">Sem candidatos nesta pesquisa.</p>
        ) : (
          <>
            {pesquisa.jadyelNaoPontuou ? (
              <p className="wr-pesquisa-ranking-modal__note" role="status">
                Candidato foco não pontuou nesta pesquisa (NP · 0%).
              </p>
            ) : null}
            <ol className="wr-pesquisa-ranking-modal__list" aria-label="Ranking da pesquisa">
              {pesquisa.ranking.map((item, index) => {
                const isFoco = focoNorm !== '' && candidatoNormalizado(item.nome) === focoNorm
                return (
                  <li
                    key={`${item.nome}-${index}`}
                    className={cn(
                      'wr-pesquisa-ranking-modal__row',
                      isFoco && 'wr-pesquisa-ranking-modal__row--foco',
                    )}
                  >
                    <span className="wr-pesquisa-ranking-modal__pos tabular-nums">
                      {index + 1}º
                    </span>
                    <span className="wr-pesquisa-ranking-modal__nome truncate" title={item.nome}>
                      {item.nome}
                    </span>
                    <span className="wr-pesquisa-ranking-modal__pct tabular-nums">
                      {formatPct1(item.pct)}
                    </span>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
