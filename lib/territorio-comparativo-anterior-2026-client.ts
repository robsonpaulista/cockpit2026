import {
  agregarExpectativaPorCidade,
  agregarLiderancasPorCidade,
  buildComparativoExpectativa2022Lista,
  labelCenarioExpectativaComparativo,
  CENARIO_EXPECTATIVA_ANTERIOR_2026,
  summarizeComparativoExpectativa2022,
  type ComparativoExpectativa2022Resumo,
  type ComparativoExpectativa2022Row,
} from '@/lib/comparativo-expectativa-2022'
import { fetchJadyelFederal2022VotosPorMunicipioPI } from '@/lib/jadyel-federal-2022-pi-votos'
import { deveIncluirLiderancaPlanilha } from '@/lib/territorio-lideranca-atual'

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') return value

  const str = String(value).trim()
  if (!str) return 0

  let cleaned = str.replace(/[^\d.,]/g, '')

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const numValue = parseFloat(cleaned)
  return Number.isNaN(numValue) ? 0 : numValue
}

export function resolveExpectativaLegadoCol(headers: string[]): string | undefined {
  return headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) &&
        !/jadyel/i.test(normalized) &&
        !/promessa/i.test(normalized) &&
        !/aferid[oa]/i.test(normalized))
    )
  })
}

export function resolveCidadeCol(headers: string[]): string {
  return headers.find((h) => /cidade|city|município|municipio/i.test(h)) || headers[1] || 'cidade'
}

export function resolveLiderancaAtualCol(headers: string[]): string | undefined {
  return headers.find((h) => /liderança atual|lideranca atual|atual\?/i.test(h))
}

export function filterLiderancasParaComparativo(
  records: Array<Record<string, unknown>>,
  liderancaAtualCol: string | undefined,
  expectativaCol: string | undefined
): Array<Record<string, unknown>> {
  return records.filter((record) =>
    deveIncluirLiderancaPlanilha(record, {
      liderancaAtualCol,
      colunasVotos: [expectativaCol],
    })
  )
}

export type ComparativoAnterior2026LoadResult =
  | {
      ok: true
      rows: ComparativoExpectativa2022Row[]
      resumo: ComparativoExpectativa2022Resumo
      cenarioLabel: string
    }
  | {
      ok: false
      error: string
    }

const COMPARATIVO_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000
let comparativoClientCache: { expiresAt: number; result: ComparativoAnterior2026LoadResult } | null = null
let comparativoClientInflight: Promise<ComparativoAnterior2026LoadResult> | null = null

/** Mesma origem da aba Base: planilha Território + votos 2022 (Dep. Federal). */
export async function loadComparativoAnterior2026Client(): Promise<ComparativoAnterior2026LoadResult> {
  const now = Date.now()
  if (comparativoClientCache && comparativoClientCache.expiresAt > now) {
    return comparativoClientCache.result
  }
  if (comparativoClientInflight) return comparativoClientInflight

  comparativoClientInflight = loadComparativoAnterior2026ClientUncached()
    .then((result) => {
      comparativoClientCache = { expiresAt: Date.now() + COMPARATIVO_CLIENT_CACHE_TTL_MS, result }
      return result
    })
    .finally(() => {
      comparativoClientInflight = null
    })

  return comparativoClientInflight
}

async function loadComparativoAnterior2026ClientUncached(): Promise<ComparativoAnterior2026LoadResult> {
  try {
    const [sheetRes, votos2022Result] = await Promise.all([
      fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      fetchJadyelFederal2022VotosPorMunicipioPI(),
    ])

    const sheetData = (await sheetRes.json()) as {
      error?: string
      records?: Array<Record<string, unknown>>
      headers?: string[]
    }

    if (!sheetRes.ok) {
      return {
        ok: false,
        error: sheetData.error ?? 'Erro ao carregar planilha de Território & Base.',
      }
    }

    const headers = sheetData.headers ?? []
    const records = sheetData.records ?? []
    const expectativaCol = resolveExpectativaLegadoCol(headers)

    if (!expectativaCol) {
      return {
        ok: false,
        error: 'Coluna Expectativa 2026 não encontrada na planilha.',
      }
    }

    if (!votos2022Result?.mapaNormalizado) {
      return {
        ok: false,
        error: 'Não foi possível carregar os votos de Jadyel em 2022 (Dep. Federal).',
      }
    }

    const cidadeCol = resolveCidadeCol(headers)
    const liderancaAtualCol = resolveLiderancaAtualCol(headers)
    const filtradas = filterLiderancasParaComparativo(records, liderancaAtualCol, expectativaCol)

    const expectativaMap = agregarExpectativaPorCidade(
      filtradas,
      cidadeCol,
      expectativaCol,
      normalizeNumber
    )
    const liderancasMap = agregarLiderancasPorCidade(filtradas, cidadeCol)
    const rows = buildComparativoExpectativa2022Lista(
      expectativaMap,
      votos2022Result.mapaNormalizado,
      liderancasMap
    )

    return {
      ok: true,
      rows,
      resumo: summarizeComparativoExpectativa2022(rows),
      cenarioLabel: labelCenarioExpectativaComparativo(CENARIO_EXPECTATIVA_ANTERIOR_2026),
    }
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro ao montar comparativo territorial.',
    }
  }
}
