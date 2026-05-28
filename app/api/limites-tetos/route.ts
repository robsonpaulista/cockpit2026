import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getExercicioAtivo,
  getLimitesMunicipio,
  getMunicipiosLista,
  getSuasFaixas,
  importLimitesFromJson,
  saveSuasFaixas,
  setExercicioAtivo,
  upsertLimiteMac,
  upsertLimitePap,
} from '@/lib/limites-tetos-db'
import type { SuasFaixaPorte } from '@/lib/limites-tetos-types'
import { isModalidadeLimite, type ModalidadeLimite } from '@/lib/emenda-modalidade'
import { getPopulacaoMunicipio, type MunicipioPopulacao } from '@/lib/populacao-ibge-local'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function loadPopulacao(): MunicipioPopulacao[] {
  try {
    const p = path.join(process.cwd(), 'public', 'populacaoibge.json')
    return JSON.parse(fs.readFileSync(p, 'utf8')) as MunicipioPopulacao[]
  } catch {
    return []
  }
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

    const sp = request.nextUrl.searchParams
    const onlyConfig = sp.get('config') === 'true'
    const onlyFaixas = sp.get('faixas_suas') === 'true'
    const importar = sp.get('importar') === 'true'
    const exercicioParam = sp.get('exercicio')
    const exercicio = exercicioParam ? parseInt(exercicioParam, 10) : await getExercicioAtivo(supabase)

    if (importar) {
      const stats = await importLimitesFromJson(supabase, exercicio)
      return NextResponse.json({ ok: true, exercicio, importado: stats })
    }

    if (onlyConfig) {
      return NextResponse.json({ exercicio_ativo: await getExercicioAtivo(supabase) })
    }

    if (onlyFaixas) {
      const faixas = await getSuasFaixas(supabase, exercicio)
      return NextResponse.json({ exercicio, faixas })
    }

    const municipio = sp.get('municipio')?.trim()
    if (!municipio) {
      const lista = await getMunicipiosLista(supabase, exercicio)
      return NextResponse.json({
        exercicio,
        municipios: lista.map((m) => m.noMunicipio),
      })
    }

    const populacaoLista = loadPopulacao()
    const populacao = getPopulacaoMunicipio(populacaoLista, municipio)
    const limites = await getLimitesMunicipio(supabase, municipio, populacao, exercicio)

    return NextResponse.json(limites)
  } catch (e: unknown) {
    console.error('limites-tetos GET:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const tipo = String(body.tipo ?? '').trim()

    if (tipo === 'exercicio_ativo') {
      const exercicio = parseInt(String(body.exercicio), 10)
      if (!Number.isFinite(exercicio) || exercicio < 2000) {
        return NextResponse.json({ error: 'Exercício inválido' }, { status: 400 })
      }
      await setExercicioAtivo(supabase, exercicio)
      return NextResponse.json({ ok: true, exercicio_ativo: exercicio })
    }

    if (tipo === 'suas_faixas') {
      const exercicio = parseInt(String(body.exercicio), 10)
      const faixas = body.faixas as SuasFaixaPorte[] | undefined
      if (!Number.isFinite(exercicio) || !Array.isArray(faixas) || faixas.length === 0) {
        return NextResponse.json({ error: 'Faixas SUAS inválidas' }, { status: 400 })
      }
      await saveSuasFaixas(supabase, exercicio, faixas)
      return NextResponse.json({ ok: true })
    }

    const municipio = String(body.municipio ?? '').trim()
    const exercicio = parseInt(String(body.exercicio), 10)
    const valor = parseNum(body.valor)

    if (!municipio || !Number.isFinite(exercicio)) {
      return NextResponse.json({ error: 'Município e exercício são obrigatórios' }, { status: 400 })
    }

    const ibge = body.ibge != null ? String(body.ibge) : undefined
    const municipio_nome = body.municipio_nome != null ? String(body.municipio_nome) : undefined

    const modalidadeRaw = String(body.modalidade ?? 'individual').trim()
    const modalidade: ModalidadeLimite = isModalidadeLimite(modalidadeRaw)
      ? modalidadeRaw
      : 'individual'

    if (tipo === 'pap') {
      await upsertLimitePap(supabase, {
        exercicio,
        municipio,
        valor,
        modalidade,
        ibge,
        municipio_nome,
      })
    } else if (tipo === 'mac') {
      await upsertLimiteMac(supabase, {
        exercicio,
        municipio,
        valor,
        modalidade,
        ibge,
        municipio_nome,
      })
    } else {
      return NextResponse.json(
        { error: 'Tipo inválido (pap, mac, suas_faixas, exercicio_ativo)' },
        { status: 400 },
      )
    }

    const populacaoLista = loadPopulacao()
    const populacao = getPopulacaoMunicipio(populacaoLista, municipio)
    const limites = await getLimitesMunicipio(supabase, municipio, populacao, exercicio)

    return NextResponse.json({ ok: true, limites })
  } catch (e: unknown) {
    console.error('limites-tetos PUT:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
