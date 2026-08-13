import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { consultarSeiNoDoe } from '@/lib/diario-oficial-pi'
import { findRecapItemById, updateRecapItem } from '@/lib/obras-recap-store'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  sei?: string
  obraId?: string
  tabName?: string
  /** Grava no storage local JSON (padrão true). */
  persist?: boolean
}

/** Consulta DOE e grava no storage local (sem Supabase). */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = (await request.json()) as Body
    let sei = typeof body.sei === 'string' ? body.sei.trim() : ''
    const obraId = typeof body.obraId === 'string' ? body.obraId.trim() : ''
    let tabName = typeof body.tabName === 'string' ? body.tabName.trim() : ''
    const persist = body.persist !== false

    if (!sei && obraId) {
      const found = await findRecapItemById(obraId)
      if (!found) {
        return NextResponse.json(
          { error: 'Obra não encontrada no storage local' },
          { status: 404 },
        )
      }
      sei = (found.item.sei ?? '').trim()
      tabName = found.tabName
    }

    if (!sei) {
      return NextResponse.json(
        { error: 'Informe o número SEI ou obraId com SEI preenchido' },
        { status: 400 },
      )
    }

    const result = await consultarSeiNoDoe(sei)
    const patch = {
      doe_edicao: result.edicao,
      doe_resumo: result.resumo
        ? result.resumo.slice(0, 20000)
        : result.encontrados === 0
          ? 'Nenhuma ocorrência no Diário Oficial'
          : null,
      doe_pdf_url: result.pdfUrl,
      doe_nota_uuid: result.notaUuid,
      doe_encontrados: result.encontrados,
      doe_registros: result.registros.map((r) => ({
        edicao: r.edicao,
        titulo: r.titulo,
        dia: r.dia,
        resumo: r.resumo.slice(0, 8000),
        pdfUrl: r.pdfUrl,
        notaUuid: r.notaUuid,
      })),
      doe_consultado_em: new Date().toISOString(),
    }

    if (persist && obraId) {
      if (!tabName) {
        const found = await findRecapItemById(obraId)
        tabName = found?.tabName ?? ''
      }
      if (!tabName) {
        return NextResponse.json(
          { error: 'Não foi possível localizar a aba da obra no storage' },
          { status: 404 },
        )
      }
      const updated = await updateRecapItem(tabName, obraId, patch)
      if (!updated) {
        return NextResponse.json(
          { error: 'Falha ao salvar no storage local', result, patch },
          { status: 500 },
        )
      }
      return NextResponse.json({
        success: true,
        storage: 'file',
        result,
        obra: { ...updated, tipo: tabName },
      })
    }

    return NextResponse.json({ success: true, storage: 'file', result, patch })
  } catch (error: unknown) {
    console.error('[obras/doe-busca]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao consultar Diário Oficial' },
      { status: 500 },
    )
  }
}
