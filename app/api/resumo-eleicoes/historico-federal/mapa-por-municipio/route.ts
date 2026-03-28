import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { nomeIndicaPerfilMilitar } from '@/lib/perfil-militar-nome'
import { nmVotavelEhPerfilMilitarDf2018 } from '@/lib/historico-federal-2018-nomes'

export const dynamic = 'force-dynamic'

type Modo = 'todos' | 'candidato' | 'comparar'

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function candidatoMatchKeys(nomeUrna: string, nomeCivil: string | null): Set<string> {
  const keys = new Set<string>()
  const u = normalizeText(nomeUrna)
  if (u) keys.add(u)
  if (nomeCivil) {
    const c = normalizeText(nomeCivil)
    if (c) keys.add(c)
  }
  return keys
}

function nmVotavelMatch(keys: Set<string>, nmVotavel: string): boolean {
  const v = normalizeText(nmVotavel)
  return keys.has(v)
}

type SupabaseServer = ReturnType<typeof createClient>

async function scanFederal2018(
  supabase: SupabaseServer,
  onRow: (row: { nm_municipio: string; nm_votavel: string; qt_votos: number }) => void
): Promise<void> {
  const batchSize = 1000
  let from = 0
  while (true) {
    const to = from + batchSize - 1
    const { data, error } = await supabase
      .from('federal_2018')
      .select('nm_municipio, nm_votavel, qt_votos')
      .eq('cd_cargo', 6)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw new Error(error.message)
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      onRow({
        nm_municipio: String(row.nm_municipio || '').trim(),
        nm_votavel: String(row.nm_votavel || '').trim(),
        qt_votos: Number(row.qt_votos || 0),
      })
    }
    from += rows.length
  }
}

async function fetch2022PorMunicipio(
  request: NextRequest,
  nome: string,
  nomeCivil: string | null
): Promise<{ pontos: { municipio: string; votos: number }[] }> {
  const u = new URL('/api/resumo-eleicoes', request.nextUrl.origin)
  u.searchParams.set('totals', 'federal2022PorMunicipio')
  if (nome) u.searchParams.set('candidato', nome)
  if (nomeCivil) u.searchParams.set('nomeCivil', nomeCivil)
  const fr = await fetch(u.toString(), { cache: 'no-store' })
  const json = (await fr.json().catch(() => ({}))) as {
    error?: string
    pontos?: { municipio: string; votos: number }[]
  }
  if (!fr.ok) throw new Error(json.error || 'Erro ao agregar 2022 por município.')
  return { pontos: Array.isArray(json.pontos) ? json.pontos : [] }
}

async function fetch2022Todos(
  request: NextRequest,
  perfilMilitar: boolean
): Promise<{
  pontos: { municipio: string; votos: number }[]
}> {
  const u = new URL('/api/resumo-eleicoes', request.nextUrl.origin)
  u.searchParams.set('totals', 'federal2022VotosTotaisPorMunicipio')
  if (perfilMilitar) u.searchParams.set('perfilMilitar', 'true')
  const fr = await fetch(u.toString(), { cache: 'no-store' })
  const json = (await fr.json().catch(() => ({}))) as {
    error?: string
    pontos?: { municipio: string; votos: number }[]
  }
  if (!fr.ok) throw new Error(json.error || 'Erro ao agregar totais 2022 por município.')
  return { pontos: Array.isArray(json.pontos) ? json.pontos : [] }
}

function merge2022Comparacao(
  a: { municipio: string; votos: number }[],
  b: { municipio: string; votos: number }[]
): { municipio: string; votosA: number; votosB: number }[] {
  const mapA = new Map<string, number>()
  const mapB = new Map<string, number>()
  const displayByNorm = new Map<string, string>()
  for (const p of a) {
    const k = normalizeText(p.municipio)
    if (!k) continue
    mapA.set(k, (mapA.get(k) || 0) + p.votos)
    if (!displayByNorm.has(k)) displayByNorm.set(k, p.municipio)
  }
  for (const p of b) {
    const k = normalizeText(p.municipio)
    if (!k) continue
    mapB.set(k, (mapB.get(k) || 0) + p.votos)
    if (!displayByNorm.has(k)) displayByNorm.set(k, p.municipio)
  }
  const keys = new Set([...mapA.keys(), ...mapB.keys()])
  return [...keys]
    .map((k) => ({
      municipio: displayByNorm.get(k) || k,
      votosA: mapA.get(k) || 0,
      votosB: mapB.get(k) || 0,
    }))
    .sort((x, y) => y.votosA + y.votosB - (x.votosA + x.votosB) || x.municipio.localeCompare(y.municipio, 'pt-BR'))
}

function candidatoRequestIndicaPerfilMilitar(nome: string, nomeCivil: string | null): boolean {
  const n = (nome || '').trim()
  const c = (nomeCivil || '').trim()
  return nomeIndicaPerfilMilitar(n) || (c.length > 0 && nomeIndicaPerfilMilitar(c))
}

/**
 * Votação por município (PI) para mapas do histórico federal.
 * modo=todos: soma de votos de todos os candidatos a dep. federal por cidade.
 * modo=candidato: filtra um candidato (nome + opcional nomeCivil).
 * modo=comparar: dois candidatos (nomeA/nomeCivilA vs nomeB/nomeCivilB).
 */
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

    const ano = Number(request.nextUrl.searchParams.get('ano') || '')
    const modo = (request.nextUrl.searchParams.get('modo') || 'todos').trim() as Modo

    if (ano !== 2018 && ano !== 2022) {
      return NextResponse.json({ error: 'Ano deve ser 2018 ou 2022.' }, { status: 400 })
    }
    if (modo !== 'todos' && modo !== 'candidato' && modo !== 'comparar') {
      return NextResponse.json({ error: 'modo inválido (todos, candidato ou comparar).' }, { status: 400 })
    }

    const nome = (request.nextUrl.searchParams.get('nome') || '').trim()
    const nomeCivil = (request.nextUrl.searchParams.get('nomeCivil') || '').trim() || null
    const nomeA = (request.nextUrl.searchParams.get('nomeA') || '').trim()
    const nomeCivilA = (request.nextUrl.searchParams.get('nomeCivilA') || '').trim() || null
    const nomeB = (request.nextUrl.searchParams.get('nomeB') || '').trim()
    const nomeCivilB = (request.nextUrl.searchParams.get('nomeCivilB') || '').trim() || null
    const filtroMilitar = request.nextUrl.searchParams.get('filtroMilitar') === 'true'

    if (modo === 'candidato' && !nome && !nomeCivil) {
      return NextResponse.json({ error: 'Informe nome ou nomeCivil do candidato.' }, { status: 400 })
    }
    if (modo === 'comparar' && ((!nomeA && !nomeCivilA) || (!nomeB && !nomeCivilB))) {
      return NextResponse.json(
        { error: 'Informe nomeA/nomeCivilA e nomeB/nomeCivilB para comparar.' },
        { status: 400 }
      )
    }

    if (filtroMilitar && modo === 'candidato') {
      if (!candidatoRequestIndicaPerfilMilitar(nome, nomeCivil)) {
        return NextResponse.json(
          {
            error:
              'Com filtro militar ativo, escolha um candidato da lista de perfil militar/hierarquia (nome de urna ou civil).',
          },
          { status: 400 }
        )
      }
    }
    if (filtroMilitar && modo === 'comparar') {
      if (
        !candidatoRequestIndicaPerfilMilitar(nomeA, nomeCivilA) ||
        !candidatoRequestIndicaPerfilMilitar(nomeB, nomeCivilB)
      ) {
        return NextResponse.json(
          {
            error:
              'Com filtro militar ativo, ambos os candidatos (A e B) devem constar na lista de perfil militar/hierarquia.',
          },
          { status: 400 }
        )
      }
    }

    if (ano === 2022) {
      if (modo === 'todos') {
        const { pontos } = await fetch2022Todos(request, filtroMilitar)
        const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
        return NextResponse.json({
          ano: 2022,
          modo: 'todos',
          tipo: 'single' as const,
          label: filtroMilitar
            ? 'Perfil militar/hierarquia — soma por cidade (Federal PI)'
            : 'Todos os candidatos (Federal PI)',
          pontos,
          totalVotos,
          municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
        })
      }
      if (modo === 'candidato') {
        const { pontos } = await fetch2022PorMunicipio(request, nome, nomeCivil)
        const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
        const label = (nome || nomeCivil || '').trim()
        return NextResponse.json({
          ano: 2022,
          modo: 'candidato',
          tipo: 'single' as const,
          label,
          pontos,
          totalVotos,
          municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
        })
      }
      const pa = await fetch2022PorMunicipio(request, nomeA, nomeCivilA)
      const pb = await fetch2022PorMunicipio(request, nomeB, nomeCivilB)
      const pontos = merge2022Comparacao(pa.pontos, pb.pontos)
      const labelA = (nomeA || nomeCivilA || '').trim()
      const labelB = (nomeB || nomeCivilB || '').trim()
      const totalVotosA = pontos.reduce((s, p) => s + p.votosA, 0)
      const totalVotosB = pontos.reduce((s, p) => s + p.votosB, 0)
      return NextResponse.json({
        ano: 2022,
        modo: 'comparar',
        tipo: 'comparar' as const,
        labelA,
        labelB,
        pontos,
        totalVotosA,
        totalVotosB,
      })
    }

    // --- 2018 (federal_2018) ---
    if (modo === 'todos') {
      const acumulado = new Map<string, number>()
      await scanFederal2018(supabase, (row) => {
        if (!row.nm_municipio) return
        if (filtroMilitar && !nmVotavelEhPerfilMilitarDf2018(row.nm_votavel)) return
        acumulado.set(row.nm_municipio, (acumulado.get(row.nm_municipio) || 0) + row.qt_votos)
      })
      const pontos = Array.from(acumulado.entries())
        .map(([municipio, votos]) => ({ municipio, votos }))
        .sort((a, b) => b.votos - a.votos || a.municipio.localeCompare(b.municipio, 'pt-BR'))
      const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
      return NextResponse.json({
        ano: 2018,
        modo: 'todos',
        tipo: 'single' as const,
        label: filtroMilitar
          ? 'Perfil militar/hierarquia — soma por cidade (Federal 2018)'
          : 'Todos os candidatos (Federal — base 2018)',
        pontos,
        totalVotos,
        municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
      })
    }

    if (modo === 'candidato') {
      const nomeUrnaOuFallback = (nome || nomeCivil || '').trim()
      const keys = candidatoMatchKeys(nomeUrnaOuFallback, nomeCivil)
      const acumulado = new Map<string, number>()
      await scanFederal2018(supabase, (row) => {
        if (!row.nm_municipio || !row.nm_votavel) return
        if (!nmVotavelMatch(keys, row.nm_votavel)) return
        acumulado.set(row.nm_municipio, (acumulado.get(row.nm_municipio) || 0) + row.qt_votos)
      })
      const pontos = Array.from(acumulado.entries())
        .map(([municipio, votos]) => ({ municipio, votos }))
        .sort((a, b) => b.votos - a.votos || a.municipio.localeCompare(b.municipio, 'pt-BR'))
      const totalVotos = pontos.reduce((s, p) => s + p.votos, 0)
      return NextResponse.json({
        ano: 2018,
        modo: 'candidato',
        tipo: 'single' as const,
        label: nomeUrnaOuFallback,
        pontos,
        totalVotos,
        municipiosComVotos: pontos.filter((p) => p.votos > 0).length,
      })
    }

    const nomeAFallback = (nomeA || nomeCivilA || '').trim()
    const nomeBFallback = (nomeB || nomeCivilB || '').trim()
    const keysA = candidatoMatchKeys(nomeAFallback, nomeCivilA)
    const keysB = candidatoMatchKeys(nomeBFallback, nomeCivilB)
    const acumA = new Map<string, number>()
    const acumB = new Map<string, number>()
    await scanFederal2018(supabase, (row) => {
      if (!row.nm_municipio || !row.nm_votavel) return
      if (nmVotavelMatch(keysA, row.nm_votavel)) {
        acumA.set(row.nm_municipio, (acumA.get(row.nm_municipio) || 0) + row.qt_votos)
      }
      if (nmVotavelMatch(keysB, row.nm_votavel)) {
        acumB.set(row.nm_municipio, (acumB.get(row.nm_municipio) || 0) + row.qt_votos)
      }
    })
    const allMun = new Set([...acumA.keys(), ...acumB.keys()])
    const pontos = [...allMun]
      .map((m) => ({
        municipio: m,
        votosA: acumA.get(m) || 0,
        votosB: acumB.get(m) || 0,
      }))
      .sort(
        (x, y) =>
          y.votosA + y.votosB - (x.votosA + x.votosB) || x.municipio.localeCompare(y.municipio, 'pt-BR')
      )
    const totalVotosA = pontos.reduce((s, p) => s + p.votosA, 0)
    const totalVotosB = pontos.reduce((s, p) => s + p.votosB, 0)
    return NextResponse.json({
      ano: 2018,
      modo: 'comparar',
      tipo: 'comparar' as const,
      labelA: nomeAFallback,
      labelB: nomeBFallback,
      pontos,
      totalVotosA,
      totalVotosB,
    })
  } catch (e) {
    console.error('[mapa-por-municipio]', e)
    const msg = e instanceof Error ? e.message : 'Erro ao montar dados do mapa.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
