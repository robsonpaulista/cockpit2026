import {
  agendaFluxoKeyForVisita,
  diffDayKeys,
  isAgendaParaConhecimento,
  listAgendaVisitasProximas,
  todayKeyInTz,
  type WarRoomAgendaVisita,
} from '@/lib/war-room/agenda-proximos'

/** Urgente: hoje + 2 dias seguintes (3 dias civis, hoje incluso). */
export const WR_DECISOES_VIAGENS_JANELA_DIAS = 3
import {
  countAgendaFluxoProgress,
  isAgendaFluxoIncompleto,
  listAgendaFluxoEtapasPendentes,
  resolveAgendaFluxoStateForFila,
} from '@/lib/war-room/agenda-fluxo'
import type { WarRoomDecisao, WarRoomDecisaoPrioridade } from '@/lib/war-room/decisoes'
import type { WarRoomDisparo } from '@/lib/war-room/mock-data'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'

function diasAteVisita(dataKey: string, hojeKey: string): number {
  const dias = diffDayKeys(hojeKey, dataKey)
  return Number.isFinite(dias) ? dias : 99
}

function prioridadePorProximidade(dias: number): WarRoomDecisaoPrioridade {
  if (dias <= 0) return 'critica'
  if (dias === 1) return 'alta'
  if (dias <= 3) return 'media'
  return 'baixa'
}

export function decisaoFromVisitaFluxoIncompleto(
  visita: WarRoomAgendaVisita,
  opts: {
    hojeKey: string
    disparos: WarRoomDisparo[]
    /** Nome oficial do município (Expectativa / IPT). */
    municipioLabel: string
  },
): WarRoomDecisao | null {
  const fluxoKey = agendaFluxoKeyForVisita(visita)
  const state = resolveAgendaFluxoStateForFila({
    municipio: opts.municipioLabel,
    fluxoKey,
    temAgendamento: true,
    disparos: opts.disparos,
  })

  if (!isAgendaFluxoIncompleto(state)) return null

  const progress = countAgendaFluxoProgress(state)
  const pendentes = listAgendaFluxoEtapasPendentes(state)
  const dias = diasAteVisita(visita.dataKey, opts.hojeKey)
  const prioridade = prioridadePorProximidade(dias)
  const etapasTxt =
    pendentes.length === 1
      ? `1 etapa pendente (${pendentes[0].titulo})`
      : `${pendentes.length} etapas pendentes`

  return {
    id: `visita-fluxo:${visita.municipioKey}:${fluxoKey}`,
    prioridade,
    problema: `Ver cidade ${opts.municipioLabel}`,
    categoria: 'Visita agendada',
    hora: `${visita.dataLabel} ${visita.horario}`,
    icone: 'bandeira',
    destaque: prioridade === 'critica' || prioridade === 'alta',
    contexto: visita.municipioKey,
    prazo: visita.dataLabel,
    acao: `${etapasTxt} · ${progress.pct}%`,
    status: 'pendente',
    createdAt: `${visita.dataKey}T${visita.horario === '—' ? '00:00' : visita.horario}:00`,
  }
}

export type BuildDecisoesVisitasOpts = {
  hojeKey?: string
  /**
   * Dias civis a partir de hoje (incluso).
   * Default {@link WR_DECISOES_VIAGENS_JANELA_DIAS} = hoje + amanhã + depois.
   */
  janelaDias?: number
  /**
   * Universo da Expectativa de votos: chave normalizada → nome oficial.
   * Só entram visitas cujo município casa com esse mapa (mesmo match do ícone de agenda).
   */
  municipiosExpectativa: Map<string, string>
}

/**
 * Alertas da fila: cidades da Expectativa com agendamento na janela
 * (hoje incluso) e fluxo operacional incompleto (1 item por cidade — próxima visita).
 */
export function buildDecisoesVisitasFluxoIncompleto(
  events: CalendarEventRow[],
  disparos: WarRoomDisparo[],
  opts: BuildDecisoesVisitasOpts,
): WarRoomDecisao[] {
  if (opts.municipiosExpectativa.size === 0) return []

  const hojeKey = opts.hojeKey ?? todayKeyInTz()
  const janelaDias = Math.max(
    1,
    opts.janelaDias ?? WR_DECISOES_VIAGENS_JANELA_DIAS,
  )
  const eventsFiltrados = events.filter(
    (event) => !isAgendaParaConhecimento(event.summary || ''),
  )
  const visitas = listAgendaVisitasProximas(eventsFiltrados, {
    hojeKey,
    janelaDias,
  }).filter((v) => opts.municipiosExpectativa.has(v.municipioKey))

  // Uma entrada por cidade: a visita mais próxima com fluxo incompleto.
  const porCidade = new Map<string, WarRoomDecisao>()

  for (const visita of visitas) {
    if (porCidade.has(visita.municipioKey)) continue

    const municipioLabel =
      opts.municipiosExpectativa.get(visita.municipioKey) ?? visita.municipioLabel

    const decisao = decisaoFromVisitaFluxoIncompleto(visita, {
      hojeKey,
      disparos,
      municipioLabel,
    })
    if (decisao) porCidade.set(visita.municipioKey, decisao)
  }

  return [...porCidade.values()]
}
