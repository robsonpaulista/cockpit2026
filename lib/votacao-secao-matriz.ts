import type { VotacaoSecaoItem } from '@/lib/votacao-secao'

export type CandidatoMatrizColuna = {
  id: string
  nrVotavel: number
  nmVotavel: string
  totalVotos: number
}

export type LinhaMatrizSecao = {
  localId: string
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  dsEndereco: string | null
  totalSecao: number
  votos: Record<string, number>
  liderId: string | null
}

export type MatrizVotacaoSecao = {
  candidatos: CandidatoMatrizColuna[]
  linhas: LinhaMatrizSecao[]
}

export type GrupoLocalMatriz = {
  id: string
  nrZona: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  dsEndereco: string | null
  secoes: LinhaMatrizSecao[]
  votos: Record<string, number>
  liderId: string | null
  totalSecoes: number
}

export function candidatoMatrizId(nrVotavel: number, nmVotavel: string): string {
  return `${nrVotavel}:${nmVotavel.trim().toUpperCase()}`
}

/** Lista candidatos do cargo ordenados por total de votos no município. */
export function listarCandidatosSecao(secoes: VotacaoSecaoItem[]): CandidatoMatrizColuna[] {
  const totais = new Map<string, CandidatoMatrizColuna>()

  for (const secao of secoes) {
    for (const r of secao.resultados) {
      const id = candidatoMatrizId(r.nrVotavel, r.nmVotavel)
      const prev = totais.get(id)
      if (prev) {
        prev.totalVotos += r.qtVotos
      } else {
        totais.set(id, {
          id,
          nrVotavel: r.nrVotavel,
          nmVotavel: r.nmVotavel,
          totalVotos: r.qtVotos,
        })
      }
    }
  }

  return [...totais.values()].sort(
    (a, b) => b.totalVotos - a.totalVotos || a.nmVotavel.localeCompare(b.nmVotavel, 'pt-BR'),
  )
}

export function idsCandidatosPadrao(
  candidatos: CandidatoMatrizColuna[],
  cargo: string,
): string[] {
  if (cargo === 'Vereador') {
    return candidatos.slice(0, 12).map((c) => c.id)
  }
  return candidatos.map((c) => c.id)
}

export function montarMatrizVotacaoSecao(
  secoes: VotacaoSecaoItem[],
  candidatoIds: string[],
): MatrizVotacaoSecao {
  const idSet = new Set(candidatoIds)
  const candidatos = listarCandidatosSecao(secoes).filter((c) => idSet.has(c.id))

  const linhas: LinhaMatrizSecao[] = secoes.map((secao) => {
    const votos: Record<string, number> = {}
    let liderId: string | null = null
    let liderVotos = -1

    for (const r of secao.resultados) {
      const id = candidatoMatrizId(r.nrVotavel, r.nmVotavel)
      if (!idSet.has(id)) continue
      votos[id] = r.qtVotos
      if (r.qtVotos > liderVotos) {
        liderVotos = r.qtVotos
        liderId = id
      }
    }

    const totalSecao = Object.values(votos).reduce((acc, v) => acc + v, 0)

    return {
      localId: secao.localId,
      nrZona: secao.nrZona,
      nrSecao: secao.nrSecao,
      nrLocalVotacao: secao.nrLocalVotacao,
      nmLocalVotacao: secao.nmLocalVotacao,
      dsEndereco: secao.dsEndereco,
      totalSecao,
      votos,
      liderId,
    }
  })

  return { candidatos, linhas }
}

function chaveGrupoLocal(linha: LinhaMatrizSecao): string {
  if (linha.nrLocalVotacao != null) {
    return `${linha.nrZona}:${linha.nrLocalVotacao}`
  }
  return linha.localId
}

function calcularLider(votos: Record<string, number>): string | null {
  let liderId: string | null = null
  let liderVotos = -1
  for (const [id, qt] of Object.entries(votos)) {
    if (qt > liderVotos) {
      liderVotos = qt
      liderId = id
    }
  }
  return liderId
}

/** Agrupa linhas da matriz por local de votação (zona + nr local). */
export function agruparMatrizPorLocal(linhas: LinhaMatrizSecao[]): GrupoLocalMatriz[] {
  const mapa = new Map<string, GrupoLocalMatriz>()

  for (const linha of linhas) {
    const id = chaveGrupoLocal(linha)
    const existente = mapa.get(id)

    if (!existente) {
      mapa.set(id, {
        id,
        nrZona: linha.nrZona,
        nrLocalVotacao: linha.nrLocalVotacao,
        nmLocalVotacao: linha.nmLocalVotacao,
        dsEndereco: linha.dsEndereco,
        secoes: [linha],
        votos: { ...linha.votos },
        liderId: linha.liderId,
        totalSecoes: 1,
      })
      continue
    }

    existente.secoes.push(linha)
    existente.totalSecoes += 1
    for (const [candidatoId, qt] of Object.entries(linha.votos)) {
      existente.votos[candidatoId] = (existente.votos[candidatoId] ?? 0) + qt
    }
    existente.liderId = calcularLider(existente.votos)
  }

  return [...mapa.values()]
    .map((grupo) => ({
      ...grupo,
      secoes: [...grupo.secoes].sort(
        (a, b) => a.nrSecao - b.nrSecao || a.nrZona - b.nrZona,
      ),
    }))
    .sort(
      (a, b) =>
        a.nrZona - b.nrZona ||
        (a.nrLocalVotacao ?? 0) - (b.nrLocalVotacao ?? 0) ||
        (a.nmLocalVotacao ?? '').localeCompare(b.nmLocalVotacao ?? '', 'pt-BR'),
    )
}
