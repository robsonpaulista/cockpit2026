import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'

export type CargoFotoCandidato = 'prefeito' | 'vereador'

export const URL_DIVULGACAND_HOME =
  'https://divulgacandcontas.tse.jus.br/divulga/#/home'

export interface CandidatoFotoDivulgacand {
  id: string
  municipio_chave: string
  municipio_nome: string
  cargo: CargoFotoCandidato
  ano_eleicao: number
  numero_urna: string
  nome_urna: string
  url_imagem: string
  url_divulgacand: string | null
}

export function municipioChaveFoto(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

/** Prefere o cargo do registro eleitoral; usa o informado na tabela como fallback. */
export function resolverCargoFotoCandidato(
  candidato: Pick<ResultadoEleicao, 'cargo'>,
  cargoInformado?: CargoFotoCandidato,
): CargoFotoCandidato {
  const raw = String(candidato.cargo ?? '')
  if (/vereador/i.test(raw)) return 'vereador'
  if (/prefeito/i.test(raw)) return 'prefeito'
  return cargoInformado ?? 'prefeito'
}

export function candidatoFotoLookupKey(
  cargo: CargoFotoCandidato,
  item: Pick<ResultadoEleicao, 'numeroUrna' | 'nomeUrnaCandidato'>,
): string {
  const numero = String(item.numeroUrna ?? '').trim()
  const nome = normalizeMunicipioNome(String(item.nomeUrnaCandidato ?? ''))
  return `${cargo}:${numero}:${nome}`
}

export function buildFotosMap(
  fotos: CandidatoFotoDivulgacand[],
): Record<string, CandidatoFotoDivulgacand> {
  const map: Record<string, CandidatoFotoDivulgacand> = {}
  for (const f of fotos) {
    map[candidatoFotoLookupKey(f.cargo, { numeroUrna: f.numero_urna, nomeUrnaCandidato: f.nome_urna })] = f
  }
  return map
}

export function validarUrlHttp(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function pareceUrlImagem(url: string): boolean {
  const lower = url.trim().toLowerCase()
  if (/\.(jpe?g|png|gif|webp|bmp)(\?|$)/i.test(lower)) return true
  if (lower.includes('imagem') || lower.includes('/foto') || lower.includes('divulgacand')) return true
  return validarUrlHttp(url)
}
