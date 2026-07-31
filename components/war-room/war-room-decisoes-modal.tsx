'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDown,
  IconChevronRight,
  IconListDetails,
  IconX,
} from '@tabler/icons-react'
import type { WarRoomDecisao } from '@/lib/war-room/decisoes'
import type { WarRoomDecisaoSecao } from '@/lib/war-room/decisoes-secoes'
import { cn } from '@/lib/utils'

type Props = {
  secoes: WarRoomDecisaoSecao[]
  onClose: () => void
  onActivate?: (decisao: WarRoomDecisao) => void
}

const CATEGORIA_BADGE_LABEL: Record<string, string> = {
  'Visita agendada': 'Viagens',
  Pesquisas: 'Pesquisas',
  Notícias: 'Notícias',
  'Redes sociais': 'Redes Sociais',
}

function categoriaBadgeLabel(categoria: string): string {
  const key = categoria.trim()
  return CATEGORIA_BADGE_LABEL[key] ?? (key || 'Outros')
}

function categoriaBadgeClassName(categoria: string): string {
  return `wr-decisoes-badge--${categoria
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')}`
}

/** Modal com todos os alertas da fila, agrupados por Urgente / Atenção / Verificar. */
export function WarRoomDecisoesModal({ secoes, onClose, onActivate }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const secoesComItens = useMemo(
    () => secoes.filter((s) => s.items.length > 0),
    [secoes],
  )
  const total = useMemo(
    () => secoesComItens.reduce((n, s) => n + s.items.length, 0),
    [secoesComItens],
  )
  /** Seções expandidas — Urgente/Atenção/Verificar abertas; Outros fechado. */
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(secoes.filter((s) => s.id !== 'outros').map((s) => s.id)),
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

  const toggleSecao = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        className="wr-visita-modal__panel wr-decisoes-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconListDetails className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">War Room · Alertas</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Fila de decisões ({total})
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          Urgente (hoje + 2 dias) · Atenção (pesquisas) · Verificar (redes).
        </p>

        {total === 0 ? (
          <p className="wr-visita-modal__state">Nenhuma decisão pendente no momento.</p>
        ) : (
          <div className="wr-decisoes-modal__body">
            {secoesComItens.map((secao) => {
              const aberto = expanded.has(secao.id)
              const panelId = `wr-decisoes-secao-${secao.id}`

              return (
                <section
                  key={secao.id}
                  className={cn(
                    'wr-decisoes-modal__group',
                    `wr-decisoes-modal__group--${secao.id}`,
                    !aberto && 'wr-decisoes-modal__group--collapsed',
                  )}
                  aria-label={secao.label}
                >
                  <button
                    type="button"
                    className="wr-decisoes-modal__group-head"
                    aria-expanded={aberto}
                    aria-controls={panelId}
                    onClick={() => toggleSecao(secao.id)}
                  >
                    <IconChevronDown
                      className={cn(
                        'wr-decisoes-modal__group-chevron h-4 w-4 shrink-0',
                        !aberto && 'wr-decisoes-modal__group-chevron--closed',
                      )}
                      stroke={1.75}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="wr-decisoes-modal__group-title">{secao.label}</h3>
                      {secao.hint ? (
                        <p className="wr-decisoes-modal__group-hint">{secao.hint}</p>
                      ) : null}
                    </div>
                    <span className="wr-decisoes-modal__group-count tabular-nums">
                      {secao.items.length}
                    </span>
                  </button>
                  {aberto ? (
                    <ul id={panelId} className="wr-decisoes-modal__list" role="list">
                      {secao.items.map((decisao) => {
                        const canActivate =
                          Boolean(onActivate) &&
                          (decisao.categoria === 'Visita agendada' ||
                            Boolean(decisao.href))
                        const quando = decisao.prazo || decisao.hora || null
                        const metaParts = [
                          decisao.acao,
                          decisao.responsavel
                            ? `Resp.: ${decisao.responsavel}`
                            : null,
                        ].filter(Boolean)

                        const body = (
                          <>
                            <div className="wr-decisoes-modal__content min-w-0 flex-1">
                              <div className="wr-decisoes-modal__row">
                                <div className="wr-decisoes-modal__title-wrap min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      'wr-decisoes-badge',
                                      categoriaBadgeClassName(decisao.categoria),
                                    )}
                                  >
                                    {categoriaBadgeLabel(decisao.categoria)}
                                  </span>
                                  <p className="wr-decisoes-modal__title truncate">
                                    {decisao.problema.trim()}
                                  </p>
                                </div>
                                {quando ? (
                                  <time
                                    className="wr-decisoes-modal__hora shrink-0 tabular-nums"
                                    dateTime={decisao.createdAt ?? quando}
                                  >
                                    {quando}
                                  </time>
                                ) : null}
                              </div>
                              {metaParts.length > 0 ? (
                                <p className="wr-decisoes-modal__meta truncate">
                                  {metaParts.join(' · ')}
                                </p>
                              ) : null}
                            </div>
                            {canActivate ? (
                              <IconChevronRight
                                className="wr-decisoes-modal__chevron h-4 w-4 shrink-0"
                                stroke={1.75}
                                aria-hidden
                              />
                            ) : null}
                          </>
                        )

                        return (
                          <li key={decisao.id}>
                            {canActivate ? (
                              <button
                                type="button"
                                className={cn(
                                  'wr-decisoes-modal__item',
                                  'wr-decisoes-modal__item--action',
                                  decisao.destaque &&
                                    'wr-decisoes-modal__item--destaque',
                                )}
                                onClick={() => onActivate?.(decisao)}
                              >
                                {body}
                              </button>
                            ) : (
                              <div
                                className={cn(
                                  'wr-decisoes-modal__item',
                                  decisao.destaque &&
                                    'wr-decisoes-modal__item--destaque',
                                )}
                              >
                                {body}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
