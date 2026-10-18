import { siglaSituacao, type SiglaSituacao } from '@/lib/resumo-eleicoes-dados'
import type {
  LinhaQuadroMunicipio2026,
  QuadroMunicipios2026,
  VencedorMunicipio2026,
} from '@/lib/resultado-secao-2026'

export type FiltroSituacao2026 = 'todas' | 'eleito' | 'suplente' | 'nao'

export const FILTROS_SITUACAO_2026: readonly { id: FiltroSituacao2026; label: string; noMapa: string }[] = [
  { id: 'todas', label: 'Todas', noMapa: 'Mais votado em cada município' },
  { id: 'eleito', label: 'Eleitos', noMapa: 'Eleito mais votado em cada município' },
  { id: 'suplente', label: 'Suplentes', noMapa: 'Suplente mais votado em cada município' },
  { id: 'nao', label: 'Não eleitos', noMapa: 'Não eleito mais votado em cada município' },
]

/** Rótulo curto da situação TSE para a interface e o PDF. */
export function rotuloSituacao2026(situacao: string | undefined): string {
  const texto = (situacao ?? '').trim()
  if (/^eleito por qp$/i.test(texto)) return 'Eleito por QP'
  if (/^eleito por m[eé]dia$/i.test(texto)) return 'Eleito por média'
  if (/^eleito$/i.test(texto)) return 'Eleito'
  if (/^suplente$/i.test(texto)) return 'Suplente'
  if (/^n[aã]o eleito$/i.test(texto)) return 'Não eleito'
  return ''
}

export function siglaSituacao2026(situacao: string | undefined): SiglaSituacao {
  return siglaSituacao(situacao ?? '')
}

export function aceitaSituacao2026(situacao: string | undefined, filtro: FiltroSituacao2026): boolean {
  if (filtro === 'todas') return true
  const selo = siglaSituacao2026(situacao)
  if (filtro === 'eleito') return selo.sigla === 'E'
  if (filtro === 'suplente') return selo.sigla === 'S'
  return selo.sigla === 'N'
}

function recortarVotos(votos: number[], posicoes: number[]): Pick<LinhaQuadroMunicipio2026, 'votos' | 'ranking' | 'total'> {
  const novos = posicoes.map((p) => votos[p] ?? 0)
  const ranking = novos
    .flatMap((v, p) => (v > 0 ? [p] : []))
    .sort((a, b) => novos[b] - novos[a] || a - b)
  return { votos: novos, ranking, total: novos.reduce((a, b) => a + b, 0) }
}

/** Mantém só os candidatos da situação e refaz a colocação em cada município. */
export function filtrarQuadroPorSituacao2026(
  quadro: QuadroMunicipios2026,
  situacaoDe: (idx: number) => string | undefined,
  filtro: FiltroSituacao2026,
): QuadroMunicipios2026 {
  if (filtro === 'todas') return quadro
  const posicoes = quadro.indices.flatMap((idx, p) => (aceitaSituacao2026(situacaoDe(idx), filtro) ? [p] : []))
  return {
    indices: posicoes.map((p) => quadro.indices[p]),
    totais: posicoes.map((p) => quadro.totais[p] ?? 0),
    linhas: quadro.linhas.map((l) => ({ ...l, ...recortarVotos(l.votos, posicoes) })),
  }
}

/** O ranking do município passa a considerar só a situação escolhida. */
export function filtrarVencedoresPorSituacao2026(
  vencedores: VencedorMunicipio2026[],
  situacaoDe: (idx: number) => string | undefined,
  filtro: FiltroSituacao2026,
  colocados = 3,
): VencedorMunicipio2026[] {
  if (filtro === 'todas') return vencedores
  return vencedores.map((v) => ({
    ...v,
    ranking: v.ranking.filter((r) => aceitaSituacao2026(situacaoDe(r.idx), filtro)).slice(0, colocados),
  }))
}
