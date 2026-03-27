import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type VoteRow = { nome: string; votos: number }
const FEDERAL_2018_CACHE_TTL_MS = 10 * 60 * 1000
let cachedFederal2018: VoteRow[] | null = null
let cachedFederal2018At = 0

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Cenário principal federal: ativo -> base -> mais recente
    const { data: ativo } = await supabase
      .from('chapas_cenarios')
      .select('user_id, id, nome')
      .not('id', 'like', 'estadual_%')
      .eq('ativo', true)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    let cenario = ativo
    if (!cenario) {
      const { data: base } = await supabase
        .from('chapas_cenarios')
        .select('user_id, id, nome')
        .not('id', 'like', 'estadual_%')
        .eq('id', 'base')
        .limit(1)
        .maybeSingle()
      cenario = base
    }
    if (!cenario) {
      const { data: rec } = await supabase
        .from('chapas_cenarios')
        .select('user_id, id, nome')
        .not('id', 'like', 'estadual_%')
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle()
      cenario = rec
    }

    if (!cenario) {
      return NextResponse.json(
        { error: 'Nenhum cenário federal encontrado para comparação.' },
        { status: 404 }
      )
    }

    const { data: candidatosRows, error: candidatosErr } = await supabase
      .from('chapas_partidos')
      .select('candidato_nome, candidato_votos')
      .eq('user_id', cenario.user_id)
      .eq('cenario_id', cenario.id)
      .gt('candidato_votos', 0)
      .order('candidato_votos', { ascending: false })

    if (candidatosErr) {
      return NextResponse.json({ error: candidatosErr.message }, { status: 500 })
    }

    const byNome = new Map<string, VoteRow>()
    for (const row of candidatosRows ?? []) {
      const nome = String(row.candidato_nome || '').trim()
      if (!nome) continue
      const key = normalizeText(nome)
      if (!key) continue
      const atual = byNome.get(key) ?? { nome, votos: 0 }
      atual.votos += Number(row.candidato_votos || 0)
      byNome.set(key, atual)
    }

    const candidatosPrincipal = Array.from(byNome.values()).sort(
      (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR')
    )

    // 2018 (total geral) da tabela local importada.
    // Importante: lê em páginas para evitar limite padrão de linhas do PostgREST.
    let resultados2018: VoteRow[] = []
    const isCacheFresh = Date.now() - cachedFederal2018At < FEDERAL_2018_CACHE_TTL_MS
    if (cachedFederal2018 && isCacheFresh) {
      resultados2018 = cachedFederal2018
    } else {
      const votos2018 = new Map<string, VoteRow>()
      // Mantemos 1000 por página para respeitar limites comuns do PostgREST/Supabase.
      const batchSize = 1000
      let from = 0

      while (true) {
        const to = from + batchSize - 1
        const { data, error } = await supabase
          .from('federal_2018')
          .select('id, nm_votavel, qt_votos')
          .eq('cd_cargo', 6) // Deputado Federal
          .order('id', { ascending: true })
          .range(from, to)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const rows = data ?? []
        if (rows.length === 0) break

        for (const row of rows) {
          const nome = String(row.nm_votavel || '').trim()
          if (!nome) continue
          const key = normalizeText(row.nm_votavel)
          if (!key) continue
          const atual = votos2018.get(key) ?? { nome, votos: 0 }
          atual.votos += Number(row.qt_votos || 0)
          votos2018.set(key, atual)
        }

        // Avança pelo volume realmente recebido para nunca pular registros.
        from += rows.length
      }

      resultados2018 = Array.from(votos2018.values()).sort(
        (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR')
      )
      cachedFederal2018 = resultados2018
      cachedFederal2018At = Date.now()
    }

    // 2022 (total geral) a partir da mesma fonte usada no resumo-eleicoes
    const baseUrl = request.nextUrl.origin
    const federal2022Res = await fetch(`${baseUrl}/api/resumo-eleicoes?totals=federal2022`, {
      cache: 'no-store',
    })
    const federal2022Json = (await federal2022Res.json().catch(() => ({}))) as {
      rows?: Array<{ nome: string; votos: number }>
    }
    const votos2022 = new Map<string, VoteRow>()
    for (const row of federal2022Json.rows ?? []) {
      const key = normalizeText(row.nome)
      if (!key) continue
      const atual = votos2022.get(key) ?? { nome: row.nome, votos: 0 }
      atual.votos += Number(row.votos || 0)
      votos2022.set(key, atual)
    }

    const resultados2022 = Array.from(votos2022.values()).sort(
      (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR')
    )

    return NextResponse.json({
      scope: 'total_geral',
      cenarioPrincipal: {
        id: cenario.id,
        nome: cenario.nome,
      },
      resultados2018,
      resultados2022,
      previsao2026: candidatosPrincipal,
    })
  } catch (error) {
    console.error('[historico-federal] erro', error)
    return NextResponse.json({ error: 'Erro ao gerar histórico federal.' }, { status: 500 })
  }
}

