import type { SupabaseClient } from '@supabase/supabase-js'
import {
  chaveOndaPesquisa,
  dataPesquisaNormalizada,
  rankeamentoNasOndasOrdenadoPorData,
  type PollFeedbackLinha,
} from '@/lib/pesquisa-desempenho-feedback'

const PAGE_SIZE = 1000

type PeriodoParaPesquisas = {
  dias: number
  inicio: string
  fim: string
}

type PollResumoLinha = PollFeedbackLinha & { cargo: string }

export const CANDIDATO_RESUMO_PESQUISAS = 'Jadyel Alencar'

const CARGO_LABELS: Record<string, string> = {
  dep_estadual: 'Dep. estadual',
  dep_federal: 'Dep. federal',
  governador: 'Governador',
  senador: 'Senador',
  presidente: 'Presidente',
}

export function isCandidatoJadyelAlencar(nome: string): boolean {
  const n = nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return n.includes('jadyel')
}

function tipoLabelCurto(t: 'estimulada' | 'espontanea'): string {
  return t === 'estimulada' ? 'estimulada' : 'espontânea'
}

function formatDataCurta(data: string): string {
  const d = dataPesquisaNormalizada(data)
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return data
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatOndaResumo(r: {
  dataFmt: string
  instituto: string
  tipo: string
  cidade?: string
  rank: number
  total: number
  intencao: number
  cargo?: string
}): string {
  const onde = r.cidade ? ` · ${r.cidade}` : ' · Estado'
  const cargo = r.cargo ? ` · ${r.cargo}` : ''
  const posicao =
    r.total > 1
      ? `${r.rank}º de ${r.total} candidatos válidos (${r.intencao.toFixed(1)}%)`
      : `${r.intencao.toFixed(1)}% (único candidato válido na onda)`
  return `${r.dataFmt} · ${r.instituto}${onde} · ${r.tipo}${cargo} — Jadyel Alencar: ${posicao}`
}

type PollRow = {
  data: string
  instituto: string
  candidato_nome: string
  tipo: 'estimulada' | 'espontanea'
  cargo: string
  cidade_id: string | null
  intencao: number
  rejeicao: number
  cities: { name: string } | { name: string }[] | null
}

function mapPollRow(row: PollRow): PollResumoLinha {
  const cities = Array.isArray(row.cities) ? row.cities[0] : row.cities
  return {
    data: row.data,
    instituto: row.instituto,
    candidato_nome: row.candidato_nome,
    tipo: row.tipo,
    cargo: row.cargo,
    cidade_id: row.cidade_id,
    intencao: Number(row.intencao) || 0,
    rejeicao: Number(row.rejeicao) || 0,
    cities: cities ? { name: cities.name } : undefined,
  }
}

export async function fetchPollsNoPeriodo(
  admin: SupabaseClient,
  periodo: PeriodoParaPesquisas
): Promise<PollResumoLinha[]> {
  const inicioDate = periodo.inicio.slice(0, 10)
  const fimDate = periodo.fim.slice(0, 10)
  const rows: PollResumoLinha[] = []
  let offset = 0

  while (true) {
    const { data, error } = await admin
      .from('polls')
      .select(
        `
        data,
        instituto,
        candidato_nome,
        tipo,
        cargo,
        cidade_id,
        intencao,
        rejeicao,
        cities ( name )
      `
      )
      .gte('data', inicioDate)
      .lte('data', fimDate)
      .order('data', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[resumo-operacional] polls', error)
      break
    }

    const batch = (data ?? []) as PollRow[]
    for (const row of batch) {
      rows.push(mapPollRow(row))
    }

    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return rows
}

export function buildPesquisasResumoItens(
  polls: PollResumoLinha[],
  periodo: PeriodoParaPesquisas
): string[] {
  if (polls.length === 0) {
    return [
      `Nenhuma pesquisa cadastrada no período de ${periodo.dias} dias — registre em Pesquisa & Relato`,
    ]
  }

  const ondas = rankeamentoNasOndasOrdenadoPorData(
    CANDIDATO_RESUMO_PESQUISAS,
    polls,
    isCandidatoJadyelAlencar
  ).sort((a, b) => b.dataMs - a.dataMs)

  if (ondas.length === 0) {
    return [
      `Há ${polls.length} registro(s) de pesquisa no período, mas nenhum com Jadyel Alencar — inclua o candidato nas ondas em Pesquisa & Relato`,
    ]
  }

  const pesquisasDistintas = new Set(
    polls.filter((p) => isCandidatoJadyelAlencar(p.candidato_nome)).map((p) => chaveOndaPesquisa(p))
  ).size

  const itens: string[] = [
    `${pesquisasDistintas} ${pesquisasDistintas === 1 ? 'pesquisa' : 'pesquisas'} com Jadyel Alencar no período de ${periodo.dias} dias`,
  ]

  for (const onda of ondas) {
    const linhaPoll = polls.find(
      (p) =>
        isCandidatoJadyelAlencar(p.candidato_nome) &&
        formatDataCurta(p.data) === onda.dataFmt &&
        p.instituto === onda.instituto &&
        tipoLabelCurto(p.tipo) === onda.tipo &&
        (p.cities?.name ?? undefined) === onda.cidade
    )
    const cargoKey = linhaPoll?.cargo ?? ''
    itens.push(
      formatOndaResumo({
        ...onda,
        cargo: cargoKey ? (CARGO_LABELS[cargoKey] ?? cargoKey) : undefined,
      })
    )
  }

  return itens
}
