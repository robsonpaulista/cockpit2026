import { redistribuirSobreVotosValidos } from '@/lib/espontanea-normalize'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  chavePesquisaDistinta,
  type PollExecutiveInput,
} from '@/lib/pesquisa-tendencia-executive'
import type { PollIptRow } from '@/lib/ipt-pesquisa'

export type WarRoomPesquisaConsolidadaReal = {
  id: string
  cidade: string
  instituto: string
  data: string
  dataLabel: string
  cenario: 'Estimulada' | 'Espontânea'
  jadyelPct: number | null
  liderPct: number
  liderNome: string
  diferencaPp: number | null
}

function candidatoNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function dataCurta(data: string): string {
  return data.includes('T') ? (data.split('T')[0] ?? data) : data
}

function formatDataLabel(isoDate: string): string {
  const parts = dataCurta(isoDate).split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return isoDate
}

function nomeCidadePoll(poll: PollIptRow): string {
  const c = poll.cities
  if (!c) return ''
  if (Array.isArray(c)) return (c[0]?.name ?? '').trim()
  return (c.name ?? '').trim()
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

type OndaBucket = {
  cidade: string
  data: string
  instituto: string
  tipo: 'estimulada' | 'espontanea'
  linhas: Array<{ nome: string; intencao: number }>
}

/**
 * Ondas consolidadas (mesmo raciocínio do IPT): preferir estimulada;
 * redistribui sobre válidos; Jadyel vs líder da onda; ordena por data desc.
 */
export function buildWarRoomPesquisasConsolidadas(
  polls: PollIptRow[],
  candidato: string,
  limit = 20,
): WarRoomPesquisaConsolidadaReal[] {
  const candidatoNorm = candidatoNormalizado(candidato)
  if (!candidatoNorm) return []

  const buildForTipo = (tipo: 'estimulada' | 'espontanea') => {
    const bruto = new Map<string, OndaBucket>()
    for (const poll of polls) {
      if (poll.tipo !== tipo) continue
      if (!Number.isFinite(poll.intencao)) continue
      const cidade = nomeCidadePoll(poll)
      if (!cidade) continue

      const executive: PollExecutiveInput = {
        data: poll.data,
        tipo: poll.tipo,
        candidato_nome: poll.candidato_nome,
        intencao: poll.intencao,
        instituto: poll.instituto ?? '',
        cidadeId: poll.cidade_id ?? null,
        cidadeNome: cidade,
      }
      const ondaKey = `${tipo}::${chavePesquisaDistinta(executive)}`
      const bucket = bruto.get(ondaKey) ?? {
        cidade,
        data: dataCurta(poll.data),
        instituto: (poll.instituto ?? '').trim() || '—',
        tipo,
        linhas: [],
      }
      if (!bucket.instituto || bucket.instituto === '—') {
        const inst = (poll.instituto ?? '').trim()
        if (inst) bucket.instituto = inst
      }
      bucket.linhas.push({
        nome: poll.candidato_nome,
        intencao: poll.intencao,
      })
      bruto.set(ondaKey, bucket)
    }
    return bruto
  }

  const estimuladas = buildForTipo('estimulada')
  const espontaneas = buildForTipo('espontanea')

  /** Chave cidade+data+instituto — evita duplicar espontânea se já há estimulada. */
  const chaveSemTipo = (b: OndaBucket) =>
    `${normalizeIptMunicipio(b.cidade)}|${b.data}|${candidatoNormalizado(b.instituto)}`

  const escolhidas = new Map<string, OndaBucket>()
  for (const [, bucket] of estimuladas) {
    escolhidas.set(chaveSemTipo(bucket), bucket)
  }
  for (const [, bucket] of espontaneas) {
    const key = chaveSemTipo(bucket)
    if (!escolhidas.has(key)) escolhidas.set(key, bucket)
  }

  const rows: WarRoomPesquisaConsolidadaReal[] = []
  for (const [ondaKey, bucket] of escolhidas) {
    const redis = redistribuirSobreVotosValidos(bucket.linhas)
    if (redis.ativos.length === 0) continue

    const porCandidato = new Map<string, { nome: string; pct: number }>()
    for (const a of redis.ativos) {
      const nk = candidatoNormalizado(a.nome)
      const prev = porCandidato.get(nk)
      if (prev) {
        porCandidato.set(nk, {
          nome: prev.nome,
          pct: round1((prev.pct + a.intencao) / 2),
        })
      } else {
        porCandidato.set(nk, { nome: a.nome, pct: round1(a.intencao) })
      }
    }

    let liderNome = ''
    let liderPct = -1
    for (const row of porCandidato.values()) {
      if (row.pct > liderPct) {
        liderPct = row.pct
        liderNome = row.nome
      }
    }
    if (liderPct < 0) continue

    const jadyel = porCandidato.get(candidatoNorm)?.pct ?? null
    const diferencaPp = jadyel != null ? round1(jadyel - liderPct) : null

    rows.push({
      id: ondaKey,
      cidade: bucket.cidade,
      instituto: bucket.instituto,
      data: bucket.data,
      dataLabel: formatDataLabel(bucket.data),
      cenario: bucket.tipo === 'estimulada' ? 'Estimulada' : 'Espontânea',
      jadyelPct: jadyel,
      liderPct: round1(liderPct),
      liderNome,
      diferencaPp,
    })
  }

  rows.sort((a, b) => {
    const byDate = b.data.localeCompare(a.data)
    if (byDate !== 0) return byDate
    return a.cidade.localeCompare(b.cidade, 'pt-BR')
  })

  return rows.slice(0, Math.max(1, limit))
}
