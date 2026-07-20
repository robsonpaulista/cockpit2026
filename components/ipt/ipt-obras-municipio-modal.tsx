'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  classificarObraFase,
  isObraLinhaTotalPlanilha,
  OBRA_FASE_LABEL,
  valorExibidoMapaObra,
  type ObraMapaRow,
} from '@/lib/obras-mapa'

type Props = {
  municipio: string
  obras: ObraMapaRow[]
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

export function IptObrasMunicipioModal({ municipio, obras, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)

  const obrasMunicipio = useMemo(() => {
    const key = normalizeIptMunicipio(municipio)
    return obras
      .filter((o) => normalizeIptMunicipio(o.municipio ?? '') === key)
      .filter((o) => !isObraLinhaTotalPlanilha(o))
      .slice()
      .sort((a, b) => {
        const va = valorExibidoMapaObra(a) ?? 0
        const vb = valorExibidoMapaObra(b) ?? 0
        if (vb !== va) return vb - va
        return tituloObra(a).localeCompare(tituloObra(b), 'pt-BR')
      })
  }, [municipio, obras])

  const totalValor = useMemo(
    () => obrasMunicipio.reduce((s, o) => s + (valorExibidoMapaObra(o) ?? 0), 0),
    [obrasMunicipio]
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
    <div className="ipt-foco-modal" role="presentation">
      <button
        type="button"
        className="ipt-foco-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="ipt-obras-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Obras do mandato</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              Obras em {municipio}
            </h2>
          </div>
          <button
            type="button"
            className="ipt-foco-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>

        <p className="ipt-foco-modal__lead">
          {obrasMunicipio.length === 0
            ? 'Nenhuma obra cadastrada para este município na base do mapa.'
            : `${obrasMunicipio.length.toLocaleString('pt-BR')} obra${
                obrasMunicipio.length === 1 ? '' : 's'
              } · total ${formatBrl(totalValor)}.`}
        </p>

        {obrasMunicipio.length === 0 ? (
          <p className="ipt-obras-modal__empty">Sem obras para listar.</p>
        ) : (
          <ul className="ipt-obras-modal__lista">
            {obrasMunicipio.map((obra) => {
              const fase = classificarObraFase(obra.status)
              return (
                <li key={obra.id}>
                  <div className="ipt-obras-modal__item-top">
                    <strong>{tituloObra(obra)}</strong>
                    <span>{formatBrl(valorExibidoMapaObra(obra))}</span>
                  </div>
                  <div className="ipt-obras-modal__item-meta">
                    {obra.tipo?.trim() ? <em>{obra.tipo.trim()}</em> : null}
                    <em>{OBRA_FASE_LABEL[fase]}</em>
                    {obra.orgao?.trim() ? <em>{obra.orgao.trim()}</em> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>,
    document.body
  )
}
