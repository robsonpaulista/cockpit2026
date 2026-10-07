'use client'

import { Fragment, type MouseEvent } from 'react'
import { Loader2, MapPin, UserCheck, Users } from 'lucide-react'
import { ArrivalTimer } from '@/components/arrival-timer'
import { AgendaToCampoButton } from '@/components/agenda/agenda-to-campo-button'
import { TseChevronCelula, TseStatus, tseTabela } from '@/components/tse/tse-ui'
import type { AgendaGoogle } from '@/hooks/use-agenda-google'
import { formatAgendaTimePt } from '@/lib/agenda/calendar-event-utils'
import {
  AGENDA_SITUACOES,
  diaDoEvento,
  eventoJaComecou,
  origemETitulo,
  rotuloDia,
  SEM_ORIGEM,
  situacaoDoEvento,
} from '@/lib/agenda/agenda-filtros'
import { formatEventDescriptionForDisplay } from '@/lib/agenda/event-present'
import type { AgendaEvento } from '@/lib/services/agenda-google-client'
import { cn } from '@/lib/utils'

const COLUNAS = 4

const pararClique = (e: MouseEvent) => e.stopPropagation()

interface AgendaEventosTabelaProps {
  eventos: readonly AgendaEvento[]
  totalPorDia: ReadonlyMap<number, number>
  abertos: ReadonlySet<string>
  onAlternar: (id: string) => void
  agenda: AgendaGoogle
}

export function AgendaEventosTabela({ eventos, totalPorDia, abertos, onAlternar, agenda }: AgendaEventosTabelaProps) {
  const { presencas, confirmando, linksCampo, agora, proximoAlertaId, podeMarcar } = agenda

  return (
    <div className={tseTabela.container} data-tse-tabela>
      <table className={tseTabela.table}>
        <thead className={tseTabela.thead}>
          <tr>
            <th className={cn(tseTabela.th, 'w-16 sm:w-20')}>Hora</th>
            <th className={tseTabela.th}>Compromisso</th>
            <th className={cn(tseTabela.th, 'hidden w-40 sm:table-cell')}>Situação</th>
            <th className="w-8" aria-label="Detalhes" />
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento, i) => {
            const dia = diaDoEvento(evento)
            const diaAnterior = i > 0 ? diaDoEvento(eventos[i - 1]) : undefined
            const novoDia = dia !== diaAnterior
            const { origem, titulo } = origemETitulo(evento)
            const presenca = presencas[evento.id]
            const situacao = AGENDA_SITUACOES.find((s) => s.id === situacaoDoEvento(presenca)) ?? AGENDA_SITUACOES[3]
            const aberto = abertos.has(evento.id)
            const passado = eventoJaComecou(evento, agora)
            const iminente = proximoAlertaId === evento.id
            const descricao = formatEventDescriptionForDisplay(evento.description)
            const campo = linksCampo[evento.id]

            return (
              <Fragment key={evento.id}>
                {novoDia && dia != null ? (
                  <tr className="border-t border-[#EEEEEE] bg-[var(--tse-bar)]">
                    <td
                      colSpan={COLUNAS}
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-gold-text)]"
                    >
                      {rotuloDia(dia, agora)}
                      <span className="ml-2 font-semibold normal-case tracking-normal text-[var(--tse-muted)]">
                        · {totalPorDia.get(dia) ?? 0} {(totalPorDia.get(dia) ?? 0) === 1 ? 'compromisso' : 'compromissos'}
                      </span>
                    </td>
                  </tr>
                ) : null}
                <tr
                  className={cn(
                    tseTabela.trClicavel,
                    iminente && 'bg-[var(--tse-yellow-soft)] shadow-[inset_3px_0_0_var(--tse-yellow)]',
                  )}
                  onClick={() => onAlternar(evento.id)}
                  aria-expanded={aberto}
                >
                  <td className={cn(tseTabela.td, 'align-top')}>
                    <span className={cn('text-[15px] font-black tabular-nums', passado && 'text-[var(--tse-muted)]')}>
                      {formatAgendaTimePt(evento)}
                    </span>
                    {iminente ? (
                      <span className="mt-0.5 block text-[10px] font-bold uppercase text-[var(--tse-gold-text)]">
                        Em instantes
                      </span>
                    ) : null}
                  </td>
                  <td className={cn(tseTabela.td, 'align-top')}>
                    <p className="font-bold leading-snug">
                      {origem !== SEM_ORIGEM ? (
                        <span className="mr-1.5 inline-flex rounded bg-[var(--tse-yellow-soft)] px-1.5 py-px align-middle text-[10px] font-bold uppercase text-[var(--tse-gold-text)]">
                          {origem}
                        </span>
                      ) : null}
                      {titulo}
                    </p>
                    {evento.location ? (
                      <p className="mt-0.5 flex items-start gap-1 text-[12px] text-[var(--tse-muted)]">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                        <span className="min-w-0 break-words">{evento.location}</span>
                      </p>
                    ) : null}
                    <div
                      className="mt-2 flex cursor-default flex-wrap items-center gap-2"
                      onClick={pararClique}
                    >
                      <span className="sm:hidden">
                        <TseStatus cor={situacao.cor}>{situacao.rotulo}</TseStatus>
                      </span>
                      {podeMarcar ? (
                        <>
                          <MarcadorAtendimento
                            valor={presenca?.attended ?? null}
                            onChange={(v) => void agenda.marcarAtendimento(evento.id, v)}
                          />
                          {presenca?.arrival_time ? null : (
                            <button
                              type="button"
                              onClick={() => void agenda.confirmarChegada(evento)}
                              disabled={confirmando[evento.id]}
                              className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--tse-olive)] px-2.5 text-[12px] font-bold text-white hover:bg-[#58701B] disabled:opacity-60"
                            >
                              {confirmando[evento.id] ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                              Chegou
                            </button>
                          )}
                          <AgendaToCampoButton event={evento} linked={campo} onLinked={agenda.vincularCampo} />
                        </>
                      ) : (
                        <span className="text-[12px] text-[var(--tse-muted)]">Entre para marcar</span>
                      )}
                      {presenca?.arrival_time ? (
                        <ArrivalTimer arrivalTime={presenca.arrival_time} className="sm:hidden" />
                      ) : null}
                    </div>
                  </td>
                  <td className={cn(tseTabela.td, 'hidden align-top sm:table-cell')}>
                    <TseStatus cor={situacao.cor}>{situacao.rotulo}</TseStatus>
                    {presenca?.arrival_time ? (
                      <ArrivalTimer arrivalTime={presenca.arrival_time} className="mt-1.5" />
                    ) : null}
                  </td>
                  <TseChevronCelula aberta={aberto} />
                </tr>
                {aberto ? (
                  <tr className="bg-[var(--tse-bar)]">
                    <td colSpan={COLUNAS} className="px-4 py-3">
                      <div className="grid gap-4 text-[13px] md:grid-cols-[1fr_260px]">
                        <div>
                          <p className={detalheRotulo}>Descrição</p>
                          <p className="mt-1 whitespace-pre-line leading-relaxed">
                            {descricao ?? <span className="text-[var(--tse-muted)]">Sem descrição no calendário.</span>}
                          </p>
                        </div>
                        <div className="space-y-3">
                          {evento.attendees?.length ? (
                            <div>
                              <p className={cn(detalheRotulo, 'flex items-center gap-1')}>
                                <Users className="h-3 w-3" aria-hidden />
                                Participantes ({evento.attendees.length})
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {evento.attendees.map((a) => (
                                  <li key={a.email} className="truncate">
                                    {a.displayName || a.email}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {campo?.status === 'concluida' ? (
                            <p className="text-[12px] font-semibold text-[var(--tse-olive)]">
                              Check-in em Campo sincronizado
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const detalheRotulo = 'text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]'

function MarcadorAtendimento({ valor, onChange }: { valor: boolean | null; onChange: (v: boolean) => void }) {
  const opcoes = [
    { v: true, label: 'Atendido' },
    { v: false, label: 'Não atendido' },
  ] as const
  return (
    <div className="flex overflow-hidden rounded-md border border-[var(--tse-border)] text-[12px] font-semibold">
      {opcoes.map((o) => {
        const ativo = valor === o.v
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={ativo}
            onClick={() => onChange(o.v)}
            className={cn(
              'h-7 px-2.5',
              ativo
                ? o.v
                  ? 'bg-[var(--tse-green)] text-white'
                  : 'bg-[var(--tse-muted)] text-white'
                : 'bg-white text-[var(--tse-muted)] hover:bg-[var(--tse-bar)]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
