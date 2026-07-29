import type { IptMunicipio } from '@/lib/ipt'
import { todayKeyInTz } from '@/lib/war-room/agenda-proximos'

/** Limiar de expectativa para alerta de visita na War Room. */
export const WR_VISITA_ALERTA_EXPECTATIVA_MIN = 4000

/** Dias sem visita a partir dos quais o alerta aparece (cidades acima do limiar). */
export const WR_VISITA_ALERTA_DIAS = 10

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

/**
 * Ícone de necessidade de visita na Expectativa de votos:
 * expectativa ≥ 4.000 e sem visita há 10+ dias (ou nunca visitada).
 */
export function precisaVisitaAltaExpectativa(
  m: IptMunicipio,
  opts?: { hojeKey?: string },
): boolean {
  if (!Number.isFinite(m.expectativaVotos) || m.expectativaVotos < WR_VISITA_ALERTA_EXPECTATIVA_MIN) {
    return false
  }
  const dias = diasDesdeVisita(m.ultimaVisita, opts?.hojeKey)
  if (dias == null) return true
  return dias >= WR_VISITA_ALERTA_DIAS
}
