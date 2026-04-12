/**
 * Normalização de pesquisa espontânea: redistribui parte do "Não sabe / Não opina"
 * proporcionalmente aos candidatos (campo ativo), sem expandir branco/nulo.
 * Reduz o efeito "gangorra" ao comparar com estimulada.
 *
 * Fórmula: boost = (soma Não sabe) × expansionRate;
 * cada candidato ativo c recebe: c + boost × (c / somaCampoAtivo).
 * "Não sabe" vira: NS × (1 - expansionRate). Branco/nulo inalterado.
 */

export const DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE = 0.4

/** Ajuste fino (pré-campanha, indecisão alta): subir para ~0,45 se quiser cenário mais "forçado". */

function normLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Indecisão explícita (só isso entra no boost; branco/nulo fica de fora). */
export function isNaoSabeOuNaoOpinaNome(candidatoNome: string): boolean {
  const n = normLabel(candidatoNome)
  if (!n) return false
  if (/\bnao\s+sabe\b/.test(n)) return true
  if (/\bnao\s+opina\b/.test(n)) return true
  if (n.includes('nao sabe') || n.includes('nao opina')) return true
  if (/\bindecis/.test(n)) return true
  // Abreviações comuns em planilhas / institutos
  if (/\bns\s*[/]\s*nr\b/.test(n) || /\bns\s+nr\b/.test(n)) return true
  if (/\bnao\s+responde/.test(n) || /\bsem\s+opiniao\b/.test(n)) return true
  return false
}

/** Branco / nulo / nenhum (não recebe redistribuição; mantém valor original). */
export function isBrancoNuloOuNenhumNome(candidatoNome: string): boolean {
  if (isNaoSabeOuNaoOpinaNome(candidatoNome)) return false
  const n = normLabel(candidatoNome)
  if (!n) return false
  if (/\bbranco\b/.test(n) || /\bnulo\b/.test(n) || /\bneutro\b/.test(n)) return true
  if (/\bnenhum\b/.test(n)) return true
  return false
}

export function isCandidatoCampoAtivoEspontanea(candidatoNome: string): boolean {
  return (
    !isNaoSabeOuNaoOpinaNome(candidatoNome) && !isBrancoNuloOuNenhumNome(candidatoNome)
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function toFiniteNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    const normalized =
      t.includes(',') && t.includes('.')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.includes(',')
          ? t.replace(',', '.')
          : t
    const v = Number(normalized)
    if (Number.isFinite(v)) return v
  }
  return null
}

/**
 * Aplica normalização em uma linha do gráfico (objeto com intencao_*, rejeicao_*, instituto_*, data).
 */
export function normalizarLinhaEspontanea(
  row: Record<string, string | number | undefined>,
  expansionRate: number = DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE
): Record<string, string | number | undefined> {
  if (expansionRate <= 0 || expansionRate >= 1) return { ...row }

  const out: Record<string, string | number | undefined> = { ...row }

  type Entry = { intKey: string; nome: string; v: number }
  const ativos: Entry[] = []
  const naoSabeKeys: { key: string; v: number }[] = []
  const brancoKeys: { key: string; v: number }[] = []

  for (const key of Object.keys(row)) {
    if (!key.startsWith('intencao_')) continue
    const parsed = toFiniteNumber(row[key])
    if (parsed === null) continue
    const raw = parsed
    const nomeFromKey = key.replace(/^intencao_/, '').replace(/_/g, ' ')
    if (isNaoSabeOuNaoOpinaNome(nomeFromKey)) {
      naoSabeKeys.push({ key, v: raw })
    } else if (isBrancoNuloOuNenhumNome(nomeFromKey)) {
      brancoKeys.push({ key, v: raw })
    } else {
      ativos.push({ intKey: key, nome: nomeFromKey, v: raw })
    }
  }

  const somaNS = naoSabeKeys.reduce((s, x) => s + x.v, 0)
  const somaAtivos = ativos.reduce((s, x) => s + x.v, 0)

  if (somaAtivos <= 0 || somaNS <= 0) return out

  const boost = somaNS * expansionRate

  for (const a of ativos) {
    const add = boost * (a.v / somaAtivos)
    out[a.intKey] = round1(a.v + add)
  }

  const fatorResidual = 1 - expansionRate
  for (const { key, v } of naoSabeKeys) {
    out[key] = round1(v * fatorResidual)
  }

  // branco/nulo: inalterado (já copiado em out)

  return out
}
