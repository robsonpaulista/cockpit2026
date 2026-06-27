/** Coluna e extração do deputado estadual da liderança (planilha Base Eleitoral). */

export type LiderancaDepEstadualRef = {
  nome: string
  cargo: string
  depEstadual?: string | null
}

export function resolverColunaDepEstadualLideranca(headers: readonly string[]): string | undefined {
  return headers.find((h) => {
    const n = h.toLowerCase().trim()
    if (/dep.*estadual|deputad.*estadual/i.test(h)) return true
    if (/estadual.*lideran|lideran.*estadual/i.test(n)) return true
    return false
  })
}

export function extrairDepEstadualDeLideranca(lider: LiderancaDepEstadualRef): string {
  const direto = String(lider.depEstadual ?? '').trim()
  if (direto) return direto

  const cargoTexto = String(lider.cargo || '')
  if (!cargoTexto) return ''

  const match = cargoTexto.match(
    /(?:dep\.?\s*estadual|deputad[oa]\s*estadual)\s*:?\s*([^·|;]+?)(?=\s{2,}|[·|;]|$)/i,
  )
  return match?.[1]?.trim() || ''
}

/**
 * Nome do dep. estadual mais citado entre as lideranças da cidade
 * (prioriza liderança com maior projeção aferida quando empatar).
 */
export function resolverDepEstadualLiderancaCidade(
  liderancas: readonly (LiderancaDepEstadualRef & { projecaoAferida?: number })[],
): string | null {
  const contagem = new Map<string, { nome: string; peso: number; citacoes: number }>()

  for (const l of liderancas) {
    const dep = extrairDepEstadualDeLideranca(l)
    if (!dep) continue

    const chave = dep
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()

    const atual = contagem.get(chave) ?? { nome: dep, peso: 0, citacoes: 0 }
    atual.citacoes += 1
    atual.peso += Number(l.projecaoAferida ?? 0)
    contagem.set(chave, atual)
  }

  if (contagem.size === 0) return null

  return [...contagem.values()].sort(
    (a, b) => b.citacoes - a.citacoes || b.peso - a.peso || a.nome.localeCompare(b.nome, 'pt-BR'),
  )[0].nome
}
