import { normalizeMunicipioNome } from '@/lib/fns-municipio-normalize'

export interface MunicipioPopulacao {
  nome: string
  nome_normalizado: string
  codigo_ibge: string
  populacao: number
}

export function getPopulacaoMunicipio(
  lista: MunicipioPopulacao[],
  nomeMunicipio: string,
): number | null {
  if (!nomeMunicipio || lista.length === 0) return null
  const chave = normalizeMunicipioNome(nomeMunicipio)
  const municipio = lista.find(
    (m) =>
      normalizeMunicipioNome(m.nome) === chave || m.nome_normalizado === chave,
  )
  return municipio ? Number(municipio.populacao) : null
}
