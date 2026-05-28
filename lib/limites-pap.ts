import limitesPap2025 from '@/data/limites-pap-2025.json'
import limitesPap2026 from '@/data/limites-pap-2026.json'
import { normalizeMunicipioNome, mapearNomeMunicipio } from '@/lib/fns-municipio-normalize'
import type { ModalidadeLimite } from '@/lib/emenda-modalidade'

export interface LimitePap {
  uf: string
  ibge: string | number
  municipio: string
  valor: number
  tipo: string
  modalidade?: ModalidadeLimite
}

const LISTA_POR_EXERCICIO: Record<number, LimitePap[]> = {
  2025: limitesPap2025 as LimitePap[],
  2026: limitesPap2026 as LimitePap[],
}

function listaExercicio(exercicio: number): LimitePap[] {
  return LISTA_POR_EXERCICIO[exercicio] ?? LISTA_POR_EXERCICIO[2025]
}

function chaveBusca(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

export function getLimitePapByMunicipio(
  nomeMunicipio: string,
  exercicio = 2025,
  modalidade: ModalidadeLimite = 'individual',
): LimitePap | undefined {
  const chave = chaveBusca(nomeMunicipio)
  return listaExercicio(exercicio).find((l) => {
    const mod = l.modalidade ?? 'individual'
    return normalizeMunicipioNome(l.municipio) === chave && mod === modalidade
  })
}

export function getValorLimitePap(
  nomeMunicipio: string,
  exercicio = 2025,
  modalidade: ModalidadeLimite = 'individual',
): number | null {
  return getLimitePapByMunicipio(nomeMunicipio, exercicio, modalidade)?.valor ?? null
}

export function getAllLimitesPap(exercicio = 2025): LimitePap[] {
  return listaExercicio(exercicio)
}
