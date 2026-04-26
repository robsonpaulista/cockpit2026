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

    const { data: pubs, error: pErr } = await supabase.from('publicacoes_conteudo').select(`
        id,
        plataforma,
        link,
        views,
        likes,
        comentarios,
        compartilhamentos,
        data_coleta,
        created_at,
        conteudos_planejados (
          id,
          cidade,
          territorio,
          template,
          formato,
          obra_id,
          obras ( tipo, obra )
        )
      `)

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    const list = pubs ?? []
    let engajamento = 0
    for (const p of list) {
      engajamento +=
        (p.views ?? 0) + (p.likes ?? 0) + (p.comentarios ?? 0) + (p.compartilhamentos ?? 0)
    }

    const byCity: Record<string, { count: number; eng: number; ultima_coleta: string | null }> = {}
    const byTerr: Record<string, { count: number; eng: number; ultima_coleta: string | null }> = {}
    const byTpl: Record<string, { count: number; eng: number; ultima_coleta: string | null }> = {}
    const byTipoObra: Record<string, { count: number; eng: number; ultima_coleta: string | null }> = {}

    for (const p of list) {
      const c = p.conteudos_planejados as {
        cidade?: string | null
        territorio?: string | null
        template?: string | null
        obras?: { tipo?: string | null } | null
      } | null
      const e =
        (p.views ?? 0) + (p.likes ?? 0) + (p.comentarios ?? 0) + (p.compartilhamentos ?? 0)
      const dc = (p.data_coleta as string) || null

      const bump = (
        rec: Record<string, { count: number; eng: number; ultima_coleta: string | null }>,
        key: string
      ) => {
        if (!rec[key]) rec[key] = { count: 0, eng: 0, ultima_coleta: null }
        rec[key].count += 1
        rec[key].eng += e
        if (dc && (!rec[key].ultima_coleta || dc > rec[key].ultima_coleta!)) {
          rec[key].ultima_coleta = dc
        }
      }

      bump(byCity, (c?.cidade || '(sem cidade)').trim())
      bump(byTerr, (c?.territorio || '(sem território)').trim())
      bump(byTpl, (c?.template || '(sem template)').trim())
      const tipoObra = c?.obras?.tipo?.trim() || '(sem tipo obra)'
      bump(byTipoObra, tipoObra)
    }

    const best = (rec: Record<string, { count: number; eng: number; ultima_coleta: string | null }>) => {
      let topKey = ''
      let topEng = -1
      for (const [k, v] of Object.entries(rec)) {
        if (v.eng > topEng) {
          topEng = v.eng
          topKey = k
        }
      }
      return topKey && topEng >= 0 ? { chave: topKey, engajamento: topEng } : null
    }

    const { data: obras } = await supabase.from('obras').select('id')
    const { data: contPub } = await supabase
      .from('conteudos_planejados')
      .select('obra_id')
      .eq('status', 'publicado')
      .not('obra_id', 'is', null)

    const obrasComPub = new Set((contPub ?? []).map((r) => r.obra_id as string))
    const obrasSemConteudo =
      (obras ?? []).filter((o) => !obrasComPub.has(o.id as string)).length || 0

    const { data: agendas } = await supabase.from('agendas').select('id')
    const { data: contAg } = await supabase
      .from('conteudos_planejados')
      .select('agenda_id')
      .not('agenda_id', 'is', null)

    const agendasCom = new Set((contAg ?? []).map((r) => r.agenda_id as string))
    const agendasSem =
      (agendas ?? []).filter((a) => !agendasCom.has(a.id as string)).length || 0

    const insights: string[] = []
    const bestTpl = best(byTpl)
    if (bestTpl) {
      insights.push(`Conteúdos com template “${bestTpl.chave}” somam maior engajamento registrado.`)
    }
    const bestCity = best(byCity)
    if (bestCity && bestCity.chave !== '(sem cidade)') {
      insights.push(`“${bestCity.chave}” concentra maior volume de engajamento nas métricas atuais.`)
    }
    if (obrasSemConteudo > 0) {
      insights.push(`Há obras cadastradas sem conteúdo publicado (${obrasSemConteudo}).`)
    }
    if (agendasSem > 0) {
      insights.push(`${agendasSem} agenda(s) ainda sem vínculo de conteúdos planejados.`)
    }

    return NextResponse.json({
      resumo: {
        publicacoes: list.length,
        engajamento_total: engajamento,
        melhor_cidade: bestCity,
        melhor_territorio: best(byTerr),
        melhor_template: bestTpl,
        obras_sem_conteudo_publicado: obrasSemConteudo,
        agendas_sem_conteudo: agendasSem,
      },
      por_cidade: Object.entries(byCity).map(([cidade, v]) => ({ cidade, ...v })),
      por_territorio: Object.entries(byTerr).map(([territorio, v]) => ({ territorio, ...v })),
      por_template: Object.entries(byTpl).map(([template, v]) => ({ template, ...v })),
      por_tipo_obra: Object.entries(byTipoObra).map(([tipo_obra, v]) => ({ tipo_obra, ...v })),
      publicacoes_recentes: list.slice(-50).reverse(),
      insights,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
