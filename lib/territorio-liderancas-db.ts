/**
 * Leitura de lideranças / expectativa a partir de public.territorio_liderancas.
 * Substitui a planilha Território (VOTAÇÃO FINAL) no hot path do Atendimento.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { deveIncluirLiderancaPlanilha } from '@/lib/territorio-lideranca-atual'
import { extrairDepEstadualDeLideranca } from '@/lib/planilha-dep-estadual-lideranca'
import {
  normalizeTerritorioExpectativaCityKey,
  resolveCityLeaders,
  resolveCitySummary,
  type LiderancaResumo,
  type ResumoCidade,
} from '@/lib/territorio-expectativa-sheet'

export type TerritorioLiderancaRow = {
  id: number
  municipio: string
  municipio_normalizado: string
  lideranca: string
  senador_1: string | null
  senador_2: string | null
  dep_estadual: string | null
  lideranca_atual: string | null
  cargo_2020: string | null
  cargo_2024: string | null
  votos_2020: number | null
  votos_2024: number | null
  promessa_lideranca_2026: number | null
  expectativa_jadyel_2026: number | null
  votacao_final_2022: number | null
  expectativa_votos_2026: number | null
  em_dialogo: boolean | null
  ativo: boolean | null
}

type CitySummaryCache = {
  expiresAt: number
  summaries: Map<string, ResumoCidade>
  leadersByCity: Map<string, LiderancaResumo[]>
}

const CACHE_TTL_MS = 5 * 60 * 1000
let cache: CitySummaryCache | null = null

function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function listAllTerritorioLiderancas(): Promise<TerritorioLiderancaRow[]> {
  return fetchAllLiderancasRows()
}

async function fetchAllLiderancasRows(): Promise<TerritorioLiderancaRow[]> {
  const admin = createAdminClient()
  const rows: TerritorioLiderancaRow[] = []
  let from = 0
  const page = 1000

  for (;;) {
    const { data, error } = await admin
      .from('territorio_liderancas')
      .select(
        [
          'id',
          'municipio',
          'municipio_normalizado',
          'lideranca',
          'senador_1',
          'senador_2',
          'dep_estadual',
          'lideranca_atual',
          'cargo_2020',
          'cargo_2024',
          'votos_2020',
          'votos_2024',
          'promessa_lideranca_2026',
          'expectativa_jadyel_2026',
          'votacao_final_2022',
          'expectativa_votos_2026',
          'em_dialogo',
          'ativo',
        ].join(', '),
      )
      .eq('ativo', true)
      .order('id', { ascending: true })
      .range(from, from + page - 1)

    if (error) {
      throw new Error(`Erro ao ler territorio_liderancas: ${error.message}`)
    }
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as TerritorioLiderancaRow[]))
    if (data.length < page) break
    from += page
  }

  return rows
}

function shouldIncludeDbRow(row: TerritorioLiderancaRow): boolean {
  return deveIncluirLiderancaPlanilha(
    {
      lideranca_atual: row.lideranca_atual,
      expectativa_jadyel_2026: row.expectativa_jadyel_2026,
      promessa_lideranca_2026: row.promessa_lideranca_2026,
      expectativa_votos_2026: row.expectativa_votos_2026,
    },
    {
      liderancaAtualCol: 'lideranca_atual',
      colunasVotos: [
        'expectativa_jadyel_2026',
        'promessa_lideranca_2026',
        'expectativa_votos_2026',
      ],
    },
  )
}

export function invalidateTerritorioLiderancasDbCache(): void {
  cache = null
}

export async function listTerritorioLiderancasByCidade(cidade: string): Promise<TerritorioLiderancaRow[]> {
  const admin = createAdminClient()
  const key = normalizeTerritorioExpectativaCityKey(cidade)
  if (!key) return []

  const { data, error } = await admin
    .from('territorio_liderancas')
    .select(
      [
        'id',
        'municipio',
        'municipio_normalizado',
        'lideranca',
        'senador_1',
        'senador_2',
        'dep_estadual',
        'lideranca_atual',
        'cargo_2020',
        'cargo_2024',
        'votos_2020',
        'votos_2024',
        'promessa_lideranca_2026',
        'expectativa_jadyel_2026',
        'votacao_final_2022',
        'expectativa_votos_2026',
        'em_dialogo',
        'ativo',
      ].join(', '),
    )
    .eq('ativo', true)
    .eq('municipio_normalizado', key)
    .order('expectativa_votos_2026', { ascending: false })
    .order('lideranca', { ascending: true })

  if (error) {
    throw new Error(`Erro ao listar lideranças: ${error.message}`)
  }
  return (data as unknown as TerritorioLiderancaRow[]) || []
}

/**
 * Agrega por município no mesmo formato de `buildCitySummaries` (planilha).
 * Legado = `expectativa_votos_2026` → `expectativaLegadoVotos` / `projecaoLegado`.
 */
export async function buildCitySummariesFromDb(forceRefresh = false): Promise<{
  summaries: Map<string, ResumoCidade>
  leadersByCity: Map<string, LiderancaResumo[]>
}> {
  const now = Date.now()
  if (!forceRefresh && cache && cache.expiresAt > now) {
    return { summaries: cache.summaries, leadersByCity: cache.leadersByCity }
  }

  const rows = await fetchAllLiderancasRows()
  const summaries = new Map<string, ResumoCidade>()
  const leadersAccumulator = new Map<string, Map<string, LiderancaResumo>>()

  for (const row of rows) {
    const cidadeKey =
      row.municipio_normalizado ||
      normalizeTerritorioExpectativaCityKey(row.municipio || '')
    if (!cidadeKey) continue

    const current = summaries.get(cidadeKey) || {
      expectativaVotos: 0,
      promessaVotos: 0,
      expectativaLegadoVotos: 0,
      votacaoFinal2022: 0,
      liderancas: 0,
    }

    current.votacaoFinal2022 += num(row.votacao_final_2022)

    if (!shouldIncludeDbRow(row)) {
      summaries.set(cidadeKey, current)
      continue
    }

    const expectativaAferida = num(row.expectativa_jadyel_2026)
    const promessa = num(row.promessa_lideranca_2026)
    const legado = num(row.expectativa_votos_2026)

    current.expectativaVotos += expectativaAferida
    current.promessaVotos += promessa
    current.expectativaLegadoVotos += legado
    current.liderancas += 1
    summaries.set(cidadeKey, current)

    const nome = String(row.lideranca || '').trim()
    if (!nome) continue

    const cargo = String(row.cargo_2024 || row.cargo_2020 || '').trim() || '-'
    const depEstadual = extrairDepEstadualDeLideranca({
      nome,
      cargo,
      depEstadual: String(row.dep_estadual || '').trim(),
    })
    const emDialogo = Boolean(row.em_dialogo) || /di[aá]logo/i.test(String(row.lideranca_atual || ''))
    const key = `${nome.toUpperCase()}|${cargo.toUpperCase()}`
    const cityLeaders = leadersAccumulator.get(cidadeKey) || new Map<string, LiderancaResumo>()
    const leaderCurrent = cityLeaders.get(key) || {
      nome,
      cargo,
      depEstadual,
      projecaoVotos: 0,
      projecaoAferida: 0,
      projecaoPromessa: 0,
      projecaoLegado: 0,
      emDialogo: false,
    }
    if (depEstadual && !leaderCurrent.depEstadual) {
      leaderCurrent.depEstadual = depEstadual
    }
    if (emDialogo) leaderCurrent.emDialogo = true
    leaderCurrent.projecaoAferida += expectativaAferida
    leaderCurrent.projecaoPromessa += promessa
    leaderCurrent.projecaoLegado += legado
    // Padrão do sistema: Legado como base de votos exibida
    leaderCurrent.projecaoVotos = leaderCurrent.projecaoLegado
    cityLeaders.set(key, leaderCurrent)
    leadersAccumulator.set(cidadeKey, cityLeaders)
  }

  const leadersByCity = new Map<string, LiderancaResumo[]>()
  leadersAccumulator.forEach((cityMap, cityKey) => {
    leadersByCity.set(
      cityKey,
      Array.from(cityMap.values()).sort(
        (a, b) =>
          b.projecaoLegado - a.projecaoLegado || a.nome.localeCompare(b.nome, 'pt-BR'),
      ),
    )
  })

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    summaries,
    leadersByCity,
  }

  return { summaries, leadersByCity }
}

export {
  normalizeTerritorioExpectativaCityKey,
  resolveCityLeaders,
  resolveCitySummary,
}
