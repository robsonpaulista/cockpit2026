'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconMapRoute, IconX } from '@tabler/icons-react'
import type { IptMunicipio } from '@/lib/ipt'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import type { WarRoomAgendaProximoItem } from '@/lib/war-room/agenda-proximos'
import {
  buildSugestoesAgendaTd,
  type WarRoomAgendaSugestaoOrdenacao,
  type WarRoomAgendaSugestaoOrigem,
  type WarRoomAgendaSugestaoTdResult,
} from '@/lib/war-room/agenda-sugestao-td'
import { cn } from '@/lib/utils'

type Props = {
  cidadePai: string
  dataPaiKey: string
  hojeKey: string
  municipios: IptMunicipio[]
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>
  onClose: () => void
}

const ORDENACAO_OPCOES: Array<{ id: WarRoomAgendaSugestaoOrdenacao; label: string }> = [
  { id: 'expectativa', label: 'Expectativa' },
  { id: 'rota', label: 'Rota (km)' },
]

function formatPesoPct(pct: number): string {
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function formatKm(km: number | null): string {
  if (km == null) return '—'
  return `${km.toLocaleString('pt-BR')} km`
}

/** Modal de sugestão de agenda no TD da cidade-pai. */
export function WarRoomAgendaSugestaoTdModal({
  cidadePai,
  dataPaiKey,
  hojeKey,
  municipios,
  agendaPorMunicipio,
  onClose,
}: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [ordenacao, setOrdenacao] = useState<WarRoomAgendaSugestaoOrdenacao>('expectativa')
  const [origemRota, setOrigemRota] = useState<WarRoomAgendaSugestaoOrigem>('referencia')

  const origemOpcoes = useMemo(
    (): Array<{ id: WarRoomAgendaSugestaoOrigem; label: string }> => [
      { id: 'referencia', label: cidadePai },
      { id: 'teresina', label: 'Teresina (base)' },
    ],
    [cidadePai],
  )

  const plano = useMemo(
    (): WarRoomAgendaSugestaoTdResult =>
      buildSugestoesAgendaTd({
        cidadePai,
        dataPaiKey,
        hojeKey,
        municipios,
        agendaPorMunicipio,
        ordenacao,
        origemRota,
      }),
    [cidadePai, dataPaiKey, hojeKey, municipios, agendaPorMunicipio, ordenacao, origemRota],
  )

  const showRota = ordenacao === 'rota'

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
        className="wr-visita-modal__panel wr-agenda-sugestao__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconMapRoute className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">Expectativa de votos · Agenda</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Sugestão de agenda · TD
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          Com base em <strong>{cidadePai}</strong> ({plano.dataPaiLabel}): municípios do mesmo TD
          sem visita nos últimos {plano.janelaVisitasDias} dias e sem agendamento até a data-pai.
          {showRota ? (
            <>
              {' '}
              Rota por distância em linha reta a partir de <strong>{plano.origemLabel}</strong>{' '}
              (vizinho mais próximo).
            </>
          ) : null}
        </p>

        <div className="wr-agenda-sugestao__filtros" role="group" aria-label="Ordenação">
          {ORDENACAO_OPCOES.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              aria-pressed={ordenacao === opcao.id}
              className={cn(
                'wr-agenda-sugestao__filtro',
                ordenacao === opcao.id && 'wr-agenda-sugestao__filtro--ativo',
              )}
              onClick={() => setOrdenacao(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>

        {showRota ? (
          <div
            className="wr-agenda-sugestao__filtros wr-agenda-sugestao__filtros--origem"
            role="group"
            aria-label="Origem da rota"
          >
            {origemOpcoes.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={origemRota === opcao.id}
                className={cn(
                  'wr-agenda-sugestao__filtro',
                  origemRota === opcao.id && 'wr-agenda-sugestao__filtro--ativo',
                )}
                onClick={() => setOrigemRota(opcao.id)}
              >
                {opcao.label}
              </button>
            ))}
          </div>
        ) : null}

        {!plano.td ? (
          <p className="wr-visita-modal__state">
            Não foi possível identificar o Território de Desenvolvimento de {cidadePai}.
          </p>
        ) : (
          <>
            <div className="wr-agenda-sugestao__meta">
              <span>
                TD <strong>{plano.td}</strong>
              </span>
              <span>
                {plano.sugestoes.length} sugest
                {plano.sugestoes.length === 1 ? 'ão' : 'ões'}
                {' · '}
                {plano.totalNoTd} no TD
                {showRota && plano.distanciaTotalKm != null
                  ? ` · ~${formatWarRoomNumber(plano.distanciaTotalKm)} km`
                  : null}
              </span>
            </div>

            {plano.sugestoes.length === 0 ? (
              <p className="wr-visita-modal__state">
                Nenhum município elegível.
                {plano.excluidosComVisita > 0 || plano.excluidosComAgenda > 0
                  ? ` (${plano.excluidosComVisita} com visita recente · ${plano.excluidosComAgenda} já agendados)`
                  : null}
              </p>
            ) : (
              <ul
                className={cn(
                  'wr-agenda-sugestao__list',
                  showRota && 'wr-agenda-sugestao__list--rota',
                )}
                aria-label="Sugestões de municípios no TD"
              >
                <li
                  className={cn(
                    'wr-agenda-sugestao__row wr-agenda-sugestao__row--head',
                    showRota && 'wr-agenda-sugestao__row--rota',
                  )}
                  aria-hidden
                >
                  <span>#</span>
                  <span>Município</span>
                  {showRota ? (
                    <>
                      <span className="text-right">Trecho</span>
                      <span className="text-right">Origem</span>
                    </>
                  ) : (
                    <>
                      <span className="text-right">Exp.</span>
                      <span className="text-right">Peso</span>
                    </>
                  )}
                </li>
                {plano.sugestoes.map((item, index) => (
                  <li
                    key={item.municipio}
                    className={cn(
                      'wr-agenda-sugestao__row',
                      showRota && 'wr-agenda-sugestao__row--rota',
                    )}
                  >
                    <span className="wr-agenda-sugestao__rank tabular-nums">{index + 1}</span>
                    <span className="wr-agenda-sugestao__cidade truncate" title={item.municipio}>
                      {item.municipio}
                      {item.ehReferenciaAgenda ? (
                        <span className="wr-agenda-sugestao__ref"> agenda</span>
                      ) : null}
                      {!showRota && item.distanciaKmOrigem != null ? (
                        <span className="wr-agenda-sugestao__cidade-km">
                          {' '}
                          · {formatKm(item.distanciaKmOrigem)}
                        </span>
                      ) : null}
                    </span>
                    {showRota ? (
                      <>
                        <span
                          className="wr-agenda-sugestao__km tabular-nums text-right"
                          title="Distância desde o ponto anterior na rota"
                        >
                          {formatKm(item.distanciaKmTrecho)}
                        </span>
                        <span
                          className="wr-agenda-sugestao__km wr-agenda-sugestao__km--soft tabular-nums text-right"
                          title={`Distância em linha reta até ${plano.origemLabel}`}
                        >
                          {formatKm(item.distanciaKmOrigem)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="wr-agenda-sugestao__votos tabular-nums text-right">
                          {formatWarRoomNumber(item.expectativaVotos)}
                        </span>
                        <span className="wr-agenda-sugestao__peso tabular-nums text-right">
                          {formatPesoPct(item.pesoExpectativaPct)}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
