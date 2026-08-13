import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { importRecapItems } from '@/lib/obras-recap-store'

export const dynamic = 'force-dynamic'

const ABAS_PROTEGIDAS = new Set(['pavimentação', 'obras diversas'])

function normalizeColumnName(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
}

function parseMoney(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim().replace(/[R$\s]/g, '')
  let n = NaN
  if (s.includes(',') && s.includes('.')) {
    n = Number(s.replace(/\./g, '').replace(',', '.'))
  } else if (s.includes(',')) {
    n = Number(s.replace(',', '.'))
  } else {
    n = Number(s)
  }
  return Number.isFinite(n) ? n : null
}

type RawRow = Record<string, unknown>

/** Importa planilha para storage local JSON (sem Supabase). */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      obras?: RawRow[]
      tipo?: string
      replace?: boolean
    }

    const tipoAba = typeof body.tipo === 'string' ? body.tipo.trim().replace(/\s+/g, ' ') : ''
    if (!tipoAba) {
      return NextResponse.json(
        { error: 'Informe o nome da aba de destino' },
        { status: 400 },
      )
    }
    if (ABAS_PROTEGIDAS.has(tipoAba.toLowerCase())) {
      return NextResponse.json(
        {
          error:
            'Escolha outro nome. Pavimentação e Obras diversas continuam no fluxo antigo.',
        },
        { status: 400 },
      )
    }

    const obras = Array.isArray(body.obras) ? body.obras : []
    if (obras.length === 0) {
      return NextResponse.json({ error: 'Lista de obras é obrigatória' }, { status: 400 })
    }

    const mapped = obras
      .map((obra, index) => {
        const columnMap: Record<string, Array<{ original: string; value: unknown }>> = {}
        Object.keys(obra).forEach((key) => {
          const normalized = normalizeColumnName(key)
          if (!columnMap[normalized]) columnMap[normalized] = []
          columnMap[normalized].push({ original: key, value: obra[key] })
        })

        const getValue = (variations: string[]): unknown => {
          for (const variation of variations) {
            const normalized = normalizeColumnName(variation)
            if (columnMap[normalized]?.length) {
              const value = columnMap[normalized][0].value
              if (value !== null && value !== undefined && value !== '') return value
            }
          }
          for (const variation of variations) {
            const normalized = normalizeColumnName(variation)
            for (const key in columnMap) {
              if (key.includes(normalized) || normalized.includes(key)) {
                const value = columnMap[key][0].value
                if (value !== null && value !== undefined && value !== '') return value
              }
            }
          }
          return null
        }

        const nomeObra = String(
          getValue(['Obra', 'obra', 'OBRA', 'Nome', 'nome', 'Nome da Obra']) || '',
        ).trim()
        if (!nomeObra) {
          console.warn(`[recap/import] linha ${index + 2} sem obra, ignorada`)
          return null
        }

        return {
          municipio: (() => {
            const v = getValue(['Município', 'Municipio', 'município', 'municipio'])
            return v == null ? null : String(v).trim() || null
          })(),
          obra: nomeObra,
          orgao: (() => {
            const v = getValue(['Órgão', 'Orgão', 'Orgao', 'orgao'])
            return v == null ? null : String(v).trim() || null
          })(),
          sei: (() => {
            const v = getValue(['SEI', 'sei', 'Sei'])
            return v == null ? null : String(v).trim() || null
          })(),
          status: (() => {
            const v = getValue(['Status', 'status', 'OBS', 'Obs'])
            return v == null ? null : String(v).trim() || null
          })(),
          valor_total: parseMoney(
            getValue(['Valor Total', 'valor total', 'Valor', 'valor', 'VALOR']),
          ),
          valor_pago: parseMoney(getValue(['Valor Pago', 'valor pago', 'ValorPago'])),
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)

    if (mapped.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma obra válida (coluna Obra obrigatória)' },
        { status: 400 },
      )
    }

    const result = await importRecapItems({
      tabName: tipoAba,
      items: mapped,
      replace: body.replace !== false,
    })

    return NextResponse.json({
      success: true,
      imported: result.imported,
      total: result.total,
      tipo: result.tabName,
      storage: 'file',
    })
  } catch (error: unknown) {
    console.error('[obras/recap/import]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao importar' },
      { status: 500 },
    )
  }
}
