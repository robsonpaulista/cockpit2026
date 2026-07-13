import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const entrySchema = z.union([
  z.string(),
  z.object({
    federal: z.string().optional(),
    depEstadual: z.string().optional(),
    expec2026: z.number().nullable().optional(),
  }),
])

const schema = z.object({
  cidade: z.string().min(1),
  mapeamento: z.record(z.string(), entrySchema),
})

function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function limparNome(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseExpec(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.round(raw) : null
  }
  const cleaned = String(raw).replace(/[^\d]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}

type SimulacaoEntry = {
  federal: string
  depEstadual: string
  expec2026: number | null
}

function sanitizarMapeamento(value: unknown): Record<string, SimulacaoEntry> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, SimulacaoEntry> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    let federal = ''
    let depEstadual = ''
    let expec2026: number | null = null
    if (typeof raw === 'string') {
      federal = limparNome(raw.includes('::') ? raw.split('::')[0] : raw)
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>
      federal = limparNome(obj.federal ?? obj.federalNome)
      depEstadual = limparNome(obj.depEstadual ?? obj.estadual ?? obj.dep_estadual)
      expec2026 = parseExpec(obj.expec2026 ?? obj.expectativa2026 ?? obj.expec)
    }
    if (!federal && !depEstadual && expec2026 == null) continue
    out[key] = { federal, depEstadual, expec2026 }
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const cidade = request.nextUrl.searchParams.get('cidade')
    if (!cidade) {
      return NextResponse.json({ error: 'Cidade é obrigatória' }, { status: 400 })
    }

    const municipioNormalizado = normalizeCity(cidade)

    const { data, error } = await supabase
      .from('resumo_eleicoes_simulacoes')
      .select('mapeamento')
      .eq('municipio_normalizado', municipioNormalizado)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      mapeamento: sanitizarMapeamento(data?.mapeamento),
    })
  } catch (error) {
    console.error('Erro ao buscar simulação de vereadores:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = schema.parse(body)
    const municipioNormalizado = normalizeCity(parsed.cidade)
    const mapeamento = sanitizarMapeamento(parsed.mapeamento)

    const { data, error } = await supabase
      .from('resumo_eleicoes_simulacoes')
      .upsert(
        {
          municipio: parsed.cidade,
          municipio_normalizado: municipioNormalizado,
          mapeamento,
          created_by: user.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'municipio_normalizado',
        }
      )
      .select('mapeamento')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      mapeamento: sanitizarMapeamento(data?.mapeamento),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }
    console.error('Erro ao salvar simulação de vereadores:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
