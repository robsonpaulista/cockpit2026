/** Classificação de evolução temporal no mapa IPT. */
export type IptEvolucao = 'cresceu' | 'estavel' | 'diminuiu' | 'sem_dado'

export type IptEvolucaoFiltro = 'todos' | 'cresceu' | 'estavel' | 'diminuiu'

export const IPT_EVOLUCAO_FILTRO_OPCOES: { id: IptEvolucaoFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'cresceu', label: 'Cresceu' },
  { id: 'estavel', label: 'Estável' },
  { id: 'diminuiu', label: 'Diminuiu' },
]

/** Limiar em pontos percentuais para intenção de pesquisa (onda recente vs anterior). */
export const IPT_EVOLUCAO_PESQUISA_LIMIAR_PP = 1.5

/** Limiar relativo (%) para seguidores / engajamento por cidade. */
export const IPT_EVOLUCAO_DIGITAL_LIMIAR_PCT = 5

/** Limiar absoluto mínimo de seguidores para considerar variação relevante. */
export const IPT_EVOLUCAO_DIGITAL_LIMIAR_ABS = 50

export function classificarEvolucaoPorDelta(
  atual: number | null | undefined,
  anterior: number | null | undefined,
  opts: { limiarAbs?: number; limiarPct?: number } = {}
): IptEvolucao {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) {
    return 'sem_dado'
  }
  const delta = atual - anterior
  const limiarAbs = opts.limiarAbs ?? 0
  const limiarPct = opts.limiarPct ?? 0

  if (limiarPct > 0 && anterior > 0) {
    const pct = (delta / anterior) * 100
    if (Math.abs(pct) < limiarPct && Math.abs(delta) < Math.max(limiarAbs, 1)) return 'estavel'
    if (pct > 0) return 'cresceu'
    if (pct < 0) return 'diminuiu'
    return 'estavel'
  }

  if (Math.abs(delta) <= limiarAbs) return 'estavel'
  return delta > 0 ? 'cresceu' : 'diminuiu'
}

export function classificarEvolucaoPesquisaPp(
  recente: number | null | undefined,
  anterior: number | null | undefined,
  limiarPp = IPT_EVOLUCAO_PESQUISA_LIMIAR_PP
): IptEvolucao {
  if (recente == null || !Number.isFinite(recente)) return 'sem_dado'
  // Uma única onda (sem anterior): trata como estável — há pesquisa, sem tendência a medir.
  if (anterior == null || !Number.isFinite(anterior)) return 'estavel'
  const delta = recente - anterior
  if (Math.abs(delta) < limiarPp) return 'estavel'
  return delta > 0 ? 'cresceu' : 'diminuiu'
}

export function classificarEvolucaoVisitas(atual: number, anterior: number): IptEvolucao {
  // Sem visitas em 0–30d e 31–60d: trata como diminuiu (sem presença recente).
  if (atual === 0 && anterior === 0) return 'diminuiu'
  if (atual === anterior) return 'estavel'
  return atual > anterior ? 'cresceu' : 'diminuiu'
}

export function classificarEvolucaoDigital(
  atual: number | null | undefined,
  anterior: number | null | undefined
): IptEvolucao {
  return classificarEvolucaoPorDelta(atual, anterior, {
    limiarAbs: IPT_EVOLUCAO_DIGITAL_LIMIAR_ABS,
    limiarPct: IPT_EVOLUCAO_DIGITAL_LIMIAR_PCT,
  })
}

export function iptEvolucaoLabel(e: IptEvolucao): string {
  if (e === 'cresceu') return 'Cresceu'
  if (e === 'estavel') return 'Estável'
  if (e === 'diminuiu') return 'Diminuiu'
  return 'Sem dado'
}

export function iptEvolucaoCor(e: IptEvolucao): string {
  if (e === 'cresceu') return '#059669'
  if (e === 'diminuiu') return '#dc2626'
  if (e === 'estavel') return '#ca8a04'
  return '#64748b'
}

/**
 * Evolução usada no filtro conforme a lente ativa.
 * Obras não entram (sem série eleitoral relevante).
 * Geral: Pesquisa → Visitas (Digital não influencia o diagnóstico geral).
 */
export function evolucaoDaLente(
  m: {
    evolucao: {
      pesquisa: IptEvolucao
      digitalSeguidores: IptEvolucao
      digitalEngajamento: IptEvolucao
      visitas: IptEvolucao
    }
  },
  lente: 'geral' | 'visitas' | 'obras' | 'pesquisa' | 'digital' | null
): IptEvolucao {
  if (lente === 'obras') return 'sem_dado'
  if (lente === 'pesquisa') return m.evolucao.pesquisa
  if (lente === 'digital') return m.evolucao.digitalSeguidores
  if (lente === 'visitas') return m.evolucao.visitas
  // Geral: pesquisa tem maior peso; obras sem série; digital fora do geral.
  if (m.evolucao.pesquisa !== 'sem_dado') return m.evolucao.pesquisa
  return m.evolucao.visitas
}

export function municipioPassaFiltroEvolucao(
  evolucao: IptEvolucao,
  filtro: IptEvolucaoFiltro
): boolean {
  // "Todos" = universo da lente (ex.: todas as cidades com pesquisa),
  // inclusive as que ainda não têm 2 ondas / histórico para classificar.
  if (filtro === 'todos') return true
  return evolucao === filtro
}
