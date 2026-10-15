import { ARENA_INICIO } from '@/lib/arena/pontuacao'
import type { ArenaIntervalo } from '@/lib/arena/types'

export type ArenaPeriodo = 'semana' | 'mes' | 'tudo' | 'personalizado'

export const ARENA_PERIODOS: { id: ArenaPeriodo; rotulo: string }[] = [
  { id: 'semana', rotulo: 'Semana' },
  { id: 'mes', rotulo: 'Mês' },
  { id: 'tudo', rotulo: 'Tudo' },
  { id: 'personalizado', rotulo: 'Personalizado' },
]

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

/** Data `AAAA-MM-DD` no fuso de Brasília. */
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function lerPeriodo(valor: string | null): ArenaPeriodo {
  return valor === 'semana' || valor === 'mes' || valor === 'personalizado' ? valor : 'tudo'
}

/** Intervalo do filtro; "Tudo" (e personalizado incompleto) vai do início da Arena até hoje. */
export function intervaloDoPeriodo(
  periodo: ArenaPeriodo,
  de: string | null,
  ate: string | null,
): ArenaIntervalo {
  const hoje = hojeBrasilia()
  if (periodo === 'semana') return { inicio: somarDias(hoje, -6), fim: hoje }
  if (periodo === 'mes') return { inicio: somarDias(hoje, -29), fim: hoje }
  if (periodo === 'personalizado' && de && ate && DATA_ISO.test(de) && DATA_ISO.test(ate)) {
    return de <= ate ? { inicio: de, fim: ate } : { inicio: ate, fim: de }
  }
  return { inicio: ARENA_INICIO, fim: hoje }
}
