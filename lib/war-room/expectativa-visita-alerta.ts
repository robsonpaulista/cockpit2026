import type { IptMunicipio } from '@/lib/ipt'
import { todayKeyInTz } from '@/lib/war-room/agenda-proximos'

/** Prioridade alta: expectativa ≥ este limiar. */
export const WR_VISITA_ALERTA_EXPECTATIVA_MIN = 4000

/** Prioridade alta: dias sem visita para o bloco ≥ 4.000. */
export const WR_VISITA_ALERTA_DIAS = 10

/** Regra base: qualquer cidade com expectativa > 0 sem visita há este nº de dias. */
export const WR_VISITA_ALERTA_BASE_DIAS = 15

export type VisitaAlertaNivel = 'prioridade' | 'base'

function dataCurta(iso: string): string {
  const raw = iso.trim()
  return raw.includes('T') ? (raw.split('T')[0] ?? raw) : raw.slice(0, 10)
}

/** Data abreviada dd/mm. */
export function formatUltimaVisitaCurta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const raw = dataCurta(iso)
  const parts = raw.split('-')
  if (parts.length >= 3 && parts[2] && parts[1]) return `${parts[2]}/${parts[1]}`
  return null
}

/** Dias corridos desde a data (YYYY-MM-DD) até hoje (fuso da War Room). */
export function diasDesdeVisita(
  isoDate: string | null | undefined,
  hojeKey: string = todayKeyInTz(),
): number | null {
  if (!isoDate) return null
  const raw = dataCurta(isoDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const t0 = Date.parse(`${raw}T12:00:00`)
  const t1 = Date.parse(`${hojeKey}T12:00:00`)
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null
  return Math.floor((t1 - t0) / (24 * 60 * 60 * 1000))
}

function semVisitaHa(dias: number | null, limiarDias: number): boolean {
  if (dias == null) return true
  return dias >= limiarDias
}

/**
 * Nível do alerta de visita (avião):
 * - prioridade: expectativa ≥ 4.000 e sem visita há 10+ dias (ou nunca)
 * - base: expectativa > 0 e sem visita há 15+ dias (ou nunca)
 * A regra de prioridade eleva o bloco ≥ 4.000; ambas mostram o avião.
 */
export function nivelVisitaAlerta(
  m: IptMunicipio,
  opts?: { hojeKey?: string },
): VisitaAlertaNivel | null {
  const expectativa = m.expectativaVotos
  if (!Number.isFinite(expectativa) || expectativa <= 0) return null

  const dias = diasDesdeVisita(m.ultimaVisita, opts?.hojeKey)

  if (
    expectativa >= WR_VISITA_ALERTA_EXPECTATIVA_MIN &&
    semVisitaHa(dias, WR_VISITA_ALERTA_DIAS)
  ) {
    return 'prioridade'
  }

  if (expectativa > 0 && semVisitaHa(dias, WR_VISITA_ALERTA_BASE_DIAS)) {
    return 'base'
  }

  return null
}

/** Título/tooltip do avião conforme o nível. */
export function tituloVisitaAlerta(nivel: VisitaAlertaNivel): string {
  if (nivel === 'prioridade') {
    return `Prioridade · sem visita há ${WR_VISITA_ALERTA_DIAS}+ dias · expectativa ≥ ${WR_VISITA_ALERTA_EXPECTATIVA_MIN.toLocaleString('pt-BR')}`
  }
  return `Sem visita há ${WR_VISITA_ALERTA_BASE_DIAS}+ dias · expectativa > 0`
}

/**
 * Ícone de necessidade de visita (avião):
 * prioridade (≥4k / 10+ dias) OU base (>0 / 15+ dias).
 */
export function precisaVisitaAltaExpectativa(
  m: IptMunicipio,
  opts?: { hojeKey?: string },
): boolean {
  return nivelVisitaAlerta(m, opts) != null
}
