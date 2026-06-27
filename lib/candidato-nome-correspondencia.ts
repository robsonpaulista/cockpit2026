/** Correspondência fuzzy entre nomes de urna e alvos da planilha/liderança. */

export function normalizeTextNomeCandidato(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extrairAliases(nome: string): string[] {
  const bruto = String(nome || '')
  const partes = bruto
    .split(/[\/|;]+/g)
    .map((parte) => normalizeTextNomeCandidato(parte))
    .filter((parte) => parte.length > 0)

  const normalizadoCompleto = normalizeTextNomeCandidato(bruto)
  if (normalizadoCompleto && !partes.includes(normalizadoCompleto)) {
    partes.unshift(normalizadoCompleto)
  }

  return Array.from(new Set(partes))
}

function tokensSignificativos(nome: string): string[] {
  const stopwords = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  return normalizeTextNomeCandidato(nome)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopwords.has(token) && !/^\d+$/.test(token))
}

export function scoreCorrespondenciaNomeCandidato(nomeCandidato: string, alvo: string): number {
  const candidato = normalizeTextNomeCandidato(nomeCandidato)
  if (!candidato) return 0

  const aliases = extrairAliases(alvo)
  let melhorScore = 0

  for (const alias of aliases) {
    const aliasNorm = normalizeTextNomeCandidato(alias)
    if (!aliasNorm) continue

    if (candidato === aliasNorm) {
      melhorScore = Math.max(melhorScore, 100)
      continue
    }

    const tokensAlias = tokensSignificativos(aliasNorm)
    const primeiroToken = tokensAlias[0]

    if (tokensAlias.length >= 2 && tokensAlias.every((token) => candidato.includes(token))) {
      melhorScore = Math.max(melhorScore, 90)
      continue
    }

    if (primeiroToken && candidato.includes(primeiroToken)) {
      melhorScore = Math.max(melhorScore, 75)
      continue
    }
  }

  return melhorScore
}

export function selecionarMelhorPorNome<T extends { nmVotavel?: string; nomeUrnaCandidato?: string }>(
  itens: readonly T[],
  alvos: readonly string[],
  scoreMinimo = 75,
): T | null {
  let melhor: T | null = null
  let melhorScore = 0

  for (const item of itens) {
    const nome = item.nmVotavel ?? item.nomeUrnaCandidato ?? ''
    let scoreItem = 0
    for (const alvo of alvos) {
      scoreItem = Math.max(scoreItem, scoreCorrespondenciaNomeCandidato(nome, alvo))
    }
    if (scoreItem > melhorScore) {
      melhorScore = scoreItem
      melhor = item
    }
  }

  return melhorScore >= scoreMinimo ? melhor : null
}
