'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconChevronDown,
  IconLoader2,
  IconSend,
  IconX,
} from '@tabler/icons-react'
import type { FluxoCampanhaDetalhe } from '@/lib/fluxo-campanhas'
import { cn } from '@/lib/utils'

type Props = {
  campanhaId: string | null
  titulo: string
  onClose: () => void
}

function formatPct(ok: number, total: number): string {
  if (total <= 0) return '—'
  const pct = Math.round((ok / total) * 1000) / 10
  return `${pct.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
}

/** Modal de detalhe da campanha — cidade → liderança (recolhido por padrão). */
export function WarRoomDisparoDetalheModal({
  campanhaId,
  titulo,
  onClose,
}: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalhe, setDetalhe] = useState<FluxoCampanhaDetalhe | null>(null)
  /** Cidades expandidas — inicia vazio (tudo recolhido). */
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set())

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setDetalhe(null)
    setAbertas(new Set())

    const params = new URLSearchParams()
    params.set('detalhe', '1')
    if (campanhaId) params.set('campanha', campanhaId)
    else params.set('titulo', titulo)

    void fetch(`/api/fluxo/campanhas?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as {
          detalhe?: FluxoCampanhaDetalhe
          error?: string
        }
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar detalhe')
        if (cancelled) return
        setDetalhe(data.detalhe ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao carregar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [campanhaId, titulo])

  const toggleCidade = (cidade: string) => {
    setAbertas((prev) => {
      const next = new Set(prev)
      if (next.has(cidade)) next.delete(cidade)
      else next.add(cidade)
      return next
    })
  }

  if (!mounted) return null

  return createPortal(
    <div
      className="wr-disparo-detalhe-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
    >
      <button
        type="button"
        className="wr-disparo-detalhe-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="wr-disparo-detalhe-modal__panel">
        <header className="wr-disparo-detalhe-modal__header">
          <div className="min-w-0">
            <p className="wr-disparo-detalhe-modal__eyebrow">
              <IconSend className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
              Disparo · cidade → liderança
            </p>
            <h2 id={tituloId} className="wr-disparo-detalhe-modal__title truncate">
              {detalhe?.titulo || titulo}
            </h2>
            {detalhe ? (
              <p className="wr-disparo-detalhe-modal__sub">
                {detalhe.enviados.toLocaleString('pt-BR')} envios ·{' '}
                {formatPct(detalhe.ok, detalhe.enviados)} ok ·{' '}
                {detalhe.cidades.length.toLocaleString('pt-BR')}{' '}
                {detalhe.cidades.length === 1 ? 'cidade' : 'cidades'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="wr-disparo-detalhe-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <div className="wr-disparo-detalhe-modal__body">
          {loading ? (
            <div className="wr-disparo-detalhe-modal__state">
              <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
              Carregando detalhe…
            </div>
          ) : error ? (
            <p className="wr-disparo-detalhe-modal__state wr-disparo-detalhe-modal__state--erro">
              {error}
            </p>
          ) : !detalhe || detalhe.cidades.length === 0 ? (
            <p className="wr-disparo-detalhe-modal__state">
              Nenhum envio encontrado para esta campanha.
            </p>
          ) : (
            <ul className="wr-disparo-detalhe-modal__cidades" aria-label="Cidades da campanha">
              {detalhe.cidades.map((cid) => {
                const open = abertas.has(cid.cidade)
                const panelId = `wr-disp-cid-${cid.cidade.replace(/\s+/g, '-')}`
                return (
                  <li key={cid.cidade} className="wr-disparo-detalhe-modal__cidade">
                    <button
                      type="button"
                      className="wr-disparo-detalhe-modal__cidade-btn"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => toggleCidade(cid.cidade)}
                    >
                      <IconChevronDown
                        className={cn(
                          'wr-disparo-detalhe-modal__chevron h-4 w-4 shrink-0',
                          open && 'wr-disparo-detalhe-modal__chevron--open',
                        )}
                        stroke={1.75}
                        aria-hidden
                      />
                      <span className="wr-disparo-detalhe-modal__cidade-nome truncate">
                        {cid.cidade}
                      </span>
                      <span className="wr-disparo-detalhe-modal__cidade-meta tabular-nums">
                        {cid.liderancas.length}{' '}
                        {cid.liderancas.length === 1 ? 'liderança' : 'lideranças'}
                        {' · '}
                        {cid.enviados.toLocaleString('pt-BR')}
                        {' · '}
                        {formatPct(cid.ok, cid.enviados)}
                      </span>
                    </button>

                    {open ? (
                      <ul
                        id={panelId}
                        className="wr-disparo-detalhe-modal__liderancas"
                        aria-label={`Lideranças em ${cid.cidade}`}
                      >
                        {cid.liderancas.map((lid) => (
                          <li
                            key={`${lid.nome}-${lid.telefone ?? ''}-${lid.cargo ?? ''}`}
                            className="wr-disparo-detalhe-modal__lideranca"
                          >
                            <div className="min-w-0">
                              <p className="wr-disparo-detalhe-modal__lider-nome truncate">
                                {lid.nome}
                              </p>
                              <p className="wr-disparo-detalhe-modal__lider-meta truncate">
                                {[lid.cargo, lid.telefone].filter(Boolean).join(' · ') || '—'}
                              </p>
                            </div>
                            <span
                              className={cn(
                                'wr-disparo-detalhe-modal__lider-status',
                                lid.ok
                                  ? 'wr-disparo-detalhe-modal__lider-status--ok'
                                  : 'wr-disparo-detalhe-modal__lider-status--erro',
                              )}
                            >
                              {lid.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
