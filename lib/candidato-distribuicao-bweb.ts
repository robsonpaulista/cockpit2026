import {
  chaveMatchFromResumo,
  resultadoBwebMatchesChave,
  type ChaveMatchCandidatoVotacao,
} from '@/lib/candidato-votacao-secao-match'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import type { VotacaoSecaoItem } from '@/lib/votacao-secao'

export const BAIRRO_SEM_CADASTRO = 'Sem bairro cadastrado'

export type SecaoDistribuicaoCandidato = {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  votos: number
}

export type LocalDistribuicaoCandidato = {
  id: string
  nrZona: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  nmBairro: string | null
  rotulo: string
  totalVotos: number
  totalSecoes: number
  secoes: SecaoDistribuicaoCandidato[]
}

export type BairroDistribuicaoCandidato = {
  id: string
  nmBairro: string
  totalVotos: number
  totalSecoes: number
  locais: LocalDistribuicaoCandidato[]
}

export type DistribuicaoCandidatoBweb = {
  encontrado: boolean
  chave: ChaveMatchCandidatoVotacao
  nmVotavel: string | null
  sqCandidato: number | null
  totalVotos: number
  totalSecoesComVoto: number
  votosResumo: number | null
  diferencaResumo: number | null
  bairros: BairroDistribuicaoCandidato[]
}

function chaveBairroDistribuicao(nmBairro: string | null | undefined): string {
  const nome = nmBairro?.trim() || BAIRRO_SEM_CADASTRO
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function rotuloLocal(secao: VotacaoSecaoItem): string {
  return (
    secao.nmLocalVotacao?.trim() ||
    (secao.nrLocalVotacao != null
      ? `Local ${secao.nrLocalVotacao}`
      : `Zona ${secao.nrZona}`)
  )
}

function chaveLocal(secao: VotacaoSecaoItem): string {
  return `${secao.nrZona}:${secao.nrLocalVotacao ?? 0}:${secao.nmLocalVotacao ?? ''}`
}

export function montarDistribuicaoCandidatoBweb(
  secoes: VotacaoSecaoItem[],
  chave: ChaveMatchCandidatoVotacao,
  votosResumo?: number | null,
): DistribuicaoCandidatoBweb {
  let totalVotos = 0
  let totalSecoesComVoto = 0
  let nmVotavel: string | null = null
  let sqCandidato: number | null = null

  const locaisMap = new Map<string, LocalDistribuicaoCandidato>()

  for (const secao of secoes) {
    let votosSecao = 0

    for (const r of secao.resultados) {
      if (!resultadoBwebMatchesChave(r, chave)) continue
      votosSecao += r.qtVotos
      if (!nmVotavel?.trim() && r.nmVotavel?.trim()) nmVotavel = r.nmVotavel
      if (r.sqCandidato != null) sqCandidato = r.sqCandidato
    }

    if (votosSecao <= 0) continue

    totalVotos += votosSecao
    totalSecoesComVoto++

    const localId = chaveLocal(secao)
    let local = locaisMap.get(localId)
    if (!local) {
      local = {
        id: localId,
        nrZona: secao.nrZona,
        nrLocalVotacao: secao.nrLocalVotacao,
        nmLocalVotacao: secao.nmLocalVotacao,
        nmBairro: secao.nmBairro?.trim() || null,
        rotulo: rotuloLocal(secao),
        totalVotos: 0,
        totalSecoes: 0,
        secoes: [],
      }
      locaisMap.set(localId, local)
    }

    local.totalVotos += votosSecao
    local.totalSecoes++
    local.secoes.push({
      nrZona: secao.nrZona,
      nrSecao: secao.nrSecao,
      nrLocalVotacao: secao.nrLocalVotacao,
      nmLocalVotacao: secao.nmLocalVotacao,
      votos: votosSecao,
    })
  }

  const locais = [...locaisMap.values()].sort(
    (a, b) => b.totalVotos - a.totalVotos || a.rotulo.localeCompare(b.rotulo, 'pt-BR'),
  )

  for (const loc of locais) {
    loc.secoes.sort(
      (a, b) => b.votos - a.votos || a.nrSecao - b.nrSecao || a.nrZona - b.nrZona,
    )
  }

  const bairrosMap = new Map<string, BairroDistribuicaoCandidato>()
  for (const loc of locais) {
    const nmBairro = loc.nmBairro?.trim() || BAIRRO_SEM_CADASTRO
    const bid = chaveBairroDistribuicao(loc.nmBairro)
    let bairro = bairrosMap.get(bid)
    if (!bairro) {
      bairro = {
        id: bid,
        nmBairro,
        totalVotos: 0,
        totalSecoes: 0,
        locais: [],
      }
      bairrosMap.set(bid, bairro)
    }
    bairro.totalVotos += loc.totalVotos
    bairro.totalSecoes += loc.totalSecoes
    bairro.locais.push(loc)
  }

  const bairros = [...bairrosMap.values()].sort(
    (a, b) => b.totalVotos - a.totalVotos || a.nmBairro.localeCompare(b.nmBairro, 'pt-BR'),
  )

  const resumo =
    votosResumo != null && Number.isFinite(votosResumo) ? Math.round(votosResumo) : null
  const diferencaResumo = resumo != null ? resumo - totalVotos : null

  return {
    encontrado: totalVotos > 0,
    chave,
    nmVotavel,
    sqCandidato,
    totalVotos,
    totalSecoesComVoto,
    votosResumo: resumo,
    diferencaResumo,
    bairros,
  }
}

export function montarDistribuicaoFromResumo(
  secoes: VotacaoSecaoItem[],
  candidato: Pick<
    ResultadoEleicao,
    | 'anoEleicao'
    | 'cargo'
    | 'codigoCargo'
    | 'numeroUrna'
    | 'sequencialCandidato'
    | 'quantidadeVotosNominais'
  >,
): DistribuicaoCandidatoBweb | null {
  const chave = chaveMatchFromResumo(candidato)
  if (!chave) return null

  const votosResumo = Number.parseInt(candidato.quantidadeVotosNominais || '0', 10)
  return montarDistribuicaoCandidatoBweb(
    secoes,
    chave,
    Number.isFinite(votosResumo) ? votosResumo : null,
  )
}
