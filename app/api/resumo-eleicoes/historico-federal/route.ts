import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type VoteRow = { nome: string; votos: number }

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

    // 2018 (total geral) da tabela local importada
    const { data: votos2018Rows, error: votos2018Err } = await supabase
      .from('federal_2018')
      .select('nm_votavel, qt_votos')
      .eq('cd_cargo', 6) // Deputado Federal

    if (votos2018Err) {
      return NextResponse.json({ error: votos2018Err.message }, { status: 500 })
    }

    const votos2018 = new Map<string, VoteRow>()
    for (const row of votos2018Rows ?? []) {
      const nome = String(row.nm_votavel || '').trim()
      if (!nome) continue
      const key = normalizeText(String(row.nm_votavel || ''))
      if (!key) continue
      const atual = votos2018.get(key) ?? { nome, votos: 0 }
      atual.votos += Number(row.qt_votos || 0)
      votos2018.set(key, atual)
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

    const resultados2018 = Array.from(votos2018.values()).sort(
      (a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR')
    )
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

