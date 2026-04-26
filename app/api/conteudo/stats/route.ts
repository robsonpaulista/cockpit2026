import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const today = new Date().toISOString().slice(0, 10)

    const [
      obrasCount,
      agendasFuturas,
      planejadosCount,
      cardsGerados,
      cardsAprovados,
      publicadosCount,
    ] = await Promise.all([
      supabase.from('obras').select('id', { count: 'exact', head: true }),
      supabase.from('agendas').select('id', { count: 'exact', head: true }).gte('date', today),
      supabase.from('conteudos_planejados').select('id', { count: 'exact', head: true }),
      supabase.from('conteudos_planejados').select('id', { count: 'exact', head: true }).eq('status', 'gerado'),
      supabase.from('conteudos_planejados').select('id', { count: 'exact', head: true }).eq('status', 'aprovado'),
      supabase.from('conteudos_planejados').select('id', { count: 'exact', head: true }).eq('status', 'publicado'),
    ])

    const { data: proximasAgendas } = await supabase
      .from('agendas')
      .select(
        `
        id,
        date,
        type,
        status,
        cities ( name, state )
      `
      )
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(8)

    const { data: cardsRecentes } = await supabase
      .from('conteudos_planejados')
      .select('id, cidade, template, status, imagem_url, created_at, texto_arte')
      .order('created_at', { ascending: false })
      .limit(8)

    const { data: distribuicao } = await supabase
      .from('conteudos_planejados')
      .select('id, cidade, titulo, imagem_url, legenda')
      .eq('campanha_geral', true)
      .not('imagem_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12)

    return NextResponse.json({
      kpis: {
        obras_cadastradas: obrasCount.count ?? 0,
        agendas_futuras: agendasFuturas.count ?? 0,
        conteudos_planejados: planejadosCount.count ?? 0,
        cards_gerados: cardsGerados.count ?? 0,
        cards_aprovados: cardsAprovados.count ?? 0,
        conteudos_publicados: publicadosCount.count ?? 0,
      },
      proximas_agendas: proximasAgendas ?? [],
      cards_recentes: cardsRecentes ?? [],
      conteudos_distribuicao: distribuicao ?? [],
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro ao carregar estatísticas' }, { status: 500 })
  }
}
