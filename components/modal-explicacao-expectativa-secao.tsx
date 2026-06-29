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

const PANEL_WIDTH = 400
const PANEL_ESTIMATED_HEIGHT = 320

function fmtVotos(n: number): string {
  return n.toLocaleString('pt-BR')
}

function expectativaDestaque(selecao: SelecaoExplicacaoExpectativa): number {
  return selecao.escopo === 'secao' ? selecao.detalhe.expectativaSecao : selecao.detalhe.expectativaBairro
}

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
              Expectativa 2026
            </p>
            <h3 id="exp-explicacao-titulo" className="mt-0.5 text-sm font-semibold text-text-primary">
              Como chegamos nesse número?
            </h3>
            <p className="mt-0.5 text-xs text-text-secondary">{selecao.rotulo}</p>
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

        <div className="mb-4 rounded-xl border border-accent-gold/25 bg-accent-gold/8 px-4 py-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-text-primary">
            {fmtVotos(expectativaDestaque(selecao))}
          </p>
          <p className="mt-0.5 text-[11px] text-text-secondary">
            votos esperados {selecao.escopo === 'secao' ? 'nesta seção' : 'neste bairro'}
          </p>
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
              <h4 className="mb-2 text-xs font-semibold text-text-primary">{bloco.titulo}</h4>
              <div className="space-y-2 text-[13px] leading-relaxed text-text-secondary">
                {bloco.linhas.map((linha) => (
                  <p key={linha}>{linha}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}
