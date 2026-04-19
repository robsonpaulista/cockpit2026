/**
 * Relação nome civil (registro) ↔ nome de urna — Deputado Federal PI 2018 (DivulgaCandContas).
 * Usado quando a base importada traz o nome civil em nm_votavel e o prefixo militar aparece só na urna.
 */

import { nomeIndicaPerfilMilitar } from '@/lib/perfil-militar-nome'

export function normalizeNomeHistorico(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pares [nome civil conforme registro TSE, nome de urna]. */
export const NOME_CIVIL_PARA_URNA_DF_PI_2018: ReadonlyArray<readonly [string, string]> = [
  ['EDUARDO ALVES FERREIRA', 'DELEGADO EDUARDO FERREIRA'],
  ['VICENTE CARLOS SOARES NETO', 'CORONEL VICENTE CARLOS'],
  ['FRANCISCO DAS CHAGAS CIRILO OLIVEIRA', 'SARGENTO CIRILO'],
  ['DIEGO GOMES MELO', 'MAJOR DIEGO MELO'],
  ['ROBERTO WAGNER CALIXTO TORRES', 'CORONEL WAGNER TORRES'],
  ['HAROLDO LOIOLA DOS SANTOS', 'CABO HAROLDO'],
  ['MARIA ELIZETE DE LIMA SILVA', 'MAJOR ELIZETE'],
  ['THUYLA KAYNARA DE OLIVEIRA MARTINS', 'THUYLA MARTINS'],
]

const CIVIL_PARA_URNA = new Map<string, string>(
  NOME_CIVIL_PARA_URNA_DF_PI_2018.map(([civil, urna]) => [normalizeNomeHistorico(civil), urna])
)

export type LinhaComNomeUrna = {
  nome: string
  nomeRegistroCivil?: string | null
}

/**
 * Se `nome` (como veio da agregação) bater com um nome civil conhecido, devolve o nome de urna
 * e preserva o civil em `nomeRegistroCivil`. Caso contrário mantém o nome original.
 */
export function aplicarNomeUrnaDf2018<T extends { nome: string }>(row: T): T & LinhaComNomeUrna {
  const key = normalizeNomeHistorico(row.nome)
  const urna = CIVIL_PARA_URNA.get(key)
  if (!urna) {
    return { ...row, nomeRegistroCivil: null }
  }
  const civilOriginal = NOME_CIVIL_PARA_URNA_DF_PI_2018.find(
    ([c]) => normalizeNomeHistorico(c) === key
  )?.[0]
  return {
    ...row,
    nome: urna,
    nomeRegistroCivil: civilOriginal ?? row.nome,
  }
}

/**
 * Mesmo critério do filtro militar na tabela 2018: testa `nm_votavel` na base e,
 * se houver par civil→urna, o nome de urna exibido (onde costuma estar o prefixo militar).
 */
export function nmVotavelEhPerfilMilitarDf2018(nmVotavel: string): boolean {
  const v = String(nmVotavel || '').trim()
  if (!v) return false
  if (nomeIndicaPerfilMilitar(v)) return true
  const { nome: nomeParaExibicao } = aplicarNomeUrnaDf2018({ nome: v })
  return nomeIndicaPerfilMilitar(nomeParaExibicao)
}
