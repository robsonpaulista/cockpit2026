/**
 * Formato compatível com a aba Base (antigos headers da planilha),
 * alimentado por public.territorio_liderancas.
 */

import type { TerritorioLiderancaRow } from '@/lib/territorio-liderancas-db'

/** Cabeçalhos canônicos — regex da UI da Base já os reconhece. */
export const TERRITORIO_BASE_HEADERS = [
  'id',
  'CIDADE',
  'LIDERANÇA',
  'CARGO 2024',
  'DEP. ESTADUAL',
  'LIDERANÇA ATUAL',
  'EXPECTATIVA DE VOTOS 2026',
  'EXPECTATIVA JADYEL 2026',
  'PROMESSA LIDERANÇA 2026',
  'VOTAÇÃO FINAL 2022',
] as const

export type TerritorioBaseRecord = Record<(typeof TERRITORIO_BASE_HEADERS)[number], string | number>

export function mapTerritorioLiderancaToBaseRecord(row: TerritorioLiderancaRow): TerritorioBaseRecord {
  return {
    id: Number(row.id),
    CIDADE: String(row.municipio || '').trim(),
    LIDERANÇA: String(row.lideranca || '').trim(),
    'CARGO 2024': String(row.cargo_2024 || row.cargo_2020 || '').trim() || '-',
    'DEP. ESTADUAL': String(row.dep_estadual || '').trim(),
    'LIDERANÇA ATUAL': String(row.lideranca_atual || '').trim(),
    'EXPECTATIVA DE VOTOS 2026': Number(row.expectativa_votos_2026 || 0),
    'EXPECTATIVA JADYEL 2026': Number(row.expectativa_jadyel_2026 || 0),
    'PROMESSA LIDERANÇA 2026': Number(row.promessa_lideranca_2026 || 0),
    'VOTAÇÃO FINAL 2022': Number(row.votacao_final_2022 || 0),
  }
}
