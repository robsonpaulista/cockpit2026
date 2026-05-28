import limitesMac2025 from '@/data/limites-mac-2025.json'
import limitesMac2026 from '@/data/limites-mac-2026.json'
import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'
import type { ModalidadeLimite } from '@/lib/emenda-modalidade'

export interface LimiteMac {
  uf: string
  ibge: string | number
  municipio: string
  valor: number
  cnes: string | number
  nome_fantasia: string
  tipo: string
  modalidade?: ModalidadeLimite
}

const LISTA_POR_EXERCICIO: Record<number, LimiteMac[]> = {
  2025: limitesMac2025 as LimiteMac[],
  2026: limitesMac2026 as LimiteMac[],
}

function listaExercicio(exercicio: number): LimiteMac[] {
  return LISTA_POR_EXERCICIO[exercicio] ?? LISTA_POR_EXERCICIO[2025]
}

function chaveBusca(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

/** Soma limites MAC de todos os estabelecimentos (CNES) do município na modalidade. */
export function getValorLimiteMac(
  nomeMunicipio: string,
  exercicio = 2025,
  modalidade: ModalidadeLimite = 'individual',
): number | null {
  const chave = chaveBusca(nomeMunicipio)
  const itens = listaExercicio(exercicio).filter(
    (l) =>
      normalizeMunicipioNome(l.municipio) === chave && (l.modalidade ?? 'individual') === modalidade,
  )
  if (itens.length === 0) return null
  return itens.reduce((acc, l) => acc + (l.valor || 0), 0)
}

export function getLimitesMacByMunicipio(
  nomeMunicipio: string,
  exercicio = 2025,
  modalidade: ModalidadeLimite = 'individual',
): LimiteMac[] {
  const chave = chaveBusca(nomeMunicipio)
  return listaExercicio(exercicio).filter(
    (l) =>
      normalizeMunicipioNome(l.municipio) === chave && (l.modalidade ?? 'individual') === modalidade,
  )
}

export function getAllLimitesMac(exercicio = 2025): LimiteMac[] {
  return listaExercicio(exercicio)
}
