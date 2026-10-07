import {
  getCalendarEventDate,
  startOfLocalDay,
  type CalendarEventRow,
} from '@/lib/agenda/calendar-event-utils'
import { parseEventOriginFromSummary, stripHtmlForAgenda } from '@/lib/agenda/event-present'

export type AgendaPeriodo = 'todos' | 'hoje' | 'amanha' | '7d' | '30d'

/** A API devolve de hoje até +45 dias, então "todos" é essa janela. */
export const AGENDA_PERIODOS: ReadonlyArray<{ id: AgendaPeriodo; label: string }> = [
  { id: 'todos', label: 'Todos os compromissos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'amanha', label: 'Amanhã' },
  { id: '7d', label: 'Próximos 7 dias' },
  { id: '30d', label: 'Próximos 30 dias' },
]

function inicioDoDia(base: number, deslocamentoDias: number): number {
  const d = startOfLocalDay(new Date(base))
  d.setDate(d.getDate() + deslocamentoDias)
  return d.getTime()
}

export function noPeriodo(dia: number, periodo: AgendaPeriodo, agora: number): boolean {
  const hoje = inicioDoDia(agora, 0)
  switch (periodo) {
    case 'hoje':
      return dia === hoje
    case 'amanha':
      return dia === inicioDoDia(agora, 1)
    case '7d':
      return dia >= hoje && dia < inicioDoDia(agora, 7)
    case '30d':
      return dia >= hoje && dia < inicioDoDia(agora, 30)
    default:
      return true
  }
}

export type AgendaSituacao = 'aguardando' | 'atendido' | 'nao-atendido' | 'sem-marcacao'

export const AGENDA_SITUACOES: ReadonlyArray<{ id: AgendaSituacao; label: string; rotulo: string; cor: string }> = [
  { id: 'aguardando', label: 'Aguardando atendimento', rotulo: 'Aguardando', cor: 'var(--tse-yellow)' },
  { id: 'atendido', label: 'Atendidos', rotulo: 'Atendido', cor: 'var(--tse-green)' },
  { id: 'nao-atendido', label: 'Não atendidos', rotulo: 'Não atendido', cor: 'var(--tse-muted)' },
  { id: 'sem-marcacao', label: 'Não marcados', rotulo: 'Não marcado', cor: 'var(--tse-zero)' },
]

export function situacaoDoEvento(presenca?: { attended: boolean | null; arrival_time?: string }): AgendaSituacao {
  if (presenca?.attended === true) return 'atendido'
  if (presenca?.attended === false) return 'nao-atendido'
  if (presenca?.arrival_time) return 'aguardando'
  return 'sem-marcacao'
}

const CORES_ORIGEM = [
  'var(--tse-yellow)',
  'var(--tse-green)',
  'var(--tse-olive)',
  'var(--tse-gold-text)',
  'var(--tse-muted)',
  'var(--tse-zero)',
] as const

export const SEM_ORIGEM = 'Sem origem'

export function corDaOrigem(indice: number): string {
  return CORES_ORIGEM[indice % CORES_ORIGEM.length]
}

/** Origem é o prefixo entre parênteses do título: "(THE - PI) Reunião…". */
export function origemETitulo(evento: CalendarEventRow): { origem: string; titulo: string } {
  const { origin, title } = parseEventOriginFromSummary(stripHtmlForAgenda(evento.summary ?? ''))
  return { origem: origin || SEM_ORIGEM, titulo: title }
}

/** Dia local do compromisso (eventos de dia inteiro não escorregam para o dia anterior). */
export function diaDoEvento(evento: CalendarEventRow): number | null {
  const data = getCalendarEventDate(evento)
  return data ? startOfLocalDay(data).getTime() : null
}

export function chaveDia(dia: number): string {
  const d = new Date(dia)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function diaDaChave(chave: string): number {
  const [ano, mes, dia] = chave.split('-').map(Number)
  return new Date(ano, mes - 1, dia).getTime()
}

export function rotuloDia(dia: number, agora: number): string {
  const d = new Date(dia)
  const base = d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .replace('.', '')
  const hoje = inicioDoDia(agora, 0)
  if (dia === hoje) return `Hoje · ${base}`
  if (dia === inicioDoDia(agora, 1)) return `Amanhã · ${base}`
  return base
}

/** Já começou: compromisso com horário no passado, ou de dia inteiro em dia anterior. */
export function eventoJaComecou(evento: CalendarEventRow, agora: number): boolean {
  if (evento.start?.dateTime) return new Date(evento.start.dateTime).getTime() <= agora
  const dia = diaDoEvento(evento)
  return dia != null && dia < inicioDoDia(agora, 0)
}
