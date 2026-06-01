import {
  cargoAnoKey,
  normalizarNomeCargo,
  parseCargoAnoKey,
  type VotacaoSecaoAno,
  type VotacaoSecaoItem,
  type VotacaoSecaoResultado,
} from '@/lib/votacao-secao'

export type CandidatoMatrizColuna = {
  id: string
  dsCargo: string
  nrVotavel: number
  nmVotavel: string
  totalVotos: number
  anoEleicao?: number
}

export type LinhaMatrizSecao = {
  localId: string
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  dsEndereco: string | null
  nmBairro: string | null
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
  nmBairro: string | null
  secoes: LinhaMatrizSecao[]
  votos: Record<string, number>
  liderId: string | null
  totalSecoes: number
}

export type GrupoBairroMatriz = {
  id: string
  nmBairro: string
  locais: GrupoLocalMatriz[]
  votos: Record<string, number>
  liderId: string | null
  totalLocais: number
  totalSecoes: number
}

export function candidatoMatrizId(
  dsCargo: string,
  nrVotavel: number,
  nmVotavel: string,
  anoEleicao?: number,
  sqCandidato?: number | null,
): string {
  const cargo = normalizarNomeCargo(dsCargo)
  const core =
    sqCandidato != null && sqCandidato > 0
      ? `${cargo}:sq:${sqCandidato}`
      : `${cargo}:${nrVotavel}:${nmVotavel.trim().toUpperCase()}`
  return anoEleicao != null ? `${anoEleicao}:${core}` : core
}

function idCandidatoFromResultado(
  r: Pick<
    VotacaoSecaoResultado,
    'dsCargo' | 'nrVotavel' | 'nmVotavel' | 'anoEleicao' | 'sqCandidato'
  >,
): string {
  return candidatoMatrizId(
    r.dsCargo,
    r.nrVotavel,
    r.nmVotavel,
    r.anoEleicao,
    r.sqCandidato,
  )
}

function resultadoPassaFiltroCargo(
  dsCargo: string,
  anoEleicao: number | undefined,
  filtro: readonly string[] | null | undefined,
): boolean {
  if (!filtro?.length) return true
  const cargoNorm = normalizarNomeCargo(dsCargo)
  if (anoEleicao != null) {
    return filtro.includes(cargoAnoKey(anoEleicao as VotacaoSecaoAno, cargoNorm))
  }
  return filtro.includes(cargoNorm) || filtro.some((k) => parseCargoAnoKey(k)?.cargo === cargoNorm)
}

/** Lista candidatos ordenados por total de votos no município. */
export function listarCandidatosSecao(
  secoes: VotacaoSecaoItem[],
  filtroCargos?: readonly string[] | null,
): CandidatoMatrizColuna[] {
  const totais = new Map<string, CandidatoMatrizColuna>()

  for (const secao of secoes) {
    for (const r of secao.resultados) {
      if (!resultadoPassaFiltroCargo(r.dsCargo, r.anoEleicao, filtroCargos)) {
        continue
      }

      const dsCargo = normalizarNomeCargo(r.dsCargo)
      const id = idCandidatoFromResultado(r)
      const prev = totais.get(id)
      if (prev) {
        prev.totalVotos += r.qtVotos
        if (!prev.nmVotavel?.trim() && r.nmVotavel?.trim()) {
          prev.nmVotavel = r.nmVotavel
        }
      } else {
        totais.set(id, {
          id,
          dsCargo,
          nrVotavel: r.nrVotavel,
          nmVotavel: r.nmVotavel,
          totalVotos: r.qtVotos,
          anoEleicao: r.anoEleicao,
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
  if (
    cargo === 'Vereador' ||
    cargo === 'Deputado Federal' ||
    cargo === 'Deputado Estadual'
  ) {
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
      const id = idCandidatoFromResultado(r)
      if (!idSet.has(id)) continue
      votos[id] = (votos[id] ?? 0) + r.qtVotos
    }

    for (const [id, qt] of Object.entries(votos)) {
      if (qt > liderVotos) {
        liderVotos = qt
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
      nmBairro: secao.nmBairro,
      totalSecao,
      votos,
      liderId,
    }
  })

  for (const c of candidatos) {
    let somaNasSecoes = 0
    for (const linha of linhas) {
      somaNasSecoes += linha.votos[c.id] ?? 0
    }
    c.totalVotos = Math.max(c.totalVotos, somaNasSecoes)
  }

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
        nmBairro: linha.nmBairro,
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

const BAIRRO_SEM_CADASTRO = 'Sem bairro cadastrado'

function chaveGrupoBairro(nmBairro: string | null | undefined): string {
  const nome = (nmBairro || BAIRRO_SEM_CADASTRO).trim()
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Agrupa locais da matriz por bairro oficial (TSE). */
export function agruparMatrizPorBairro(linhas: LinhaMatrizSecao[]): GrupoBairroMatriz[] {
  const locais = agruparMatrizPorLocal(linhas)
  const mapa = new Map<string, GrupoBairroMatriz>()

  for (const local of locais) {
    const nmBairro =
      local.nmBairro?.trim() ||
      local.secoes.find((s) => s.nmBairro?.trim())?.nmBairro?.trim() ||
      BAIRRO_SEM_CADASTRO
    const id = chaveGrupoBairro(nmBairro)
    const existente = mapa.get(id)

    if (!existente) {
      mapa.set(id, {
        id,
        nmBairro,
        locais: [local],
        votos: { ...local.votos },
        liderId: local.liderId,
        totalLocais: 1,
        totalSecoes: local.totalSecoes,
      })
      continue
    }

    existente.locais.push(local)
    existente.totalLocais += 1
    existente.totalSecoes += local.totalSecoes
    for (const [candidatoId, qt] of Object.entries(local.votos)) {
      existente.votos[candidatoId] = (existente.votos[candidatoId] ?? 0) + qt
    }
    existente.liderId = calcularLider(existente.votos)
  }

  return [...mapa.values()]
    .map((grupo) => ({
      ...grupo,
      locais: [...grupo.locais].sort(
        (a, b) =>
          a.nrZona - b.nrZona ||
          (a.nrLocalVotacao ?? 0) - (b.nrLocalVotacao ?? 0) ||
          (a.nmLocalVotacao ?? '').localeCompare(b.nmLocalVotacao ?? '', 'pt-BR'),
      ),
    }))
    .sort((a, b) => b.totalSecoes - a.totalSecoes || a.nmBairro.localeCompare(b.nmBairro, 'pt-BR'))
}

export function contarBairrosMatriz(linhas: LinhaMatrizSecao[]): number {
  const set = new Set<string>()
  for (const linha of linhas) {
    set.add(chaveGrupoBairro(linha.nmBairro))
  }
  return set.size
}
