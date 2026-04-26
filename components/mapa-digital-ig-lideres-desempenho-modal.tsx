'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import {
  fetchMobilizacaoLideresDesempenhoIgPorMunicipio,
  fetchMobilizacaoLideresDesempenhoIgPorTd,
  type MobilizacaoLideresDesempenhoIgPorTdPayload,
} from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'
import { ClassificacaoTdBadge } from '@/components/classificacao-td-badge'
import {
  classificacaoTerritorioTdPorPctEngajamentoIg,
  rotuloEngajamentoIgPorTipo,
  tituloTooltipEngajamentoIgMidias,
} from '@/lib/instagram-engajamento-ig-classificacao'

const fmtInt = new Intl.NumberFormat('pt-BR')
const fmtPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

type Props = {
  open: boolean
  territorio: TerritorioDesenvolvimentoPI | null
  /** Município oficial no TD; null = visão agregada do TD inteiro. */
  municipioOficial: string | null
  onClose: () => void
  visualPreset: 'default' | 'futuristic'
}

export function MapaDigitalIgLideresDesempenhoModal({
  open,
  territorio,
  municipioOficial,
  onClose,
  visualPreset,
}: Props) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [erro, setErro] = useState<string>('')
  const [payload, setPayload] = useState<MobilizacaoLideresDesempenhoIgPorTdPayload | null>(null)

  const isFut = visualPreset === 'futuristic'

  const carregar = useCallback(async () => {
    if (!territorio) return
    setLoadState('loading')
    setErro('')
    const res = municipioOficial
      ? await fetchMobilizacaoLideresDesempenhoIgPorMunicipio(territorio, municipioOficial)
      : await fetchMobilizacaoLideresDesempenhoIgPorTd(territorio)
    if (!res.ok) {
      setPayload(null)
      setLoadState('error')
      setErro(res.message ?? 'Não foi possível carregar.')
      return
    }
    setPayload(res.data)
    setLoadState('ready')
  }, [territorio, municipioOficial])

  useEffect(() => {
    if (!open || !territorio) {
      setLoadState('idle')
      setPayload(null)
      setErro('')
      return
    }
    void carregar()
  }, [open, territorio, municipioOficial, carregar])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !territorio) return null

  const escopoLinha2 =
    municipioOficial != null
      ? `${territorio} · ${municipioOficial}`
      : String(territorio)

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapa-ig-lideres-desempenho-titulo"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] flex max-h-[min(90dvh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-xl',
          isFut
            ? 'border-[rgba(255,255,255,0.1)] bg-[#121821] text-[#E6EDF3]'
            : 'border-border-card bg-surface text-text-primary'
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-5',
            isFut ? 'border-white/[0.08] bg-[#0B0F14]' : 'border-border-card'
          )}
        >
          <div className="min-w-0">
            <h2
              id="mapa-ig-lideres-desempenho-titulo"
              className={cn(
                'text-base font-semibold leading-tight sm:text-lg',
                isFut ? 'text-white' : 'text-text-primary'
              )}
            >
              Desempenho digital · líderes
            </h2>
            <p
              className={cn(
                'mt-1.5 text-xs leading-relaxed sm:text-sm',
                isFut ? 'text-white/88' : 'text-text-muted'
              )}
            >
              <span className={cn('font-medium', isFut ? 'text-white' : 'text-text-primary')}>{escopoLinha2}</span>
              {isFut ? ' · ' : ' — '}
              publicações (coluna) = mídias distintas com comentário de liderados (@) neste recorte; % = essas mídias ÷
              publicações processadas na conta (total sincronizado).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'shrink-0 rounded-lg p-2 transition-colors',
              isFut ? 'text-white/80 hover:bg-white/[0.08] hover:text-white' : 'text-text-muted hover:bg-card'
            )}
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
          {loadState === 'loading' ? (
            <p className={cn('flex items-center gap-2 text-sm', isFut ? 'text-white/75' : 'text-text-muted')}>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              Carregando métricas por líder…
            </p>
          ) : null}
          {loadState === 'error' && erro ? (
            <p className={cn('text-sm', isFut ? 'text-rose-300' : 'text-status-danger')}>{erro}</p>
          ) : null}
          {loadState === 'ready' && payload ? (
            <>
              <div
                className={cn(
                  'overflow-hidden rounded-lg border text-[10px] leading-tight sm:text-[11px]',
                  isFut ? 'border-white/[0.08]' : 'border-border-card/50'
                )}
                role="table"
                aria-label="Métricas por líder"
              >
                <div
                  role="row"
                  className={cn(
                    'grid items-center border-b px-2 py-1 font-semibold uppercase tracking-wide sm:px-2.5 sm:py-1',
                    isFut ? 'border-white/[0.1] bg-[#0B0F14] text-[#F1F5F9]' : 'border-border-card bg-[rgb(15,45,74)] text-white'
                  )}
                  style={{
                    gridTemplateColumns: 'minmax(0,1fr) 2.25rem 2.25rem 2.5rem 2.25rem 2rem minmax(4.25rem,auto)',
                    columnGap: '0.35rem',
                  }}
                >
                  <div role="columnheader" className="min-w-0 text-left">
                    Líder
                  </div>
                  <div role="columnheader" className="text-right tabular-nums" title="Liderados com @">
                    @
                  </div>
                  <div role="columnheader" className="text-right tabular-nums" title="Mídias com engajamento">
                    Míd.
                  </div>
                  <div role="columnheader" className="text-right tabular-nums" title="Comentários">
                    Com.
                  </div>
                  <div role="columnheader" className="text-right tabular-nums" title="Liderados que comentaram">
                    Cmt.
                  </div>
                  <div
                    role="columnheader"
                    className="text-right tabular-nums"
                    title="Mídias com engajamento ÷ publicações processadas na conta"
                  >
                    %
                  </div>
                  <div
                    role="columnheader"
                    className="text-center"
                    title="Engajamento pelas mesmas faixas do mapa: % mídias ÷ processadas; baixo abaixo de 50%; médio 50% a 80%; alto acima de 80%"
                  >
                    Eng. IG
                  </div>
                </div>
                <div className={cn(isFut ? 'bg-[#121821]' : 'bg-surface')}>
                  {payload.lideres.map((L, idx) => (
                    <div
                      key={L.id}
                      role="row"
                      className={cn(
                        'grid items-center border-b px-2 py-0.5 sm:px-2.5 sm:py-0.5',
                        isFut ? 'border-white/[0.06]' : 'border-border-card/40',
                        idx === payload.lideres.length - 1 && 'border-b-0'
                      )}
                      style={{
                        gridTemplateColumns: 'minmax(0,1fr) 2.25rem 2.25rem 2.5rem 2.25rem 2rem minmax(4.25rem,auto)',
                        columnGap: '0.35rem',
                      }}
                    >
                      <div role="cell" className={cn('min-w-0 font-medium', isFut ? 'text-[#E6EDF3]' : 'text-text-primary')}>
                        <span className="block truncate" title={L.nome}>
                          {L.nome}
                        </span>
                      </div>
                      <div
                        role="cell"
                        className={cn('text-right tabular-nums', isFut ? 'text-[#CBD5E1]' : 'text-text-secondary')}
                      >
                        {fmtInt.format(L.lideradosComRede)}
                      </div>
                      <div
                        role="cell"
                        className={cn('text-right tabular-nums', isFut ? 'text-[#CBD5E1]' : 'text-text-secondary')}
                      >
                        {fmtInt.format(L.publicacoes)}
                      </div>
                      <div
                        role="cell"
                        className={cn('text-right tabular-nums', isFut ? 'text-[#CBD5E1]' : 'text-text-secondary')}
                      >
                        {fmtInt.format(L.comentarios)}
                      </div>
                      <div
                        role="cell"
                        className={cn('text-right tabular-nums', isFut ? 'text-[#CBD5E1]' : 'text-text-secondary')}
                      >
                        {fmtInt.format(L.lideradosQueComentaram)}
                      </div>
                      <div
                        role="cell"
                        className={cn(
                          'text-right tabular-nums font-semibold',
                          isFut ? 'text-emerald-300' : 'text-status-success'
                        )}
                      >
                        {payload.postagensProcessadas > 0 ? `${fmtPct.format(L.pctParticipacao)}%` : '—'}
                      </div>
                      <div role="cell" className="flex items-center justify-center">
                        {payload.postagensProcessadas > 0 ? (
                          (() => {
                            const tipoEng = classificacaoTerritorioTdPorPctEngajamentoIg(L.pctParticipacao)
                            return (
                              <ClassificacaoTdBadge
                                tipo={tipoEng}
                                compact
                                visualTone={isFut ? 'futuristic' : 'default'}
                                labelOverride={rotuloEngajamentoIgPorTipo(tipoEng)}
                                titleOverride={tituloTooltipEngajamentoIgMidias(
                                  L.publicacoes,
                                  payload.postagensProcessadas,
                                  L.pctParticipacao
                                )}
                              />
                            )
                          })()
                        ) : (
                          <span className={cn('tabular-nums', isFut ? 'text-white/45' : 'text-text-muted')}>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {payload.lideres.length === 0 ? (
                <p className={cn('mt-3 text-sm', isFut ? 'text-white/70' : 'text-text-muted')}>
                  Nenhum líder cadastrado neste recorte.
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
