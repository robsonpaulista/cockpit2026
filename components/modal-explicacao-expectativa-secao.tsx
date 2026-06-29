'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { computeAnchoredPopupPosition } from '@/lib/anchored-popup-position'
import {
  montarExplicacaoExpectativaBairro,
  montarExplicacaoExpectativaSecao,
  tituloRegraExpectativa,
  type ExpectativaBairroDetalhe,
  type ExpectativaSecaoDetalhe,
} from '@/lib/lideranca-expectativa-secao'
import { cn } from '@/lib/utils'

export type SelecaoExplicacaoExpectativa =
  | { escopo: 'secao'; detalhe: ExpectativaSecaoDetalhe; rotulo: string }
  | { escopo: 'bairro'; detalhe: ExpectativaBairroDetalhe; rotulo: string }

type ModalExplicacaoExpectativaSecaoProps = {
  selecao: SelecaoExplicacaoExpectativa | null
  anchor: { x: number; y: number } | null
  onClose: () => void
}

const PANEL_WIDTH = 460
const PANEL_ESTIMATED_HEIGHT = 420

function badgeRegraClass(regra: ExpectativaSecaoDetalhe['regra'] | ExpectativaBairroDetalhe['regra']) {
  if (regra === 'similaridade_baixa') {
    return 'border-status-warning/40 bg-status-warning/10 text-status-warning'
  }
  if (regra === 'similaridade_alta') {
    return 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
  }
  return 'border-card bg-background text-text-secondary'
}

export function ModalExplicacaoExpectativaSecao({
  selecao,
  anchor,
  onClose,
}: ModalExplicacaoExpectativaSecaoProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!selecao || !anchor) {
      setPosition(null)
      return
    }
    const height = panelRef.current?.offsetHeight ?? PANEL_ESTIMATED_HEIGHT
    setPosition(computeAnchoredPopupPosition(anchor, PANEL_WIDTH, height))
  }, [selecao, anchor])

  useEffect(() => {
    if (!selecao) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecao, onClose])

  if (!mounted || !selecao || !anchor || !position) return null

  const regra = selecao.detalhe.regra
  const blocos =
    selecao.escopo === 'secao'
      ? montarExplicacaoExpectativaSecao(selecao.detalhe)
      : montarExplicacaoExpectativaBairro(selecao.detalhe)

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1200] cursor-default bg-black/20"
        aria-label="Fechar explicação"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-explicacao-titulo"
        className="fixed z-[1201] max-h-[min(85vh,560px)] overflow-y-auto rounded-2xl border border-card bg-surface p-4 shadow-2xl"
        style={{ left: position.left, top: position.top, width: PANEL_WIDTH }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Exp. 2026 · memória de cálculo
            </p>
            <h3 id="exp-explicacao-titulo" className="mt-0.5 text-sm font-semibold text-text-primary">
              {selecao.rotulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-text-secondary hover:bg-background hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <span
          className={cn(
            'mb-4 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold',
            badgeRegraClass(regra),
          )}
        >
          {tituloRegraExpectativa(regra)}
        </span>

        <div className="space-y-4">
          {blocos.map((bloco) => (
            <section key={bloco.titulo}>
              <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-primary">
                {bloco.titulo}
              </h4>
              <ul className="space-y-1 text-[12px] leading-relaxed text-text-secondary">
                {bloco.linhas.map((linha) => (
                  <li key={linha} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-secondary/60" aria-hidden />
                    <span>{linha}</span>
                  </li>
                ))}
              </ul>
              {bloco.formula ? (
                <div className="mt-2 rounded-lg border border-accent-gold/30 bg-accent-gold/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-text-primary">
                  {bloco.formula}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}
