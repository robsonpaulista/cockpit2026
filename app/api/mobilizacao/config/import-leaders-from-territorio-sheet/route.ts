import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import {
  buildCitySummaries,
  getTerritorioExpectativaSheetConfig,
  getTerritorioExpectativaSheetCredentials,
  normalizeTerritorioExpectativaCityKey,
} from '@/lib/territorio-expectativa-sheet'
import { getTerritorioDesenvolvimentoPI, getTodosMunicipiosPIOficiaisOrdenados } from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

export const dynamic = 'force-dynamic'

/** Pedido explícito: não importar lideranças destes municípios (planilha Território). */
const MUNICIPIOS_EXCLUIDOS = new Set(['Parnaíba', 'Campo Maior'])

function normLeaderNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function leaderDedupeKey(municipio: string, nome: string): string {
  return `${normalizeMunicipioNome(municipio)}|${normLeaderNome(nome)}`
}

function canonMunicipioFromSheetCityKey(cityKey: string): string | null {
  for (const canon of getTodosMunicipiosPIOficiaisOrdenados()) {
    if (normalizeTerritorioExpectativaCityKey(canon) === cityKey) return canon
  }
  return null
}

export async function POST() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const sheetBody: Record<string, unknown> = {}
  const { spreadsheetId, sheetName, range } = getTerritorioExpectativaSheetConfig(sheetBody)
  const credentialsObj = getTerritorioExpectativaSheetCredentials(undefined, 'territorio')

  if (!spreadsheetId || !sheetName || !credentialsObj) {
    return NextResponse.json(
      { error: 'Planilha do Território ou credenciais Google não configuradas (variáveis de ambiente).' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const [{ data: coordinatorsRows, error: coordErr }, { leadersByCity }] = await Promise.all([
    admin.from('coordinators').select('id, regiao, nome').order('nome', { ascending: true }),
    buildCitySummaries(spreadsheetId, sheetName, range, credentialsObj),
  ])

  if (coordErr) {
    console.error('[import-leaders-from-territorio-sheet] coordinators', coordErr)
    return NextResponse.json({ error: 'Erro ao carregar coordenadores.' }, { status: 500 })
  }

  const tdToCoordinatorId = new Map<string, string>()
  for (const row of coordinatorsRows ?? []) {
    const regiao = String((row as { regiao?: string | null }).regiao ?? '').trim()
    const id = String((row as { id: string }).id)
    if (!regiao || !id) continue
    if (!tdToCoordinatorId.has(regiao)) tdToCoordinatorId.set(regiao, id)
  }

  const existingKeys = new Set<string>()
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await admin.from('leaders').select('nome, municipio').range(from, from + pageSize - 1)
    if (error) {
      console.error('[import-leaders-from-territorio-sheet] leaders prefetch', error)
      return NextResponse.json({ error: 'Erro ao ler lideranças existentes.' }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break
    for (const r of rows as { nome: string; municipio: string | null }[]) {
      const mun = r.municipio?.trim() ?? ''
      if (mun && r.nome) existingKeys.add(leaderDedupeKey(mun, r.nome))
    }
    if (rows.length < pageSize) break
    from += pageSize
  }

  const toInsert: {
    nome: string
    telefone: null
    municipio: string
    cidade: string
    coordinator_id: string | null
  }[] = []

  let skippedExcludedMunicipio = 0
  let skippedUnknownCity = 0
  let skippedNoTd = 0
  let skippedDuplicate = 0
  let skippedShortName = 0

  for (const [cityKey, lista] of leadersByCity.entries()) {
    const canon = canonMunicipioFromSheetCityKey(cityKey)
    if (!canon) {
      skippedUnknownCity += lista.length
      continue
    }
    if (MUNICIPIOS_EXCLUIDOS.has(canon)) {
      skippedExcludedMunicipio += lista.length
      continue
    }
    const td = getTerritorioDesenvolvimentoPI(canon)
    if (!td) {
      skippedNoTd += lista.length
      continue
    }
    const coordinatorId = tdToCoordinatorId.get(td) ?? null

    for (const l of lista) {
      const nome = String(l.nome ?? '').trim()
      if (nome.length < 2) {
        skippedShortName += 1
        continue
      }
      const k = leaderDedupeKey(canon, nome)
      if (existingKeys.has(k)) {
        skippedDuplicate += 1
        continue
      }
      existingKeys.add(k)
      toInsert.push({
        nome,
        telefone: null,
        municipio: canon,
        cidade: canon,
        coordinator_id: coordinatorId,
      })
    }
  }

  const insertedSemCoordenador = toInsert.filter((r) => r.coordinator_id == null).length

  const INSERT_CHUNK = 50
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK)
    const { error } = await admin.from('leaders').insert(chunk)
    if (error) {
      console.error('[import-leaders-from-territorio-sheet] insert', error)
      return NextResponse.json(
        {
          error: 'Erro ao inserir lideranças no banco.',
          details: error.message,
          insertedSoFar: inserted,
        },
        { status: 500 }
      )
    }
    inserted += chunk.length
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skippedDuplicate,
    skippedExcludedMunicipio,
    skippedUnknownCity,
    skippedNoTd,
    skippedShortName,
    insertedSemCoordenador,
    message:
      inserted > 0
        ? `${inserted} liderança(s) importada(s) da planilha do Território (exceto Parnaíba e Campo Maior).`
        : 'Nenhuma liderança nova para importar (tudo já cadastrado, filtrado ou sem linhas na planilha).',
  })
}
