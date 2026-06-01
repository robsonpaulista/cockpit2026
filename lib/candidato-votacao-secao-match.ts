import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import {
  isVotavelLegendaBweb,
  normalizarNomeCargo,
  type VotacaoSecaoAno,
  type VotacaoSecaoItem,
  type VotacaoSecaoResultado,
} from '@/lib/votacao-secao'
import {
  candidatoMatrizId,
  listarCandidatosSecao,
  type CandidatoMatrizColuna,
} from '@/lib/votacao-secao-matriz'

export type ChaveMatchCandidatoVotacao = {
  ano: VotacaoSecaoAno
  cdCargo: number
  dsCargo: string
  nrVotavel: number
  sqCandidato: number | null
}

const CD_CARGO_POR_DS: Record<string, number> = {
  Governador: 3,
  Senador: 5,
  'Deputado Federal': 6,
  'Deputado Estadual': 7,
  Prefeito: 11,
  Vereador: 13,
}

export function parseNumeroUrnaResumo(numeroUrna: string): number | null {
  const n = Number.parseInt(String(numeroUrna ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) && n > 0 && !isVotavelLegendaBweb(n) ? n : null
}

export function parseCdCargoResumo(codigoCargo: string): number | null {
  const n = Number.parseInt(String(codigoCargo ?? '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function cargoResumoParaDsCargo(cargo: string, codigoCargo?: string): string | null {
  const cd = codigoCargo ? parseCdCargoResumo(codigoCargo) : null
  if (cd != null) {
    const porCodigo = Object.entries(CD_CARGO_POR_DS).find(([, v]) => v === cd)
    if (porCodigo) return porCodigo[0]
  }

  const c = (cargo ?? '').toLowerCase()
  if (c.includes('federal')) return 'Deputado Federal'
  if (c.includes('estadual')) return 'Deputado Estadual'
  if (c.includes('prefeito')) return 'Prefeito'
  if (c.includes('vereador')) return 'Vereador'
  if (c.includes('governador')) return 'Governador'
  if (c.includes('senador')) return 'Senador'
  return null
}

export function anoResumoSuportadoVotacaoSecao(anoEleicao: string): VotacaoSecaoAno | null {
  const n = Number(anoEleicao)
  return n === 2022 || n === 2024 ? n : null
}

export function resumoTemVotacaoSecao(
  item: Pick<ResultadoEleicao, 'anoEleicao' | 'cargo' | 'codigoCargo' | 'numeroUrna'>,
): boolean {
  const ano = anoResumoSuportadoVotacaoSecao(item.anoEleicao)
  if (!ano) return false
  const dsCargo = cargoResumoParaDsCargo(item.cargo, item.codigoCargo)
  if (!dsCargo) return false
  return parseNumeroUrnaResumo(item.numeroUrna) != null
}

export function chaveMatchFromResumo(
  item: Pick<
    ResultadoEleicao,
    'anoEleicao' | 'cargo' | 'codigoCargo' | 'numeroUrna' | 'sequencialCandidato'
  >,
): ChaveMatchCandidatoVotacao | null {
  const ano = anoResumoSuportadoVotacaoSecao(item.anoEleicao)
  if (!ano) return null

  const dsCargo = cargoResumoParaDsCargo(item.cargo, item.codigoCargo)
  if (!dsCargo) return null

  const nrVotavel = parseNumeroUrnaResumo(item.numeroUrna)
  if (nrVotavel == null) return null

  const cdInformado = parseCdCargoResumo(item.codigoCargo)
  const cdCargo = cdInformado ?? CD_CARGO_POR_DS[dsCargo] ?? 0
  if (!cdCargo) return null

  const sqRaw = Number.parseInt(String(item.sequencialCandidato ?? '').trim(), 10)
  const sqCandidato = Number.isFinite(sqRaw) && sqRaw > 0 ? sqRaw : null

  return { ano, cdCargo, dsCargo, nrVotavel, sqCandidato }
}

export function resultadoBwebMatchesChave(
  r: VotacaoSecaoResultado,
  chave: ChaveMatchCandidatoVotacao,
): boolean {
  if (r.anoEleicao != null && r.anoEleicao !== chave.ano) return false
  if (r.cdCargo !== chave.cdCargo) return false
  if (r.nrVotavel !== chave.nrVotavel) return false
  if (isVotavelLegendaBweb(r.nrVotavel)) return false

  if (
    chave.sqCandidato != null &&
    r.sqCandidato != null &&
    r.sqCandidato !== chave.sqCandidato
  ) {
    return false
  }

  const cargoNorm = normalizarNomeCargo(r.dsCargo)
  const esperado = normalizarNomeCargo(chave.dsCargo)
  return cargoNorm === esperado
}

/** Resolve o id da coluna na matriz a partir das seções carregadas. */
export function encontrarIdCandidatoMatriz(
  secoes: VotacaoSecaoItem[],
  chave: ChaveMatchCandidatoVotacao,
  nomeFallback?: string,
): string | null {
  const candidatos = listarCandidatosSecao(secoes)
  const dsEsperado = normalizarNomeCargo(chave.dsCargo)
  const porNumero = candidatos.find(
    (c) =>
      c.nrVotavel === chave.nrVotavel &&
      normalizarNomeCargo(c.dsCargo) === dsEsperado &&
      (c.anoEleicao == null || c.anoEleicao === chave.ano),
  )
  if (porNumero) return porNumero.id

  if (nomeFallback?.trim()) {
    return candidatoMatrizId(
      chave.dsCargo,
      chave.nrVotavel,
      nomeFallback,
      chave.ano,
      chave.sqCandidato,
    )
  }

  return null
}
